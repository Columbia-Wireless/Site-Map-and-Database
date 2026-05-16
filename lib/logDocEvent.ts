import { SupabaseClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { NextRequest } from 'next/server'

const SUPABASE_URL     = process.env.NEXT_PUBLIC_SUPABASE_URL     || 'https://vfntpdpneusqgcwxwkix.supabase.co'
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZmbnRwZHBuZXVzcWdjd3h3a2l4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5NTg2MzEsImV4cCI6MjA5MzUzNDYzMX0.kFZ6b2WKAl7GVsEQZeO33qcxhyBruQlTfW0eZfkcg1c'

export type DocEventType =
  | 'uploaded'
  | 'terms_extracted'
  | 'field_edited'
  | 'approved'
  | 'notarized'

/**
 * Reads the caller's display name from the auth session cookie on the request.
 * Falls back to 'CWF Admin' if unauthenticated or session is unavailable.
 */
export async function getCallerName(request: NextRequest): Promise<string> {
  try {
    const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll() {},
      },
    })
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return 'CWF Admin'
    return (
      user.user_metadata?.full_name ??
      user.user_metadata?.name ??
      user.email ??
      'CWF Admin'
    )
  } catch {
    return 'CWF Admin'
  }
}

/**
 * Appends one row to document_events.
 * Uses fire-and-forget — errors are swallowed so they never break the main operation.
 */
export async function logDocEvent(
  supabase: SupabaseClient,
  documentId: string,
  eventType: DocEventType,
  userName: string,
  details: Record<string, any> = {},
): Promise<void> {
  try {
    await supabase.from('document_events').insert({
      document_id: documentId,
      event_type:  eventType,
      user_name:   userName,
      details,
    })
  } catch (err) {
    console.error('[logDocEvent] Failed to log event:', err)
  }
}
