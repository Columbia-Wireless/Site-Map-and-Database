import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getProfile } from '@/lib/profile'
import { getActorInfo, logChange, getAuditClient } from '@/lib/audit'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://vfntpdpneusqgcwxwkix.supabase.co'
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

function getAdminClient() {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

/**
 * PATCH /api/profile — update the signed-in user's own display name.
 * Self-service only: scoped to the caller's own profile row, no admin
 * role required. (Admins set an initial name at invite time via
 * /api/admin/users; this is how a user changes it themselves afterward.)
 */
export async function PATCH(request: NextRequest) {
  const profile = await getProfile()
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const full_name = typeof body?.full_name === 'string' ? body.full_name.trim() : ''
  if (!full_name) {
    return NextResponse.json({ error: 'Name cannot be empty' }, { status: 400 })
  }
  if (full_name.length > 200) {
    return NextResponse.json({ error: 'Name is too long' }, { status: 400 })
  }

  const admin = getAdminClient()
  const { error } = await admin.from('profiles').update({ full_name }).eq('id', profile.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const actor = await getActorInfo()
  await logChange(getAuditClient(), null, 'user_name_changed', profile.full_name, full_name, actor.name, {
    userId: profile.id, ip: actor.ip, entityType: 'auth',
  })

  return NextResponse.json({ success: true, full_name })
}
