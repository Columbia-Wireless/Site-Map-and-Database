export const dynamic = 'force-dynamic'

import { getSupabase } from '@/lib/supabase'
import { getProfile } from '@/lib/profile'
import { scopeFromProfile, scopeSitesQuery, getVisibleSiteIds } from '@/lib/orgScope'
import ImpactSimulator from '@/components/reports/ImpactSimulator'

export default async function ImpactPage() {
  const supabase = getSupabase()
  const scope = scopeFromProfile(await getProfile())

  const sitesQuery = scopeSitesQuery(
    supabase.from('tower_sites').select('id, site_code, name, city, state, tower_type, status, tenant_slots'),
    scope,
  ).order('name')

  let licensesQuery = supabase.from('site_licenses').select('site_id, annual_rent, status').in('status', ['active', 'pending', 'expiring_soon'])
  const visibleSiteIds = await getVisibleSiteIds(scope)
  if (visibleSiteIds) licensesQuery = licensesQuery.in('site_id', visibleSiteIds)

  const [{ data: sites }, { data: licenses }] = await Promise.all([sitesQuery, licensesQuery])

  // Summarise current revenue + carrier count per site
  const rentBySite: Record<string, { carriers: number; annualRent: number }> = {}
  for (const lic of licenses ?? []) {
    if (!rentBySite[lic.site_id]) rentBySite[lic.site_id] = { carriers: 0, annualRent: 0 }
    rentBySite[lic.site_id].carriers++
    rentBySite[lic.site_id].annualRent += Number(lic.annual_rent ?? 0)
  }

  const siteData = (sites ?? []).map((s: any) => ({
    id:            s.id,
    site_code:     s.site_code,
    name:          s.name,
    city:          s.city,
    state:         s.state,
    tower_type:    s.tower_type,
    status:        s.status,
    tenant_slots:  s.tenant_slots ?? null,
    currentCarriers: rentBySite[s.id]?.carriers ?? 0,
    currentRent:     rentBySite[s.id]?.annualRent ?? 0,
  }))

  return <ImpactSimulator sites={siteData} />
}
