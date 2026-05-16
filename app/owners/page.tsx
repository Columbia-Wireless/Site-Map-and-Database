export const dynamic = 'force-dynamic'

import { getSupabase } from '@/lib/supabase'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import OwnerTable from '@/components/owners/OwnerTable'

export default async function OwnersPage() {
  const supabase = getSupabase()

  const { data: owners } = await supabase
    .from('state_agencies')
    .select('*, tower_sites(id, site_licenses(annual_rent, status))')
    .order('name')

  const enriched = (owners ?? []).map((owner: any) => {
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
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#0f172a', margin: 0 }}>Host Agencies</h1>
          <p style={{ color: '#64748b', marginTop: '4px', fontSize: '14px' }}>
            {enriched.length} agency{enriched.length !== 1 ? 's' : ''} on record
          </p>
        </div>
        <Link href="/owners/new" style={{ textDecoration: 'none' }}>
          <button style={{
            display: 'flex', alignItems: 'center', gap: '7px',
            background: '#1a3a5c', color: 'white', border: 'none',
            borderRadius: '8px', padding: '10px 18px',
            fontSize: '14px', fontWeight: 600, cursor: 'pointer',
          }}>
            <Plus size={16} /> Add Agency
          </button>
        </Link>
      </div>
      <OwnerTable owners={enriched} />
    </div>
  )
}
