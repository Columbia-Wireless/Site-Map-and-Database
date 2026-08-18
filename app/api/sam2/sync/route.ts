import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'
import { getProfile, canEdit } from '@/lib/profile'
import { getActorInfo, logChange } from '@/lib/audit'
import { matchHostAgency, matchLicensee } from '@/lib/sam2Match'
import type { Sam2SyncPayload, Sam2SyncResult, Sam2DocType, Sam2LeaseTerms } from '@/lib/sam2Types'

/**
 * Receives a SAM2_DOCUMENT_PARSED payload (relayed by the client from
 * Sam2ImportModal) and syncs it into tower_sites / site_licenses /
 * site_documents. Idempotent on sam2_site_id / sam2_agreement_id / sam2_doc_id
 * — safe to call more than once for the same document (e.g. a re-sync or a
 * re-announce after lineage resolves, see lib/sam2Types.ts).
 *
 * Payload shape CORRECTED 2026-08-18 (see lib/sam2Types.ts's module comment
 * for the full story) — siteIdentity/leaseTerms/documentMetadata/geocode all
 * live under payload.extractedData, not top-level, and the id fields are
 * payload.documentId/siteId/agreementId, not sam2DocId/sam2SiteId/
 * sam2AgreementId. The previous shape had never been exercised against a
 * real payload. installationType carries the tower_type value directly (no
 * separate towerType field).
 */

const DOC_TYPE_MAP: Record<Sam2DocType, string> = {
  lease: 'lease',
  amendment: 'amendment',
  addendum: 'amendment',
  termination: 'other',
  assignment: 'other',
  commencement_agreement: 'other',
  management_agreement: 'other',
}

function computeAnnualRent(leaseTerms: Sam2LeaseTerms | undefined): number {
  if (!leaseTerms) return 0
  const multiplier = { monthly: 12, quarterly: 4, annually: 1 }[leaseTerms.paymentFrequency] ?? 1
  return leaseTerms.baseRent * multiplier
}

/**
 * Flattens the escalation clause into the legacy flat `escalation_rate` numeric
 * column (percent) for backward compatibility with existing reports/charts that
 * only read that column. Full detail is preserved separately in
 * escalation_detail — this is a lossy simplification for anything that isn't a
 * plain fixed-percentage escalation, flagged via the warnings array.
 */
function simplifyEscalationRate(leaseTerms: Sam2LeaseTerms | undefined): { rate: number; warning: string | null } {
  const esc = leaseTerms?.escalation
  if (!esc) return { rate: 0, warning: null }
  if (esc.type === 'fixed_percentage') return { rate: esc.value * 100, warning: null }
  if (esc.type === 'none') return { rate: 0, warning: null }
  return {
    rate: 0,
    warning: `Escalation type is "${esc.type}" — legacy escalation_rate set to 0. See escalation_detail for the full clause.`,
  }
}

export async function POST(req: NextRequest) {
  const profile = await getProfile()
  if (!profile || !canEdit(profile)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }
  if (!profile.organization_id) {
    return NextResponse.json({ error: 'No organization on profile' }, { status: 403 })
  }

  let payload: Sam2SyncPayload
  try {
    payload = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!payload.siteId || !payload.agreementId || !payload.documentId || !payload.extractedData?.siteIdentity) {
    return NextResponse.json({ error: 'siteId, agreementId, documentId, and extractedData.siteIdentity are required' }, { status: 400 })
  }

  const supabase = getSupabase()
  const actor = await getActorInfo()
  const warnings: string[] = []
  // siteIdentity/leaseTerms/documentMetadata/oneTimeFees/geocode all live
  // under extractedData, not top-level on the payload — see lib/sam2Types.ts.
  const ed = payload.extractedData

  try {
    // ── 1. Resolve or create the site ──────────────────────────────────────
    const { data: existingSite } = await supabase
      .from('tower_sites')
      .select('id')
      .eq('sam2_site_id', payload.siteId)
      .maybeSingle()

    let siteId: string
    let hostAgencyResult = { matched: false, confidence: 'none', id: null as string | null, suggestedName: null as string | null }

    const agencyMatch = await matchHostAgency(supabase, ed.siteIdentity.lessorName)
    if (agencyMatch.confidence === 'exact' || agencyMatch.confidence === 'high') {
      hostAgencyResult = { matched: true, confidence: agencyMatch.confidence, id: agencyMatch.id, suggestedName: agencyMatch.matchedName }
    } else if (agencyMatch.confidence === 'low') {
      hostAgencyResult = { matched: false, confidence: 'low', id: null, suggestedName: agencyMatch.matchedName }
      warnings.push(`Site owner "${ed.siteIdentity.lessorName}" not confidently matched — closest existing match is "${agencyMatch.matchedName}". Left unlinked for manual review.`)
    } else {
      warnings.push(`Site owner "${ed.siteIdentity.lessorName}" has no matching record — site created without a linked owner.`)
    }

    // Tower type: installationType IS the tower_type value now (6 SCETV types,
    // sent directly — no separate towerType field). Null means the document
    // didn't state it (zero-hallucination extraction), so default with a
    // warning rather than guess.
    let towerType = ed.siteIdentity.installationType
    if (!towerType) {
      towerType = 'small_cell'
      warnings.push(`Tower type not stated in the document — defaulted to "${towerType}". Needs manual confirmation.`)
    }

    // City/state/zip come from SAM 2.0's geocoding service (extractedData.geocode),
    // not from document extraction (extractedData.siteIdentity) — siteIdentity's
    // versions are kept only as a fallback in case a future extraction path
    // populates them directly.
    const siteData = {
      site_code: ed.siteIdentity.siteCode || payload.siteId.slice(0, 12),
      name: ed.siteIdentity.siteName || ed.siteIdentity.rawAddress,
      address: ed.siteIdentity.rawAddress,
      city: ed.geocode?.city || ed.siteIdentity.city || '',
      state: ed.geocode?.state || ed.siteIdentity.state || '',
      zip: ed.geocode?.postalCode || ed.siteIdentity.zip || '',
      lat: ed.geocode?.latitude ?? 0,
      lng: ed.geocode?.longitude ?? 0,
      host_agency_id: hostAgencyResult.id,
      tower_type: towerType,
      height_ft: ed.siteIdentity.heightFt ?? null,
      status: 'operational',
      organization_id: profile.organization_id,
      sam2_site_id: payload.siteId,
    }

    if (!siteData.city || !siteData.state || !siteData.zip) {
      warnings.push('City/state/zip not available from SAM 2.0 geocoding — left blank. Needs manual entry or address-parsing follow-up.')
    }

    if (existingSite) {
      siteId = existingSite.id
      const { error } = await supabase.from('tower_sites').update(siteData).eq('id', siteId)
      if (error) throw new Error(`tower_sites update failed: ${error.message}`)
    } else {
      const { data: inserted, error } = await supabase.from('tower_sites').insert([siteData]).select('id').single()
      if (error) throw new Error(`tower_sites insert failed: ${error.message}`)
      siteId = inserted.id
      await logChange(supabase, siteId, 'site_created', null, `${siteData.name} (via SAM 2.0)`, actor.name, {
        userId: actor.userId, ip: actor.ip, entityType: 'site',
      })
    }

    // ── 2. Resolve or create the licensee ──────────────────────────────────
    let licenseeId: string
    let licenseeCreated = false
    const lesseeMatch = await matchLicensee(supabase, ed.siteIdentity.lesseeName)
    if (lesseeMatch.confidence === 'exact' || lesseeMatch.confidence === 'high') {
      licenseeId = lesseeMatch.id!
    } else {
      // Unlike host agencies, new carriers showing up is the normal case — auto-create
      // rather than block the sync, but flag it since a low-confidence match might
      // actually be an existing carrier under a slightly different extracted name.
      if (lesseeMatch.confidence === 'low') {
        warnings.push(`Licensee "${ed.siteIdentity.lesseeName}" not confidently matched (closest: "${lesseeMatch.matchedName}") — created as a new record. Review for a possible duplicate.`)
      }
      const { data: newLicensee, error } = await supabase
        .from('licensees')
        .insert([{ name: ed.siteIdentity.lesseeName, status: 'active' }])
        .select('id')
        .single()
      if (error) throw new Error(`licensees insert failed: ${error.message}`)
      licenseeId = newLicensee.id
      licenseeCreated = true
    }

    // ── 3. Upsert the document ──────────────────────────────────────────────
    const docType = DOC_TYPE_MAP[ed.documentMetadata.docType] ?? 'other'
    const extractedTerms: Record<string, unknown> = {
      licensor: { value: ed.siteIdentity.lessorName, confidence: 'high' },
      licensee: { value: ed.siteIdentity.lesseeName, confidence: 'high' },
      commencement_date: { value: ed.documentMetadata.commencementDate ?? null, confidence: ed.documentMetadata.commencementDate ? 'high' : 'low' },
      monthly_rent: ed.leaseTerms ? { value: ed.leaseTerms.baseRent, confidence: 'high' } : undefined,
      initial_term_years: ed.leaseTerms ? { value: Math.round(ed.leaseTerms.initialTermMonths / 12), confidence: 'high' } : undefined,
      // Full SAM 2.0 payload kept verbatim for anything the flat fields above can't
      // represent — amendment deltas, classification, lineage, validation flags, etc.
      // This is what lib/rentEngine/adapter.ts reads back out.
      _sam2_raw: payload,
    }

    const { data: existingDoc } = await supabase
      .from('site_documents')
      .select('id')
      .eq('sam2_doc_id', payload.documentId)
      .maybeSingle()

    let documentId: string
    const docRow = {
      site_id: siteId,
      name: payload.fileName,
      doc_type: docType,
      extracted_terms: extractedTerms,
      sam2_doc_id: payload.documentId,
    }
    if (existingDoc) {
      documentId = existingDoc.id
      const { error } = await supabase.from('site_documents').update(docRow).eq('id', documentId)
      if (error) throw new Error(`site_documents update failed: ${error.message}`)
    } else {
      const { data: inserted, error } = await supabase
        .from('site_documents')
        .insert([{ ...docRow, uploaded_by: actor.name, uploaded_at: new Date().toISOString(), file_size_kb: 0 }])
        .select('id')
        .single()
      if (error) throw new Error(`site_documents insert failed: ${error.message}`)
      documentId = inserted.id
    }

    // ── 4. Upsert the license/agreement ─────────────────────────────────────
    const { rate: escalationRate, warning: escalationWarning } = simplifyEscalationRate(ed.leaseTerms)
    if (escalationWarning) warnings.push(escalationWarning)

    const { data: existingLicense } = await supabase
      .from('site_licenses')
      .select('id')
      .eq('sam2_agreement_id', payload.agreementId)
      .maybeSingle()

    const licenseRow = {
      site_id: siteId,
      licensee_id: licenseeId,
      annual_rent: computeAnnualRent(ed.leaseTerms),
      escalation_rate: escalationRate,
      escalation_detail: ed.leaseTerms?.escalation ?? null,
      renewal_detail: ed.leaseTerms?.renewalOptions ?? null,
      one_time_fees: ed.oneTimeFees ?? null,
      license_start: ed.documentMetadata.commencementDate || ed.documentMetadata.effectiveDate || ed.documentMetadata.executionDate,
      license_end: ed.leaseTerms?.expirationDate ?? null,
      status: 'active',
      document_id: documentId,
      sam2_agreement_id: payload.agreementId,
    }

    let licenseId: string
    if (existingLicense) {
      licenseId = existingLicense.id
      const { error } = await supabase.from('site_licenses').update(licenseRow).eq('id', licenseId)
      if (error) throw new Error(`site_licenses update failed: ${error.message}`)
    } else {
      const { data: inserted, error } = await supabase
        .from('site_licenses')
        .insert([{ ...licenseRow, contract_type: 'Base Agreement', invoice_method: 'None', mount_type: 'Primary' }])
        .select('id')
        .single()
      if (error) throw new Error(`site_licenses insert failed: ${error.message}`)
      licenseId = inserted.id
      await logChange(supabase, siteId, 'license_added', null, `${ed.siteIdentity.lesseeName} (via SAM 2.0)`, actor.name, {
        userId: actor.userId, ip: actor.ip, entityType: 'site',
      })
    }

    // Link this document back to its agreement, now that the license row is
    // resolved. This is what lets the rent engine pull the full document
    // chain (base agreement through every amendment) for one lease — see
    // supabase/rent_engine_schema.sql.
    const { error: linkError } = await supabase
      .from('site_documents')
      .update({ license_id: licenseId })
      .eq('id', documentId)
    if (linkError) warnings.push(`Document synced but could not be linked to its agreement: ${linkError.message}`)

    const result: Sam2SyncResult = {
      siteId,
      licenseId,
      documentId,
      hostAgency: hostAgencyResult,
      licensee: { matched: !licenseeCreated, confidence: lesseeMatch.confidence, id: licenseeId, created: licenseeCreated },
      warnings,
    }
    return NextResponse.json(result)
  } catch (err: any) {
    console.error('[sam2/sync] failed:', err?.message ?? err)
    return NextResponse.json({ error: err?.message ?? 'Sync failed' }, { status: 500 })
  }
}
