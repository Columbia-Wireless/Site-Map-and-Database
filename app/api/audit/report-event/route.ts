import { NextRequest, NextResponse } from 'next/server'
import { getActorInfo, logChange, getAuditClient } from '@/lib/audit'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://vfntpdpneusqgcwxwkix.supabase.co'
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZmbnRwZHBuZXVzcWdjd3h3a2l4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5NTg2MzEsImV4cCI6MjA5MzUzNDYzMX0.kFZ6b2WKAl7GVsEQZeO33qcxhyBruQlTfW0eZfkcg1c'

const ALLOWED_EVENTS = ['report_downloaded'] as const
type AllowedEvent = typeof ALLOWED_EVENTS[number]

export async function POST(request: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: { getAll() { return cookieStore.getAll() }, setAll() {} },
  })

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { event, reportId, reportName, rowCount } = await request.json()

  if (!ALLOWED_EVENTS.includes(event as AllowedEvent)) {
    return NextResponse.json({ error: 'Invalid event' }, { status: 400 })
  }

  const actor = await getActorInfo()
  const detail = rowCount != null ? `${reportName ?? 'unnamed'} (${rowCount} rows)` : (reportName ?? 'unnamed')

  await logChange(getAuditClient(), reportId ?? null, event, null, detail, actor.name,
    { userId: actor.userId, ip: actor.ip, entityType: 'report' })

  return NextResponse.json({ ok: true })
}
