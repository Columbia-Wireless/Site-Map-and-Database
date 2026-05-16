export const dynamic = 'force-dynamic'

import { getSupabase } from '@/lib/supabase'
import { getProfile, canExport } from '@/lib/profile'
import SitePortfolio from '@/components/sites/SitePortfolio'

export default async function SitesPage() {
  const supabase = getSupabase()
  const [{ data: sites }, { data: owners }, profile] = await Promise.all([
    supabase
      .from('tower_sites')
      .select('*, state_agencies(id, name), site_licenses(id, licensee_id, annual_rent, license_end, status, licensees(name))')
      .order('site_code', { ascending: true }),
    supabase.from('state_agencies').select('id, name').eq('status', 'active').order('name'),
    getProfile(),
  ])

  return <SitePortfolio initialSites={(sites ?? []) as any} owners={owners ?? []} showExport={canExport(profile)} />
}
