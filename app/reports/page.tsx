export const dynamic = 'force-dynamic'

import { getSupabase } from '@/lib/supabase'
import { getProfile } from '@/lib/profile'
import ReportsClient from '@/components/reports/ReportsClient'
import SavedReports from '@/components/reports/SavedReports'

const ROLE_RANK: Record<string, number> = {
  super_admin: 5, admin: 4, editor: 3, reporter: 2, viewer: 1,
}

export default async function ReportsPage() {
  const supabase = getSupabase()
  const profile  = await getProfile()
  const rank     = ROLE_RANK[profile?.role ?? ''] ?? 0
  const isAdmin  = rank >= 4

  const [{ data: tenancies }, { data: owners }, { data: allReports }] = await Promise.all([
    supabase.from('site_licenses')
      .select('*, tower_sites(id, site_code, name, state, address, city, host_agency_id, state_agencies(id, name)), licensees(id, name)'),
    supabase.from('state_agencies').select('id, name').eq('status', 'active').order('name'),
    supabase.from('saved_reports').select('*').order('created_at', { ascending: false }),
  ])

  const savedReports = (allReports ?? []).filter(r => (ROLE_RANK[r.min_role] ?? 0) <= rank)

  return (
    <div style={{ padding: '32px', maxWidth: '1200px' }}>
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#0f172a', margin: 0 }}>Reports</h1>
        <p style={{ color: '#64748b', marginTop: '4px', fontSize: '14px' }}>
          Generate and export portfolio reports
        </p>
      </div>
      <ReportsClient tenancies={(tenancies ?? []) as any} owners={owners ?? []} />
      <SavedReports reports={savedReports as any} isAdmin={isAdmin} />
    </div>
  )
}
