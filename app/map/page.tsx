export const dynamic = 'force-dynamic'

import { Suspense } from 'react'
import { getSupabase } from '@/lib/supabase'
import MapClient from '@/components/map/MapClient'

export default async function MapPage() {
  const supabase = getSupabase()
  const { data: sites } = await supabase
    .from('tower_sites')
    .select('id, site_code, name, city, state, lat, lng, status, tower_type, site_licenses(annual_rent, status, license_end, licensees(name))')
    .order('site_code')

  const now = Date.now()

  // Flatten for the map: summarise active tenancies per site
  const mapped = (sites ?? []).map((s: any) => {
    const tenancies = s.site_licenses ?? []
    const active = tenancies.filter((t: any) =>
      ['active', 'pending', 'expiring_soon'].includes(t.status)
    )
    const totalRevenue = active.reduce((sum: number, t: any) => sum + Number(t.annual_rent), 0)
    const tenantNames = active
      .map((t: any) => t.licensees?.name)
      .filter(Boolean)
      .join(', ')

    // Days to nearest expiry across all active leases
    const expiryDays = active
      .map((t: any) => t.license_end
        ? Math.round((new Date(t.license_end).getTime() - now) / 86400000)
        : null
      )
      .filter((d: number | null) => d !== null) as number[]
    const days_to_expiry = expiryDays.length > 0 ? Math.min(...expiryDays) : null

    // Occupancy state
    let occupancy: 'vacant' | 'occupied' | 'construction' | 'inactive'
    if (s.status === 'under_construction') occupancy = 'construction'
    else if (['offline', 'decommissioned'].includes(s.status)) occupancy = 'inactive'
    else occupancy = active.length > 0 ? 'occupied' : 'vacant'

    return {
      id: s.id,
      site_code: s.site_code,
      name: s.name,
      city: s.city,
      state: s.state,
      lat: s.lat,
      lng: s.lng,
      status: s.status,
      tower_type: s.tower_type,
      tenant_name: tenantNames || 'Vacant',
      annual_rent: totalRevenue,
      active_tenancies: active.length,
      occupancy,
      days_to_expiry,
    }
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <div style={{ padding: '20px 32px 16px', borderBottom: '1px solid #e2e8f0', background: 'white' }}>
        <h1 style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a', margin: 0 }}>Map View</h1>
        <p style={{ color: '#64748b', marginTop: '2px', fontSize: '13px' }}>
          {mapped.length} sites plotted — click any pin for details
        </p>
      </div>
      <div style={{ flex: 1, position: 'relative' }}>
        <Suspense fallback={<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#64748b', fontSize: '14px' }}>Loading map…</div>}>
          <MapClient sites={mapped} />
        </Suspense>
      </div>
    </div>
  )
}
