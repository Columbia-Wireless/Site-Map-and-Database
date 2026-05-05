export const dynamic = 'force-dynamic'

import { getSupabase } from '@/lib/supabase'
import MapClient from '@/components/map/MapClient'

export default async function MapPage() {
  const supabase = getSupabase()
  const { data: sites } = await supabase
    .from('tower_sites')
    .select('id, site_code, name, city, state, lat, lng, tenant_name, annual_rent, status, tower_type')
    .order('site_code')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <div style={{ padding: '20px 32px 16px', borderBottom: '1px solid #e2e8f0', background: 'white' }}>
        <h1 style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a', margin: 0 }}>Map View</h1>
        <p style={{ color: '#64748b', marginTop: '2px', fontSize: '13px' }}>
          {sites?.length ?? 0} sites plotted — click any pin for details
        </p>
      </div>
      <div style={{ flex: 1, position: 'relative' }}>
        <MapClient sites={sites ?? []} />
      </div>
    </div>
  )
}
