import { cookies, headers } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { SupabaseClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://vfntpdpneusqgcwxwkix.supabase.co'
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZmbnRwZHBuZXVzcWdjd3h3a2l4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5NTg2MzEsImV4cCI6MjA5MzUzNDYzMX0.kFZ6b2WKAl7GVsEQZeO33qcxhyBruQlTfW0eZfkcg1c'

export interface ActorInfo {
  name: string
  userId: string | null
  ip: string
}

/** Resolve the calling user's display name, UUID, and IP from the current request. */
export async function getActorInfo(): Promise<ActorInfo> {
  try {
    const cookieStore = await cookies()
    const headerStore = await headers()

    const ip =
      headerStore.get('x-forwarded-for')?.split(',')[0].trim() ||
      headerStore.get('x-real-ip') ||
      'unknown'

    const sb = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      cookies: { getAll() { return cookieStore.getAll() }, setAll() {} },
    })

    const { data: { session } } = await sb.auth.getSession()
    if (!session?.user) return { name: 'System', userId: null, ip }

    const user = session.user
    const { data } = await sb.from('profiles').select('full_name').eq('id', user.id).single()
    const name = data?.full_name || user.email || 'User'

    return { name, userId: user.id, ip }
  } catch {
    return { name: 'System', userId: null, ip: 'unknown' }
  }
}

/** Backwards-compatible wrapper for legacy call sites that only need the name. */
export async function getActorName(): Promise<string> {
  return (await getActorInfo()).name
}

export async function logChange(
  supabase: SupabaseClient,
  siteId: string | null,
  fieldName: string,
  oldValue: string | null,
  newValue: string | null,
  actor: string,
  opts?: { userId?: string | null; ip?: string; entityType?: string },
) {
  await supabase.from('site_change_log').insert([{
    site_id:     siteId,
    entity_type: opts?.entityType ?? (siteId ? 'site' : 'system'),
    field_name:  fieldName,
    old_value:   oldValue,
    new_value:   newValue,
    changed_by:  actor,
    user_id:     opts?.userId ?? null,
    ip_address:  opts?.ip ?? null,
    changed_at:  new Date().toISOString(),
  }])
}

/** Convenience: log an auth / user-management event (no site_id). */
export async function logAuthEvent(
  supabase: SupabaseClient,
  eventName: string,
  detail: string | null,
  actor: ActorInfo,
) {
  await logChange(supabase, null, eventName, null, detail, actor.name, {
    userId: actor.userId,
    ip: actor.ip,
    entityType: 'auth',
  })
}
