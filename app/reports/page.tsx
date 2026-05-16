export const dynamic = 'force-dynamic'

import { getSupabase } from '@/lib/supabase'
import ReportsClient from '@/components/reports/ReportsClient'

export default async function ReportsPage() {
  const supabase = getSupabase()
  const [{ data: tenancies }, { data: owners }] = await Promise.all([
    supabase.from('site_licenses')
      .select('*, tower_sites(id, site_code, name, state, address, city, host_agency_id, state_agencies(id, name)), licensees(id, name)'),
    supabase.from('state_agencies').select('id, name').eq('status', 'active').order('name'),
  ])

  return (
    <div style={{ padding: '32px', maxWidth: '1200px' }}>
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#0f172a', margin: 0 }}>Reports</h1>
        <p style={{ color: '#64748b', marginTop: '4px', fontSize: '14px' }}>
          Generate and export portfolio reports
        </p>
      </div>
      <ReportsClient tenancies={(tenancies ?? []) as any} owners={owners ?? []} />
    </div>
  )
}
