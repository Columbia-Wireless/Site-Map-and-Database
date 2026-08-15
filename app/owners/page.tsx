export const dynamic = 'force-dynamic'

import { getSupabase } from '@/lib/supabase'
import { getProfile } from '@/lib/profile'
import { scopeFromProfile, getVisibleSiteIds } from '@/lib/orgScope'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import OwnerTable from '@/components/owners/OwnerTable'

export default async function OwnersPage() {
  const supabase = getSupabase()
  const profile = await getProfile()
  const scope = scopeFromProfile(profile)
  const singular = profile?.owner_label_singular ?? 'Owner'
  const plural = profile?.owner_label_plural ?? 'Owners'

  const { data: rawOwners } = await supabase
    .from('state_agencies')
    .select('*, tower_sites(id, site_licenses(annual_rent, status))')
    .order('name')

  // Host agencies are a shared reference table — only show agencies with at
  // least one site visible to this org, trimmed to that visible set.
  const visibleSiteIds = await getVisibleSiteIds(scope)
  const visibleSet = visibleSiteIds ? new Set(visibleSiteIds) : null
  const owners = (rawOwners ?? [])
    .map((o: any) => ({
      ...o,
      tower_sites: visibleSet ? (o.tower_sites ?? []).filter((s: any) => visibleSet.has(s.id)) : o.tower_sites,
    }))
    .filter((o: any) => !visibleSet || o.tower_sites.length > 0)

  const enriched = owners.map((owner: any) => {
    const sites: any[] = owner.tower_sites ?? []
    const site_count = sites.length
    const activeSiteIds = new Set(
      sites
        .filter((s: any) =>
          (s.site_licenses ?? []).some((t: any) =>
            ['active', 'pending', 'expiring_soon'].includes(t.status)
          )
        )
        .map((s: any) => s.id)
    )
    const vacant_count = site_count - activeSiteIds.size
    const annual_revenue = sites.reduce((sum: number, s: any) => {
      return (
        sum +
        (s.site_licenses ?? [])
          .filter((t: any) => ['active', 'pending', 'expiring_soon'].includes(t.status))
          .reduce((s2: number, t: any) => s2 + Number(t.annual_rent), 0)
      )
    }, 0)
    return { ...owner, site_count, vacant_count, annual_revenue }
  })

  return (
    <div style={{ padding: '32px', maxWidth: '1300px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '28px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#0f172a', margin: 0 }}>Site {plural}</h1>
          <p style={{ color: '#64748b', marginTop: '4px', fontSize: '14px' }}>
            {enriched.length} {enriched.length !== 1 ? plural.toLowerCase() : singular.toLowerCase()} on record
          </p>
        </div>
        <Link href="/owners/new" style={{ textDecoration: 'none' }}>
          <button style={{
            display: 'flex', alignItems: 'center', gap: '7px',
            background: '#1a3a5c', color: 'white', border: 'none',
            borderRadius: '8px', padding: '10px 18px',
            fontSize: '14px', fontWeight: 600, cursor: 'pointer',
          }}>
            <Plus size={16} /> Add {singular}
          </button>
        </Link>
      </div>
      <OwnerTable owners={enriched} ownerLabel={singular} />
    </div>
  )
}
