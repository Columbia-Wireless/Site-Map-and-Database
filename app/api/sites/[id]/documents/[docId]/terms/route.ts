import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { logDocEvent, getCallerName } from '@/lib/logDocEvent'

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://vfntpdpneusqgcwxwkix.supabase.co'
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZmbnRwZHBuZXVzcWdjd3h3a2l4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5NTg2MzEsImV4cCI6MjA5MzUzNDYzMX0.kFZ6b2WKAl7GVsEQZeO33qcxhyBruQlTfW0eZfkcg1c'
  return createClient(url, key)
}

const CRITICAL_FIELDS = ['licensor', 'licensee', 'commencement_date', 'monthly_rent', 'initial_term_years', 'governing_law']

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  const { id: siteId, docId } = await params
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
  }

  return NextResponse.json(updated)
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
