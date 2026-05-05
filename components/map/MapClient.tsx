'use client'

import dynamic from 'next/dynamic'

const TowerMap = dynamic(() => import('./TowerMap'), { ssr: false, loading: () => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#64748b', fontSize: '14px' }}>
    Loading map…
  </div>
)})

interface SitePinData {
  id: string; site_code: string; name: string; city: string; state: string
  lat: number; lng: number; tenant_name: string; annual_rent: number
  status: string; tower_type: string
}

export default function MapClient({ sites }: { sites: SitePinData[] }) {
  return <TowerMap sites={sites} />
}
