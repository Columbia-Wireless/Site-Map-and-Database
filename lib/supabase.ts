import { createClient, SupabaseClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://vfntpdpneusqgcwxwkix.supabase.co'
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZmbnRwZHBuZXVzcWdjd3h3a2l4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5NTg2MzEsImV4cCI6MjA5MzUzNDYzMX0.kFZ6b2WKAl7GVsEQZeO33qcxhyBruQlTfW0eZfkcg1c'
// Service role key — set in Cloud Run env vars. Bypasses RLS for server-side
// data fetching. Never exposed to the browser (not NEXT_PUBLIC_).
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

let _client: SupabaseClient | null = null

/**
 * Server-side Supabase client for use in page components and API routes.
 * Uses the service role key when available (bypasses RLS — safe because
 * all server paths are already protected by middleware + RBAC).
 * Falls back to anon key in local dev where SERVICE_ROLE_KEY isn't set.
 */
export function getSupabase(): SupabaseClient {
  if (!_client) {
    const key = SERVICE_ROLE_KEY || SUPABASE_ANON_KEY
    _client = createClient(SUPABASE_URL, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  }
  return _client
}

export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    return (getSupabase() as any)[prop]
  },
})

export function getServiceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase service role env vars not set')
  return createClient(url, key)
}
