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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; extId: string }> }
) {
  const { id, extId } = await params
  const supabase = await getClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { approve, ...fields } = body

  const patch: Record<string, any> = { ...fields, updated_at: new Date().toISOString() }
  if (approve) {
    patch.status = 'approved'
    patch.approved_by = user.id
    patch.approved_at = new Date().toISOString()
  }

  const { data, error } = await supabase
    .from('external_comparables').update(patch).eq('id', extId).eq('site_id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (approve) {
    const actor = await getActorInfo()
    const audit = getAuditClient()
    await logChange(audit, id, 'comparable_approved', 'pending', 'approved', actor.name,
      { userId: actor.userId, ip: actor.ip, entityType: 'site' })
  }

  return NextResponse.json({ comparable: data })
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; extId: string }> }
) {
  const { id, extId } = await params
  const supabase = await getClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await supabase
    .from('external_comparables').delete().eq('id', extId).eq('site_id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const actor = await getActorInfo()
  const audit = getAuditClient()
  await logChange(audit, id, 'comparable_deleted', extId, null, actor.name,
    { userId: actor.userId, ip: actor.ip, entityType: 'site' })

  return NextResponse.json({ success: true })
}
