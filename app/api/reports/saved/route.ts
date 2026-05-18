import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getActorInfo, logChange, getAuditClient } from '@/lib/audit'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://vfntpdpneusqgcwxwkix.supabase.co'
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZmbnRwZHBuZXVzcWdjd3h3a2l4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5NTg2MzEsImV4cCI6MjA5MzUzNDYzMX0.kFZ6b2WKAl7GVsEQZeO33qcxhyBruQlTfW0eZfkcg1c'

const ROLE_RANK: Record<string, number> = {
  super_admin: 5, admin: 4, editor: 3, reporter: 2, viewer: 1,
}

async function getClient() {
  const cookieStore = await cookies()
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: { getAll() { return cookieStore.getAll() }, setAll() {} },
  })
}

export async function GET() {
  const supabase = await getClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const rank = ROLE_RANK[profile?.role ?? ''] ?? 0

  const { data, error } = await supabase
    .from('saved_reports')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Filter to reports this role can see
  const visible = (data ?? []).filter(r => (ROLE_RANK[r.min_role] ?? 0) <= rank)
  return NextResponse.json({ reports: visible })
}

export async function POST(request: NextRequest) {
  const supabase = await getClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if ((ROLE_RANK[profile?.role ?? ''] ?? 0) < 4) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }

  const body = await request.json()
  const { name, description, data_source, columns, filters, sort_field, sort_dir, min_role } = body

  if (!name || !data_source || !columns?.length) {
    return NextResponse.json({ error: 'name, data_source, and columns are required' }, { status: 400 })
  }

  const { data, error } = await supabase.from('saved_reports').insert([{
    name, description, data_source, columns, filters: filters ?? [],
    sort_field: sort_field || null, sort_dir: sort_dir || 'asc',
    min_role: min_role || 'viewer', created_by: user.id,
  }]).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const actor = await getActorInfo()
  await logChange(getAuditClient(), data.id, 'report_created', null, name, actor.name,
    { userId: actor.userId, ip: actor.ip, entityType: 'report' })

  return NextResponse.json({ report: data })
}
