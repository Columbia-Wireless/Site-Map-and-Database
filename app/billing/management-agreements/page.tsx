export const dynamic = 'force-dynamic'

import { getSupabase } from '@/lib/supabase'
import { getProfile } from '@/lib/profile'
import { scopeFromProfile } from '@/lib/orgScope'
import Link from 'next/link'
import { Building2, ArrowLeft } from 'lucide-react'

interface AgreementRow {
  id: string
  site_owner_name: string | null
  manager_entity_name: string | null
  commission_type: 'percentage' | 'flat_fee' | 'hybrid' | 'other' | null
  commission_rate: number | null
  flat_fee_amount: number | null
  commission_description: string | null
  billing_practices: string | null
  start_date: string | null
  end_date: string | null
  initial_term_description: string | null
  exclusivity: 'exclusive' | 'non_exclusive' | null
  covers_multiple_sites: boolean
  status: string
  management_agreement_sites: { site_id: string; tower_sites: { id: string; site_code: string; name: string } | null }[]
}

/**
 * Portfolio-wide Management Agreements view (task #64). One row per
 * management_agreements record (Columbia Wireless <-> site owner, not a
 * carrier lease — see docs/SAM2_INTEGRATION.md "Management agreements").
 * Commission figures are as stated in the document, for display/cross-check
 * only — never the operational commission rate the rent engine actually
 * uses (Onno's explicit warning, confirmed 2026-08-20).
 */
export default async function ManagementAgreementsPage() {
  const supabase = getSupabase()
  const scope = scopeFromProfile(await getProfile())

  let query = supabase
    .from('management_agreements')
    .select(`
      id, site_owner_name, manager_entity_name, commission_type, commission_rate,
      flat_fee_amount, commission_description, billing_practices, start_date, end_date,
      initial_term_description, exclusivity, covers_multiple_sites, status,
      management_agreement_sites ( site_id, tower_sites ( id, site_code, name ) )
    `)
    .order('status')
    .order('site_owner_name')

  if (!scope.isPlatformAdmin) query = query.eq('organization_id', scope.organizationId)

  const { data } = await query.returns<AgreementRow[]>()
  const agreements = data ?? []

  function commissionLabel(a: AgreementRow): string {
    if (a.commission_type === 'percentage' && a.commission_rate != null) return `${(a.commission_rate * 100).toFixed(1)}%`
    if (a.commission_type === 'flat_fee' && a.flat_fee_amount != null) return `$${a.flat_fee_amount.toLocaleString()} flat`
    if (a.commission_description) return a.commission_description
    return '—'
  }

  return (
    <div style={{ padding: '32px', maxWidth: '1200px' }}>
      <div style={{ marginBottom: '24px' }}>
        <Link href="/billing" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#64748b', textDecoration: 'none', marginBottom: '10px' }}>
          <ArrowLeft size={14} /> Back to Billing
        </Link>
        <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Building2 size={22} color="#1a3a5c" /> Management Agreements
        </h1>
        <p style={{ color: '#64748b', marginTop: '4px', fontSize: '14px' }}>
          Site owner ↔ Columbia Wireless management arrangements, synced from SAM 2.0. Commission
          figures are as stated in the document — for display and cross-check only, not the
          operational rate used for billing calculations.
        </p>
      </div>

      {agreements.length === 0 ? (
        <div style={{ padding: '32px', textAlign: 'center', color: '#94a3b8', fontSize: '13px', background: 'white', border: '1px solid #e2e8f0', borderRadius: '10px' }}>
          No management agreements on record yet. These populate automatically when SAM 2.0 syncs a
          document classified as a management agreement.
        </div>
      ) : (
        <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #f1f5f9', background: '#f8fafc' }}>
                {['Site(s)', 'Site Owner', 'Manager', 'Commission', 'Billing Practices', 'Term', 'Exclusivity', 'Status'].map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {agreements.map(a => {
                const sites = a.management_agreement_sites ?? []
                return (
                  <tr key={a.id} style={{ borderBottom: '1px solid #f8fafc' }}>
                    <td style={{ padding: '10px 16px', fontSize: '13px' }}>
                      {sites.length === 0 && <span style={{ color: '#94a3b8' }}>Unlinked</span>}
                      {sites.map((s, i) => s.tower_sites ? (
                        <span key={s.site_id}>
                          {i > 0 && ', '}
                          <Link href={`/sites/${s.tower_sites.id}`} style={{ color: '#2563eb', textDecoration: 'none', fontWeight: 600 }}>
                            {s.tower_sites.site_code}
                          </Link>
                        </span>
                      ) : null)}
                      {a.covers_multiple_sites && (
                        <div style={{ fontSize: '11px', color: '#b45309', marginTop: '2px' }}>Flagged as multi-site — check for related documents</div>
                      )}
                    </td>
                    <td style={{ padding: '10px 16px', fontSize: '13px', color: '#334155' }}>{a.site_owner_name ?? '—'}</td>
                    <td style={{ padding: '10px 16px', fontSize: '13px', color: '#334155' }}>{a.manager_entity_name ?? '—'}</td>
                    <td style={{ padding: '10px 16px', fontSize: '13px', color: '#334155' }}>{commissionLabel(a)}</td>
                    <td style={{ padding: '10px 16px', fontSize: '12px', color: '#64748b', maxWidth: '220px' }}>{a.billing_practices ?? '—'}</td>
                    <td style={{ padding: '10px 16px', fontSize: '12px', color: '#64748b' }}>
                      {a.start_date ?? '—'} – {a.end_date ?? a.initial_term_description ?? 'open'}
                    </td>
                    <td style={{ padding: '10px 16px', fontSize: '12px', color: '#64748b', textTransform: 'capitalize' }}>{a.exclusivity?.replace('_', ' ') ?? '—'}</td>
                    <td style={{ padding: '10px 16px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '10px', background: a.status === 'active' ? '#f0fdf4' : '#f1f5f9', color: a.status === 'active' ? '#15803d' : '#64748b', textTransform: 'capitalize' }}>
                        {a.status}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
