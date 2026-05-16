import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { SupabaseClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://vfntpdpneusqgcwxwkix.supabase.co'
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZmbnRwZHBuZXVzcWdjd3h3a2l4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5NTg2MzEsImV4cCI6MjA5MzUzNDYzMX0.kFZ6b2WKAl7GVsEQZeO33qcxhyBruQlTfW0eZfkcg1c'

export async function getActorName(): Promise<string> {
  try {
    const cookieStore = await cookies()
    const sb = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      cookies: { getAll() { return cookieStore.getAll() }, setAll() {} },
    })
    const { data: { user } } = await sb.auth.getUser()
    if (!user) return 'System'
    const { data } = await sb.from('profiles').select('full_name').eq('id', user.id).single()
    return data?.full_name || user.email || 'User'
  } catch {
    return 'System'
  }
}

export async function logChange(
  supabase: SupabaseClient,
  siteId: string,
  fieldName: string,
  oldValue: string | null,
  newValue: string | null,
  actor: string,
) {
  await supabase.from('site_change_log').insert([{
    site_id: siteId,
    field_name: fieldName,
    old_value: oldValue,
    new_value: newValue,
    changed_by: actor,
    changed_at: new Date().toISOString(),
  }])
}
