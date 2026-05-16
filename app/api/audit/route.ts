import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://vfntpdpneusqgcwxwkix.supabase.co'
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZmbnRwZHBuZXVzcWdjd3h3a2l4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5NTg2MzEsImV4cCI6MjA5MzUzNDYzMX0.kFZ6b2WKAl7GVsEQZeO33qcxhyBruQlTfW0eZfkcg1c'

/**
 * GET /api/audit
 * Query parameters:
 *   entity_type  — filter by 'site' | 'auth' | 'system' (optional)
 *   entity_id    — filter by site_id UUID (optional)
 *   user_id      — filter by user UUID (optional)
 *   from         — ISO date string, inclusive lower bound on changed_at (optional)
 *   to           — ISO date string, inclusive upper bound on changed_at (optional)
 *   limit        — max records, default 200, max 1000 (optional)
 *   offset       — pagination offset, default 0 (optional)
 *
 * Requires: admin or super_admin role
 */
export async function GET(request: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: { getAll() { return cookieStore.getAll() }, setAll() {} },
  })

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', session.user.id).single()

  const ROLE_RANK: Record<string, number> = {
    super_admin: 5, admin: 4, editor: 3, reporter: 2, viewer: 1,
  }
  if (!profile || (ROLE_RANK[profile.role] ?? 0) < 4) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const p = request.nextUrl.searchParams
  const limit  = Math.min(parseInt(p.get('limit')  ?? '200'), 1000)
  const offset = parseInt(p.get('offset') ?? '0')

  let query = supabase
    .from('site_change_log')
    .select('id, site_id, entity_type, field_name, old_value, new_value, changed_by, user_id, ip_address, changed_at', { count: 'exact' })
    .order('changed_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (p.get('entity_type')) query = query.eq('entity_type', p.get('entity_type')!)
  if (p.get('entity_id'))   query = query.eq('site_id', p.get('entity_id')!)
  if (p.get('user_id'))     query = query.eq('user_id', p.get('user_id')!)
  if (p.get('from'))        query = query.gte('changed_at', p.get('from')!)
  if (p.get('to'))          query = query.lte('changed_at', p.get('to')!)

  const { data, error, count } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    records: data ?? [],
    total: count ?? 0,
    limit,
    offset,
  })
}
