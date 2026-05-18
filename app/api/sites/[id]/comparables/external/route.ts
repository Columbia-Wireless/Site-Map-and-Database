import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getActorInfo, logChange, getAuditClient } from '@/lib/audit'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://vfntpdpneusqgcwxwkix.supabase.co'
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZmbnRwZHBuZXVzcWdjd3h3a2l4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5NTg2MzEsImV4cCI6MjA5MzUzNDYzMX0.kFZ6b2WKAl7GVsEQZeO33qcxhyBruQlTfW0eZfkcg1c'

async function getClient() {
  const cookieStore = await cookies()
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: { getAll() { return cookieStore.getAll() }, setAll() {} },
  })
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await getClient()
  const { data, error } = await supabase
    .from('external_comparables')
    .select('*')
    .eq('site_id', id)
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ comparables: data ?? [] })
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await getClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { approve, ...fields } = body

  const row: Record<string, any> = {
    site_id: id, created_by: user.id,
    ...fields,
    status: approve ? 'approved' : 'pending',
  }
  if (approve) { row.approved_by = user.id; row.approved_at = new Date().toISOString() }

  const { data, error } = await supabase.from('external_comparables').insert([row]).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Audit
  const actor = await getActorInfo()
  const audit = getAuditClient()
  await logChange(audit, id, approve ? 'comparable_approved' : 'comparable_added',
    null, data.site_name ?? 'External comparable', actor.name,
    { userId: actor.userId, ip: actor.ip, entityType: 'site' })

  return NextResponse.json({ comparable: data })
}
