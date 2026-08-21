export const dynamic = 'force-dynamic'

import { getSupabase } from '@/lib/supabase'
import { getProfile } from '@/lib/profile'
import { scopeFromProfile } from '@/lib/orgScope'
import ReportsClient from '@/components/reports/ReportsClient'
import SavedReports from '@/components/reports/SavedReports'

const ROLE_RANK: Record<string, number> = {
  super_admin: 5, admin: 4, editor: 3, reporter: 2, viewer: 1,
}

export default async function ReportsPage() {
  const supabase = getSupabase()
  const profile  = await getProfile()
  const scope    = scopeFromProfile(profile)
  const rank     = ROLE_RANK[profile?.role ?? ''] ?? 0
  const isAdmin  = rank >= 4

  const tenanciesQuery = scope.isPlatformAdmin
    ? supabase.from('site_licenses')
        .select('*, tower_sites(id, site_code, name, state, address, city, host_agency_id, state_agencies(id, name)), licensees(id, name)')
    : supabase.from('site_licenses')
        .select('*, tower_sites!inner(id, site_code, name, state, address, city, host_agency_id, organization_id, state_agencies(id, name)), licensees(id, name)')
        .eq('tower_sites.organization_id', scope.organizationId)

  const agreementsQuery = scope.isPlatformAdmin
    ? supabase.from('management_agreements')
        .select('manager_entity_name, commission_type, commission_rate, flat_fee_amount, status, management_agreement_sites(site_id)')
    : supabase.from('management_agreements')
        .select('manager_entity_name, commission_type, commission_rate, flat_fee_amount, status, management_agreement_sites(site_id)')
        .eq('organization_id', scope.organizationId)

  const [{ data: tenancies }, { data: owners }, { data: allReports }, { data: agreements }] = await Promise.all([
    tenanciesQuery,
    supabase.from('state_agencies').select('id, name').eq('status', 'active').order('name'),
    supabase.from('saved_reports').select('*').order('created_at', { ascending: false }),
    agreementsQuery,
  ])

  const savedReports = (allReports ?? []).filter(r => (ROLE_RANK[r.min_role] ?? 0) <= rank)

  // Site -> active management agreement, for the rent-roll CSV's manager/commission
  // columns. Display/cross-check only — never the operational commission rate.
  const managementBySite: Record<string, { manager: string | null; commissionType: string | null; commissionRate: number | null; flatFeeAmount: number | null }> = {}
  for (const a of agreements ?? []) {
    if (a.status !== 'active') continue
    for (const s of (a as any).management_agreement_sites ?? []) {
      managementBySite[s.site_id] = {
        manager: a.manager_entity_name,
        commissionType: a.commission_type,
        commissionRate: a.commission_rate,
        flatFeeAmount: a.flat_fee_amount,
      }
    }
  }

  return (
    <div style={{ padding: '32px', maxWidth: '1200px' }}>
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#0f172a', margin: 0 }}>Reports</h1>
        <p style={{ color: '#64748b', marginTop: '4px', fontSize: '14px' }}>
          Generate and export portfolio reports
        </p>
      </div>
      <ReportsClient tenancies={(tenancies ?? []) as any} owners={owners ?? []} managementBySite={managementBySite} />
      <SavedReports reports={savedReports as any} isAdmin={isAdmin} />
    </div>
  )
}
