import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { getActorInfo, logChange } from '@/lib/audit'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://vfntpdpneusqgcwxwkix.supabase.co'
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZmbnRwZHBuZXVzcWdjd3h3a2l4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5NTg2MzEsImV4cCI6MjA5MzUzNDYzMX0.kFZ6b2WKAl7GVsEQZeO33qcxhyBruQlTfW0eZfkcg1c'
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

function getAdminClient() {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

async function getCallerProfile(request: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() { return cookieStore.getAll() },
      setAll() {},
    },
  })
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('id', user.id)
    .single()

  return profile
}

const ROLE_RANK: Record<string, number> = {
  super_admin: 5, admin: 4, editor: 3, reporter: 2, viewer: 1,
}

/** GET /api/admin/users — list users with emails */
export async function GET(request: NextRequest) {
  try {
    const profile = await getCallerProfile(request)
    if (!profile || ROLE_RANK[profile.role] < 4) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const admin = getAdminClient()
    const { data: { users }, error } = await admin.auth.admin.listUsers()
    if (error) throw error

    return NextResponse.json({ users: users.map(u => ({ id: u.id, email: u.email })) })
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Failed' }, { status: 500 })
  }
}

/** POST /api/admin/users — invite a new user */
export async function POST(request: NextRequest) {
  try {
    const profile = await getCallerProfile(request)
    if (!profile || ROLE_RANK[profile.role] < 4) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { email, role, organization_id } = await request.json()
    if (!email || !role) {
      return NextResponse.json({ error: 'email and role are required' }, { status: 400 })
    }

    // Only super_admin can assign super_admin
    if (role === 'super_admin' && profile.role !== 'super_admin') {
      return NextResponse.json({ error: 'Only super_admin can grant super_admin' }, { status: 403 })
    }

    const admin = getAdminClient()

    // Send a proper invitation email — user clicks the link and sets their own password.
    // Supabase free tier allows up to 4 invite emails/hour via its built-in mail service.
    // redirectTo must be listed in Supabase Auth → URL Configuration → Redirect URLs.
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://tower-demo-461686768358.us-east1.run.app'
    console.log('[invite] calling inviteUserByEmail for', email, 'redirectTo:', siteUrl)
    const { data: invited, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo: siteUrl,
    })
    if (inviteErr) {
      console.error('[invite] inviteUserByEmail failed:', inviteErr.message, inviteErr)
      throw inviteErr
    }
    console.log('[invite] success, user id:', invited.user.id)

    // Set their profile role + org (the auth trigger creates the row; we upsert to set role/org)
    await admin.from('profiles').upsert({
      id: invited.user.id,
      role,
      organization_id: organization_id || null,
    })

    // Audit log
    const actor = await getActorInfo()
    await logChange(admin, null, 'user_invited', null, `${email} as ${role}`, actor.name, {
      userId: actor.userId, ip: actor.ip, entityType: 'auth',
    })

    return NextResponse.json({ success: true, id: invited.user.id })
  } catch (err: any) {
    console.error('[invite] POST /api/admin/users unhandled error:', err?.message, err)
    return NextResponse.json({ error: err.message ?? 'Failed' }, { status: 500 })
  }
}

/** PATCH /api/admin/users — update role or org */
export async function PATCH(request: NextRequest) {
  try {
    const profile = await getCallerProfile(request)
    if (!profile || ROLE_RANK[profile.role] < 4) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { id, role, organization_id, can_export } = await request.json()
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    if (role === 'super_admin' && profile.role !== 'super_admin') {
      return NextResponse.json({ error: 'Only super_admin can grant super_admin' }, { status: 403 })
    }

    const admin = getAdminClient()
    const patch: Record<string, any> = {}
    if (role !== undefined) patch.role = role
    if (organization_id !== undefined) patch.organization_id = organization_id
    if (can_export !== undefined) patch.can_export = can_export

    const { error } = await admin.from('profiles').update(patch).eq('id', id)
    if (error) throw error

    // Audit log each changed field
    const actor = await getActorInfo()
    for (const [field, value] of Object.entries(patch)) {
      await logChange(admin, null, `user_${field}_changed`, null, `${id}: ${value}`, actor.name, {
        userId: actor.userId, ip: actor.ip, entityType: 'auth',
      })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Failed' }, { status: 500 })
  }
}

/** DELETE /api/admin/users?id=xxx — remove user */
export async function DELETE(request: NextRequest) {
  try {
    const profile = await getCallerProfile(request)
    if (!profile || ROLE_RANK[profile.role] < 4) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const id = request.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    // Prevent self-delete
    if (id === profile.id) {
      return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 })
    }

    const admin = getAdminClient()

    // Fetch email before deleting so it appears in the audit record
    const { data: { user: target } } = await admin.auth.admin.getUserById(id)
    const targetEmail = target?.email ?? id

    const { error } = await admin.auth.admin.deleteUser(id)
    if (error) throw error

    const actor = await getActorInfo()
    await logChange(admin, null, 'user_deleted', targetEmail, null, actor.name, {
      userId: actor.userId, ip: actor.ip, entityType: 'auth',
    })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Failed' }, { status: 500 })
  }
}
