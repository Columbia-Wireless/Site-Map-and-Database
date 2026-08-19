import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { logDocEvent, getCallerName } from '@/lib/logDocEvent'
import { assertSiteVisible } from '@/lib/orgScope'
import { sendCorrectionToSam2, FIELD_TO_SAM2_PATH } from '@/lib/sam2Corrections'

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://vfntpdpneusqgcwxwkix.supabase.co'
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZmbnRwZHBuZXVzcWdjd3h3a2l4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5NTg2MzEsImV4cCI6MjA5MzUzNDYzMX0.kFZ6b2WKAl7GVsEQZeO33qcxhyBruQlTfW0eZfkcg1c'
  return createClient(url, key)
}

const CRITICAL_FIELDS = ['licensor', 'licensee', 'commencement_date', 'monthly_rent', 'initial_term_years', 'governing_law']

/**
 * Closes a real gap found 2026-08-18: editing a field here used to only touch
 * the flat display copy (extracted_terms[key]) — the rent engine reads
 * extracted_terms._sam2_raw.extractedData verbatim (lib/rentEngine/adapter.ts
 * toExtractedLeaseDoc()), so a human correction never reached the actual
 * calculation. This patches the same nested path inside _sam2_raw so the
 * engine picks up the corrected value on its next read. Only covers fields
 * that map onto a single, unambiguous nested primitive — renewal_options and
 * one_time_fee are stored here as summarized display strings (not reversible
 * into their structured shape) and are intentionally left out; correcting
 * those requires editing the source document in SAM 2.0 or a dedicated
 * structured editor, not this generic field patcher.
 */
function applyCorrectionToSam2Raw(allTerms: Record<string, any>, field: string, rawValue: unknown) {
  const raw = allTerms?.['_sam2_raw']
  const ed = raw?.extractedData
  if (!ed) return // not a SAM 2.0-sourced document — nothing to patch

  const value = typeof rawValue === 'string' ? rawValue.trim() : rawValue

  switch (field) {
    case 'licensor':
      ed.siteIdentity.lessorName = value
      break
    case 'licensee':
      ed.siteIdentity.lesseeName = value
      break
    case 'commencement_date':
      ed.documentMetadata.commencementDate = value || null
      break
    case 'signature_date':
      ed.documentMetadata.executionDate = value
      break
    case 'monthly_rent':
      if (ed.leaseTerms) ed.leaseTerms.baseRent = Number(value) || 0
      break
    case 'initial_term_years':
      if (ed.leaseTerms) ed.leaseTerms.initialTermMonths = Math.round((Number(value) || 0) * 12)
      break
    case 'escalation_type':
      if (ed.leaseTerms?.escalation) ed.leaseTerms.escalation.type = value
      break
    default:
      // Not a field this patcher knows how to map — leave _sam2_raw untouched.
      break
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  const { id: siteId, docId } = await params
  if (!(await assertSiteVisible(siteId))) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const supabase = getSupabaseAdmin()
  const userName = await getCallerName(req)

  const { field, field_data, all_terms } = await req.json()

  if (!field || !all_terms) {
    return NextResponse.json({ error: 'field and all_terms required' }, { status: 400 })
  }

  // Fetch current doc to capture old value before overwriting
  const { data: currentDoc } = await supabase
    .from('site_documents')
    .select('extracted_terms')
    .eq('id', docId)
    .single()

  // Propagate the correction into _sam2_raw so the rent engine (which reads
  // that, not the flat display fields) actually sees it — see
  // applyCorrectionToSam2Raw()'s doc comment.
  if (!field.startsWith('_')) {
    applyCorrectionToSam2Raw(all_terms, field, field_data?.value)
  }

  // Recompute doc status from updated terms
  const docStatus = computeDocStatus(all_terms)

  const { data: updated, error } = await supabase
    .from('site_documents')
    .update({ extracted_terms: all_terms, doc_status: docStatus })
    .eq('id', docId)
    .eq('site_id', siteId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  let sam2CorrectionResult: Awaited<ReturnType<typeof sendCorrectionToSam2>> | null = null

  // Log field edit (skip internal _address_check updates)
  if (!field.startsWith('_')) {
    const oldRaw = currentDoc?.extracted_terms?.[field]
    const oldVal = typeof oldRaw === 'object' && oldRaw !== null ? oldRaw.value : oldRaw
    const newVal = field_data?.value ?? null
    await logDocEvent(supabase, docId, 'field_edited', userName, {
      field,
      old_value: oldVal ?? null,
      new_value: newVal,
    })

    // Write the correction back to SAM 2.0 — task #43, endpoint confirmed
    // live by Onno 2026-08-19. Only for fields we also know how to patch
    // locally (FIELD_TO_SAM2_PATH mirrors applyCorrectionToSam2Raw's switch
    // above) and only for documents that actually came from SAM 2.0
    // (raw.documentId/siteId/agreementId present). No-ops safely if
    // SAM2_CORRECTION_SECRET isn't set yet — see lib/sam2Corrections.ts.
    const sam2Path = FIELD_TO_SAM2_PATH[field]
    const raw = all_terms?.['_sam2_raw']
    if (sam2Path && raw?.documentId && raw?.siteId && raw?.agreementId) {
      sam2CorrectionResult = await sendCorrectionToSam2({
        documentId: raw.documentId,
        siteId: raw.siteId,
        agreementId: raw.agreementId,
        fieldPath: sam2Path,
        oldValue: oldVal ?? null,
        newValue: newVal,
        correctedBy: userName,
        correctedAt: new Date().toISOString(),
      })
    }
  }

  return NextResponse.json({ ...updated, _sam2CorrectionResult: sam2CorrectionResult })
}

function computeDocStatus(terms: Record<string, any>): string {
  // Unaccepted address mismatch → review_required
  const ac = terms._address_check
  if (ac && ac.mismatch && !ac.accepted) return 'review_required'
  // Critical fields
  for (const field of CRITICAL_FIELDS) {
    const t = terms[field]
    if (!t) return 'review_required'
    const val = typeof t === 'object' ? t.value : t
    const conf = typeof t === 'object' ? (t.edited_by ? 'high' : t.confidence) : (val ? 'high' : 'low')
    if (!val || conf === 'low') return 'review_required'
  }
  // Any non-meta medium-confidence field
  for (const [key, t] of Object.entries(terms)) {
    if (!key.startsWith('_') && t && typeof t === 'object' && !t.edited_by && t.confidence === 'medium') return 'review_required'
  }
  return 'extracted'
}
