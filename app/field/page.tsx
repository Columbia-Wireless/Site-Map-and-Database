import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import FieldSiteList from '@/components/field/FieldSiteList'
import { getProfile, hasRole } from '@/lib/profile'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://vfntpdpneusqgcwxwkix.supabase.co'
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZmbnRwZHBuZXVzcWdjd3h3a2l4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5NTg2MzEsImV4cCI6MjA5MzUzNDYzMX0.kFZ6b2WKAl7GVsEQZeO33qcxhyBruQlTfW0eZfkcg1c'

export const dynamic = 'force-dynamic'

export default async function FieldPage() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    { cookies: { getAll: () => cookieStore.getAll() } }
  )

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/login')

  const profile = await getProfile()
  const isAdminPreview = hasRole(profile, 'admin')

  const { data: sites } = await supabase
    .from('tower_sites')
    .select('id, site_code, name, address, city, state, lat, lng, tower_type, height_ft, status, tenant_slots')
    .order('name')

  // Last completed survey per site
  const { data: surveys } = await supabase
    .from('site_surveys')
    .select('site_id, completed_at, surveyor_name')
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })

  // Active tenant counts per site
  const { data: tenancyCounts } = await supabase
    .from('site_licenses')
    .select('site_id, status')
    .in('status', ['active', 'pending', 'expiring_soon'])

  const lastSurveyBySite: Record<string, { completed_at: string; surveyor_name: string }> = {}
  for (const s of surveys ?? []) {
    if (!lastSurveyBySite[s.site_id]) {
      lastSurveyBySite[s.site_id] = { completed_at: s.completed_at, surveyor_name: s.surveyor_name }
    }
  }

  const occupiedCountBySite: Record<string, number> = {}
  for (const t of tenancyCounts ?? []) {
    occupiedCountBySite[t.site_id] = (occupiedCountBySite[t.site_id] ?? 0) + 1
  }

  return (
    <FieldSiteList
      sites={sites ?? []}
      lastSurveyBySite={lastSurveyBySite}
      occupiedCountBySite={occupiedCountBySite}
      userName={session.user.user_metadata?.full_name || session.user.email || 'Field User'}
      isAdminPreview={isAdminPreview}
      userRole={profile?.role ?? null}
    />
  )
}
