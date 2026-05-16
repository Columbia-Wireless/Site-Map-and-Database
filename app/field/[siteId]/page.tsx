import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { redirect, notFound } from 'next/navigation'
import SurveyClient from '@/components/field/SurveyClient'
import { getProfile, hasRole } from '@/lib/profile'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://vfntpdpneusqgcwxwkix.supabase.co'
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZmbnRwZHBuZXVzcWdjd3h3a2l4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5NTg2MzEsImV4cCI6MjA5MzUzNDYzMX0.kFZ6b2WKAl7GVsEQZeO33qcxhyBruQlTfW0eZfkcg1c'

export const dynamic = 'force-dynamic'

export default async function FieldSitePage({
  params,
}: {
  params: Promise<{ siteId: string }>
}) {
  const { siteId } = await params
  const cookieStore = await cookies()
  const supabase = createServerClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    { cookies: { getAll: () => cookieStore.getAll() } }
  )

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/login')

  const { data: site } = await supabase
    .from('tower_sites')
    .select('id, site_code, name, address, city, state, zip, lat, lng, tower_type, height_ft, status, county, tenant_slots')
    .eq('id', siteId)
    .single()

  if (!site) notFound()

  // Fetch in-progress survey for this user+site, or most recent completed
  const { data: existingSurvey } = await supabase
    .from('site_surveys')
    .select('*')
    .eq('site_id', siteId)
    .eq('surveyor_id', session.user.id)
    .eq('status', 'in_progress')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  // Fetch active tenants for context
  const { data: activeTenants } = await supabase
    .from('site_licenses')
    .select('id, status, mount_type, antenna_height_ft, licensees(name)')
    .eq('site_id', siteId)
    .in('status', ['active', 'pending', 'expiring_soon'])
    .order('antenna_height_ft', { ascending: false })

  // Fetch equipment inventory for reference in the survey
  const { data: equipmentItems } = await supabase
    .from('equipment_items')
    .select('*, site_licenses(id, licensees(id, name))')
    .eq('site_id', siteId)
    .order('created_at', { ascending: true })

  // Fetch photos for this site
  const { data: photos } = await supabase
    .from('site_photos')
    .select('*')
    .eq('site_id', siteId)
    .order('created_at', { ascending: false })

  const userName = session.user.user_metadata?.full_name || session.user.email || 'Field User'
  const profile = await getProfile()
  const isAdminPreview = hasRole(profile, 'admin')

  return (
    <SurveyClient
      site={site}
      existingSurvey={existingSurvey ?? null}
      existingPhotos={photos ?? []}
      activeTenants={(activeTenants ?? []) as any[]}
      equipmentItems={(equipmentItems ?? []) as any[]}
      userId={session.user.id}
      userName={userName}
      isAdminPreview={isAdminPreview}
      userRole={profile?.role ?? null}
    />
  )
}
