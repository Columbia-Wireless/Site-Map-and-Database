export const dynamic = 'force-dynamic'

import { getSupabase } from '@/lib/supabase'
import { getProfile, canExport } from '@/lib/profile'
import { scopeFromProfile, scopeSitesQuery } from '@/lib/orgScope'
import SitePortfolio from '@/components/sites/SitePortfolio'

export default async function SitesPage() {
  const supabase = getSupabase()
  const profile = await getProfile()
  const scope = scopeFromProfile(profile)

  const [{ data: sites }, { data: owners }] = await Promise.all([
    scopeSitesQuery(
      supabase
        .from('tower_sites')
        .select('*, state_agencies(id, name), site_licenses(id, licensee_id, annual_rent, license_end, status, licensees(name))'),
      scope,
    ).order('site_code', { ascending: true }),
    supabase.from('state_agencies').select('id, name').eq('status', 'active').order('name'),
  ])

  return <SitePortfolio initialSites={(sites ?? []) as any} owners={owners ?? []} showExport={canExport(profile)} />
}
