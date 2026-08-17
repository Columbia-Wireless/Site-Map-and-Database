export const dynamic = 'force-dynamic'

import { getSupabase } from '@/lib/supabase'
import { getProfile } from '@/lib/profile'
import { scopeFromProfile, getVisibleSiteIds } from '@/lib/orgScope'
import Link from 'next/link'
import { AlertCircle, Clock3, CheckCircle2, DollarSign } from 'lucide-react'

const CURRENT_STATUSES = ['active', 'pending', 'expiring_soon']

interface LicenseRow {
  id: string
  site_id: string
  licensee_id: string
  status: string
  schedule_cache: { rows?: unknown[]; issues?: { severity: 'error' | 'info'; message: string }[] } | null
  schedule_computed_at: string | null
  tower_sites: { id: string; site_code: string; name: string } | null
  licensees: { id: string; name: string } | null
}

type Bucket = 'error' | 'not_computed' | 'clean'

/**
 * Billing — the operational gap-flagging queue, distinct from the per-site/
 * per-licensee/per-owner Rent Schedule tabs (#51-53), which are for viewing
 * one agreement's schedule. This page is for finding, across the whole
 * portfolio, which agreements need attention: a calculation error, or one
 * that's never been computed at all. It reads the same schedule_cache the
 * /api/rent-schedule/[licenseId] route already write-throughs on every
 * view — nothing is (re)computed here, so this page stays cheap regardless
 * of portfolio size.
 */
export default async function BillingPage() {
  const supabase = getSupabase()
  const scope = scopeFromProfile(await getProfile())
  const visibleSiteIds = await getVisibleSiteIds(scope)

  let query = supabase
    .from('site_licenses')
    .select(`
      id, site_id, licensee_id, status, schedule_cache, schedule_computed_at,
      tower_sites ( id, site_code, name ),
      licensees ( id, name )
    `)
    .in('status', CURRENT_STATUSES)

  if (visibleSiteIds) query = query.in('site_id', visibleSiteIds)

  const { data } = await query.returns<LicenseRow[]>()
  const licenses = data ?? []

  const withMeta = licenses.map(l => {
    const issues = l.schedule_cache?.issues ?? []
    const errorCount = issues.filter(i => i.severity === 'error').length
    const infoCount = issues.filter(i => i.severity === 'info').length
    const computed = !!l.schedule_computed_at
    const bucket: Bucket = errorCount > 0 ? 'error' : !computed ? 'not_computed' : 'clean'
    return { ...l, errorCount, infoCount, computed, bucket }
  })

  const BUCKET_ORDER: Record<Bucket, number> = { error: 0, not_computed: 1, clean: 2 }
  withMeta.sort((a, b) => {
    if (BUCKET_ORDER[a.bucket] !== BUCKET_ORDER[b.bucket]) return BUCKET_ORDER[a.bucket] - BUCKET_ORDER[b.bucket]
    return (a.tower_sites?.site_code ?? '').localeCompare(b.tower_sites?.site_code ?? '')
  })

  const errorCount = withMeta.filter(l => l.bucket === 'error').length
  const notComputedCount = withMeta.filter(l => l.bucket === 'not_computed').length
  const cleanCount = withMeta.filter(l => l.bucket === 'clean').length

  return (
    <div style={{ padding: '32px', maxWidth: '1200px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
          <DollarSign size={22} color="#1a3a5c" /> Billing
        </h1>
        <p style={{ color: '#64748b', marginTop: '4px', fontSize: '14px' }}>
          Rent schedule status across every active, pending, or expiring agreement — for viewing a
          single schedule, use the Rent Schedule tab on the relevant Site, Licensee, or Owner page.
        </p>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '24px' }}>
        <SummaryCard icon={<AlertCircle size={16} color="#b91c1c" />} label="Need attention" count={errorCount} bg="#fef2f2" border="#fecaca" color="#991b1b" />
        <SummaryCard icon={<Clock3 size={16} color="#92400e" />} label="Never calculated" count={notComputedCount} bg="#fffbeb" border="#fde68a" color="#92400e" />
        <SummaryCard icon={<CheckCircle2 size={16} color="#15803d" />} label="Clean" count={cleanCount} bg="#f0fdf4" border="#bbf7d0" color="#15803d" />
      </div>

      {withMeta.length === 0 ? (
        <div style={{ padding: '32px', textAlign: 'center', color: '#94a3b8', fontSize: '13px', background: 'white', border: '1px solid #e2e8f0', borderRadius: '10px' }}>
          No active, pending, or expiring agreements on record.
        </div>
      ) : (
        <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #f1f5f9', background: '#f8fafc' }}>
                {['Site', 'Licensee', 'Status', 'Schedule', 'Last Calculated'].map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {withMeta.map(l => (
                <tr key={l.id} style={{ borderBottom: '1px solid #f8fafc' }}>
                  <td style={{ padding: '10px 16px', fontSize: '13px' }}>
                    {l.tower_sites ? (
                      <Link href={`/sites/${l.tower_sites.id}?tab=rent-schedule`} style={{ color: '#2563eb', textDecoration: 'none', fontWeight: 600 }}>
                        {l.tower_sites.site_code} · {l.tower_sites.name}
                      </Link>
                    ) : <span style={{ color: '#94a3b8' }}>Unknown site</span>}
                  </td>
                  <td style={{ padding: '10px 16px', fontSize: '13px', color: '#334155' }}>{l.licensees?.name ?? 'Unknown'}</td>
                  <td style={{ padding: '10px 16px', fontSize: '12px', color: '#64748b', textTransform: 'capitalize' }}>{l.status.replace('_', ' ')}</td>
                  <td style={{ padding: '10px 16px' }}>
                    <BucketBadge bucket={l.bucket} errorCount={l.errorCount} infoCount={l.infoCount} />
                  </td>
                  <td style={{ padding: '10px 16px', fontSize: '12px', color: '#94a3b8' }}>
                    {l.schedule_computed_at ? new Date(l.schedule_computed_at).toLocaleString() : 'Never'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function SummaryCard({ icon, label, count, bg, border, color }: { icon: React.ReactNode; label: string; count: number; bg: string; border: string; color: string }) {
  return (
    <div style={{ background: bg, border: `1px solid ${border}`, borderRadius: '10px', padding: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
        {icon}
        <span style={{ fontSize: '12px', fontWeight: 600, color }}>{label}</span>
      </div>
      <div style={{ fontSize: '24px', fontWeight: 700, color: '#0f172a' }}>{count}</div>
    </div>
  )
}

function BucketBadge({ bucket, errorCount, infoCount }: { bucket: Bucket; errorCount: number; infoCount: number }) {
  if (bucket === 'error') {
    return (
      <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '10px', background: '#fef2f2', color: '#b91c1c' }}>
        {errorCount} error{errorCount !== 1 ? 's' : ''}
      </span>
    )
  }
  if (bucket === 'not_computed') {
    return (
      <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '10px', background: '#fffbeb', color: '#92400e' }}>
        Never calculated
      </span>
    )
  }
  return (
    <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '10px', background: '#f0fdf4', color: '#15803d' }}>
      Clean{infoCount > 0 ? ` · ${infoCount} note${infoCount !== 1 ? 's' : ''}` : ''}
    </span>
  )
}
