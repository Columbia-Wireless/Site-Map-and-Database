import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { logDocEvent, getCallerName } from '@/lib/logDocEvent'

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://vfntpdpneusqgcwxwkix.supabase.co'
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZmbnRwZHBuZXVzcWdjd3h3a2l4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5NTg2MzEsImV4cCI6MjA5MzUzNDYzMX0.kFZ6b2WKAl7GVsEQZeO33qcxhyBruQlTfW0eZfkcg1c'
  return createClient(url, key)
}

// Fields that must be present for a lease to be considered fully extracted
const CRITICAL_FIELDS = [
  'licensor', 'licensee', 'commencement_date',
  'monthly_rent', 'initial_term_years', 'governing_law',
]

const EXTRACTION_PROMPT = `You are a legal document analyst specializing in cell tower lease agreements and telecommunications site licenses.

Extract the following key terms from this lease/license agreement.

Return a JSON object where EVERY field has this exact structure:
{
  "value": <the extracted value, or null if not found>,
  "confidence": "high" | "medium" | "low",
  "note": <brief explanation only for medium or low confidence, otherwise omit>
}

Use these confidence levels:
- "high": value clearly stated in the document
- "medium": value inferred, ambiguous, or hand-written and potentially unclear
- "low": value not found or document is unclear

Return an object with exactly these top-level keys:

{
  "licensor": { ... },
  "licensee": { ... },
  "site_id": { ... },
  "premises_address": { ... },
  "premises_description": { ... },
  "commencement_date": { ... },
  "initial_term_years": { ... },
  "renewal_options": { ... },
  "monthly_rent": { ... },
  "annual_rent": { ... },
  "escalation_rate": { ... },
  "escalation_type": { ... },
  "permitted_use": { ... },
  "equipment_description": { ... },
  "insurance_liability": { ... },
  "governing_law": { ... },
  "termination_notice_days": { ... },
  "assignment_allowed": { ... },
  "notes": { ... }
}

For commencement_date: use ISO format YYYY-MM-DD if determinable.
For monthly_rent, annual_rent, escalation_rate, termination_notice_days, insurance_liability: numbers only, no $ or % symbols.
For assignment_allowed: "yes", "no", or "conditional".

Return ONLY the JSON object, no explanation or markdown formatting.`

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  const { id: siteId, docId } = await params
  const supabase = getSupabaseAdmin()
  const userName = await getCallerName(req)

  const { data: doc, error: docErr } = await supabase
    .from('site_documents')
    .select('*')
    .eq('id', docId)
    .eq('site_id', siteId)
    .single()

  if (docErr || !doc) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 })
  }

  await supabase.from('site_documents').update({ doc_status: 'extracting' }).eq('id', docId)

  try {
    const { data: fileData, error: downloadErr } = await supabase.storage
      .from('lease-documents')
      .download(doc.storage_path)

    if (downloadErr || !fileData) {
      throw new Error('Failed to download document: ' + (downloadErr?.message ?? 'unknown'))
    }

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not configured')

    const buffer = Buffer.from(await fileData.arrayBuffer())
    const base64Data = buffer.toString('base64')
    // Check storage_path for extension (doc.name is a display label, may have no extension)
    const pathExt = (doc.storage_path ?? doc.name).split('.').pop()?.toLowerCase()
    const isPDF = pathExt === 'pdf'
    const mediaType = isPDF ? 'application/pdf'
      : pathExt === 'jpg' || pathExt === 'jpeg' ? 'image/jpeg'
      : 'image/png'

    const { default: Anthropic } = await import('@anthropic-ai/sdk')
    const anthropic = new Anthropic({ apiKey })

    // PDF size guard: base64 of >32MB PDFs exceeds API limits — truncate to first 20MB raw
    const MAX_PDF_BYTES = 20 * 1024 * 1024
    const finalBuffer = isPDF && buffer.length > MAX_PDF_BYTES ? buffer.subarray(0, MAX_PDF_BYTES) : buffer
    const finalBase64 = finalBuffer.toString('base64')

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 3000,
      messages: [{
        role: 'user',
        content: isPDF ? [
          { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: finalBase64 } } as any,
          { type: 'text', text: EXTRACTION_PROMPT },
        ] : [
          { type: 'image', source: { type: 'base64', media_type: mediaType as 'image/jpeg' | 'image/png', data: finalBase64 } },
          { type: 'text', text: EXTRACTION_PROMPT },
        ],
      }],
    })

    const raw = message.content[0].type === 'text' ? message.content[0].text : ''
    const extractedTerms = parseExtractedJSON(raw)

    // Address cross-check: compare site address against extracted premises_address
    const { data: site } = await supabase
      .from('tower_sites')
      .select('address, city, state, zip')
      .eq('id', siteId)
      .single()

    if (site) {
      const siteAddress = [site.address, site.city, site.state, site.zip].filter(Boolean).join(', ')
      const leaseAddress = extractedTerms.premises_address?.value ?? extractedTerms.premises_address ?? ''
      const mismatch = leaseAddress && !addressesMatch(siteAddress, String(leaseAddress))
      extractedTerms._address_check = {
        site_address: siteAddress,
        extracted_address: String(leaseAddress) || null,
        mismatch: !!mismatch,
        accepted: false,
      }
    }

    // Compute doc status from confidence levels
    const docStatus = computeDocStatus(extractedTerms)

    const { data: updated, error: updateErr } = await supabase
      .from('site_documents')
      .update({ extracted_terms: extractedTerms, doc_status: docStatus })
      .eq('id', docId)
      .select()
      .single()

    if (updateErr) throw new Error('Failed to save extracted terms: ' + updateErr.message)

    // Count extracted fields and flags
    const fieldKeys = Object.keys(extractedTerms).filter(k => !k.startsWith('_'))
    const flagCount = fieldKeys.filter(k => {
      const v = extractedTerms[k]
      const c = typeof v === 'object' && v !== null ? (v.confidence ?? 'low') : (v ? 'high' : 'low')
      return c === 'medium' || c === 'low'
    }).length
    await logDocEvent(supabase, docId, 'terms_extracted', userName, {
      field_count: fieldKeys.length,
      flag_count:  flagCount,
      doc_status:  docStatus,
    })

    return NextResponse.json(updated)

  } catch (err: any) {
    await supabase.from('site_documents').update({ doc_status: 'review_required' }).eq('id', docId)
    return NextResponse.json({ error: err.message ?? 'Extraction failed' }, { status: 500 })
  }
}

function computeDocStatus(terms: Record<string, any>): string {
  // Unaccepted address mismatch → review_required
  const ac = terms._address_check
  if (ac && ac.mismatch && !ac.accepted) return 'review_required'
  // Any critical field missing or low confidence → review_required
  for (const field of CRITICAL_FIELDS) {
    const t = terms[field]
    if (!t || !t.value || t.confidence === 'low') return 'review_required'
  }
  // Any field medium confidence → review_required
  for (const [key, t] of Object.entries(terms)) {
    if (!key.startsWith('_') && t && (t as any).confidence === 'medium') return 'review_required'
  }
  return 'extracted'
}

// Normalise address strings and check if they refer to the same location.
// Checks whether key tokens (street number + first word of street name) appear in both.
function addressesMatch(a: string, b: string): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
  const na = norm(a)
  const nb = norm(b)
  // If either contains the other it's a match
  if (na.includes(nb) || nb.includes(na)) return true
  // Extract street number and first street word from each and compare
  const tokens = (s: string) => s.split(' ').slice(0, 3)
  const ta = tokens(na)
  const tb = tokens(nb)
  return ta.some(t => t.length > 1 && tb.includes(t))
}

function parseExtractedJSON(raw: string): Record<string, any> {
  const cleaned = raw.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim()
  try {
    return JSON.parse(cleaned)
  } catch {
    return { _raw: { value: raw.slice(0, 500), confidence: 'low', note: 'Could not parse Claude response' } }
  }
}
