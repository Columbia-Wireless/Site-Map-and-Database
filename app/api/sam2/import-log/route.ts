import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'
import { getProfile } from '@/lib/profile'

/**
 * Recent SAM 2.0 import history — one row per document sync attempt, see
 * supabase/sam2_import_log.sql. Backs the "Recent Imports" panel in
 * Sam2ImportModal.tsx, which otherwise loses all history the moment the
 * modal closes.
 */
export async function GET(req: NextRequest) {
  const profile = await getProfile()
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!profile.organization_id) return NextResponse.json({ error: 'No organization on profile' }, { status: 403 })

  const limit = Math.min(Number(req.nextUrl.searchParams.get('limit')) || 25, 100)
  const supabase = getSupabase()

  const { data, error } = await supabase
    .from('sam2_import_log')
    .select('id, occurred_at, file_name, site_id, document_id, outcome, warnings, error_message, actor_name, tower_sites(name)')
    .eq('organization_id', profile.organization_id)
    .order('occurred_at', { ascending: false })
    .limit(limit)

  if (error) {
    // Table may not exist yet if the migration (supabase/sam2_import_log.sql)
    // hasn't been run — degrade to an empty history rather than a hard error,
    // this panel is a convenience, not load-bearing.
    console.error('[sam2/import-log] read failed:', error.message)
    return NextResponse.json({ entries: [] })
  }

  return NextResponse.json({ entries: data ?? [] })
}
