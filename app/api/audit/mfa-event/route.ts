import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getActorInfo, logChange, getAuditClient } from '@/lib/audit'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://vfntpdpneusqgcwxwkix.supabase.co'
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZmbnRwZHBuZXVzcWdjd3h3a2l4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5NTg2MzEsImV4cCI6MjA5MzUzNDYzMX0.kFZ6b2WKAl7GVsEQZeO33qcxhyBruQlTfW0eZfkcg1c'

const ALLOWED_EVENTS = ['mfa_enrolled', 'mfa_unenrolled', 'mfa_challenge_success'] as const
type MFAEvent = typeof ALLOWED_EVENTS[number]

/** POST /api/audit/mfa-event — log a client-side MFA event for the authenticated user */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll() {},
      },
    })

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { event } = await request.json() as { event: MFAEvent }
    if (!ALLOWED_EVENTS.includes(event)) {
      return NextResponse.json({ error: 'Invalid event' }, { status: 400 })
    }

    const actor = await getActorInfo()
    const audit = getAuditClient()
    await logChange(audit, null, event, null, user.email ?? user.id, actor.name, {
      userId: user.id, ip: actor.ip, entityType: 'auth',
    })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Failed' }, { status: 500 })
  }
}
