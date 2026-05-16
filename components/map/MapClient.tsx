'use client'

import dynamic from 'next/dynamic'
import { useSearchParams } from 'next/navigation'

const TowerMap = dynamic(() => import('./TowerMap'), { ssr: false, loading: () => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#64748b', fontSize: '14px' }}>
    Loading map…
  </div>
)})

export interface SitePinData {
  id: string
  site_code: string
  name: string
  city: string
  state: string
  lat: number
  lng: number
  status: string
  tower_type: string
  tenant_name: string
  annual_rent: number
  active_tenancies: number
  occupancy: 'vacant' | 'occupied' | 'construction' | 'inactive'
  days_to_expiry: number | null   // null = no active leases; otherwise min days to next expiry
}

export default function MapClient({ sites }: { sites: SitePinData[] }) {
  const params = useSearchParams()

  const lat      = params.get('lat')      ? Number(params.get('lat'))  : undefined
  const lng      = params.get('lng')      ? Number(params.get('lng'))  : undefined
  const site     = params.get('site')     ?? undefined   // site_code to highlight
  const licensee = params.get('licensee') ?? undefined   // licensee name to filter

  return (
    <TowerMap
      sites={sites}
      focusLat={lat}
      focusLng={lng}
      focusSiteCode={site}
      licenseeName={licensee}
    />
  )
}
