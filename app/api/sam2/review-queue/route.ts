import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'
import { getProfile } from '@/lib/profile'
import { scopeFromProfile, getVisibleSiteIds } from '@/lib/orgScope'

/**
 * Portfolio-wide (or single-site, via ?siteId=) list of documents needing
 * review right now — the persistent queue this session's review-queue work
 * is built around. Deliberately a live query against site_documents.doc_status,
 * not a read of sam2_import_log (which is an immutable record of what
 * happened at sync time and never reflects a later approval).
 */
export async function GET(req: NextRequest) {
  const profile = await getProfile()
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const supabase = getSupabase()
  const scope = scopeFromProfile(profile)
  const siteIdFilter = req.nextUrl.searchParams.get('siteId')

  let query = supabase
    .from('site_documents')
    .select(`
      id, name, doc_type, doc_status, uploaded_by, uploaded_at, file_size_kb,
      file_hash, iota_block_id, iota_explorer_url, extracted_terms, site_id,
      tower_sites ( id, site_code, name )
    `)
    .eq('doc_status', 'review_required')
    .order('uploaded_at', { ascending: true })

  if (siteIdFilter) {
    query = query.eq('site_id', siteIdFilter)
  } else if (!scope.isPlatformAdmin) {
    const visibleSiteIds = await getVisibleSiteIds(scope)
    if (visibleSiteIds) query = query.in('site_id', visibleSiteIds)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json(data ?? [])
}
