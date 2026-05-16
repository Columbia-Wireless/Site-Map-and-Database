'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import Link from 'next/link'
import {
  FileText, Download, AlertTriangle, Calendar, DollarSign, TrendingUp,
  Filter, BarChart2, Clock, Target, Award, Activity,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend, Cell,
} from 'recharts'

const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)

const fmtK = (n: number) => n >= 1000 ? `$${(n / 1000).toFixed(0)}K` : fmt(n)

interface OwnerOption { id: string; name: string }

interface TenancyRow {
  id: string
  site_id: string
  licensee_id: string
  mount_type: string
  annual_rent: number
  escalation_rate: number
  license_start: string
  license_end: string
  status: string
  notes: string | null
  contract_type: 'new_agreement' | 'amendment' | 'settlement'
  amendment_delta: number | null
  settlement_amount: number | null
  tower_sites: {
    id: string; site_code: string; name: string; state: string; address: string; city: string
    host_agency_id: string | null
    state_agencies: { id: string; name: string } | null
  } | null
  licensees: { id: string; name: string } | null
}

const CONTRACT_TYPE_META = {
  new_agreement: { label: 'New Agreement', color: '#15803d', bg: '#dcfce7' },
  amendment:     { label: 'Amendment',     color: '#1d4ed8', bg: '#dbeafe' },
  settlement:    { label: 'Settlement',    color: '#92400e', bg: '#fef3c7' },
} as const

const REPORTS = [
  { id: 'rent_roll',        title: 'Rent Roll Summary',       description: 'All active licenses with current annual rent, escalation rate, and license terms.',                     icon: DollarSign,  color: '#eff6ff', iconColor: '#2563eb' },
  { id: 'rent_by_month',    title: 'Rent by Month',           description: 'Monthly payment schedule for all active licenses — cash flow view for the current year.',               icon: BarChart2,   color: '#f0fdf4', iconColor: '#16a34a' },
  { id: 'expired_contracts',title: 'Expired Contracts',       description: 'All expired and terminated licenses with uncollected revenue opportunity quantified.',                   icon: Clock,       color: '#fef2f2', iconColor: '#dc2626' },
  { id: 'projected_revenue',title: 'Projected Revenue',       description: '10-year revenue forecast applying each license\'s individual escalation rate.',                          icon: TrendingUp,  color: '#faf5ff', iconColor: '#7c3aed' },
  { id: 'comparables',      title: 'Comparables Report',      description: 'ETV tower rates benchmarked against market comparables from managed portfolios.',                        icon: Target,      color: '#fffbeb', iconColor: '#d97706' },
  { id: 'value_added',      title: 'Value Added',             description: 'Revenue impact by Columbia Wireless — historical baseline vs current portfolio performance.',            icon: Award,       color: '#f0fdf4', iconColor: '#15803d' },
  { id: 'expiry_calendar',  title: 'License Expiry Calendar', description: 'Licenses organized by upcoming expiration for proactive renewal management.',                            icon: Calendar,    color: '#fffbeb', iconColor: '#d97706' },
  { id: 'exceptions',       title: 'Exceptions Report',       description: 'Licenses requiring immediate attention — expired, expiring within 180 days, or terminated.',             icon: AlertTriangle, color: '#fef2f2', iconColor: '#dc2626' },
  { id: 'lease_timeline',   title: 'Lease Timeline',          description: 'Visual Gantt of every license across all sites — spot occupancy gaps, revenue peaks, and tenant lifecycle.',  icon: Activity,      color: '#f0f9ff', iconColor: '#0284c7' },
]

export default function ReportsClient({ tenancies, owners }: { tenancies: TenancyRow[]; owners: OwnerOption[] }) {
  const [generating, setGenerating] = useState<string | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [ownerFilter, setOwnerFilter] = useState<string>('all')
  const previewRef = useRef<HTMLDivElement>(null)

  const filtered = useMemo(() => {
    if (ownerFilter === 'all') return tenancies
    return tenancies.filter(t => {
      const site = t.tower_sites as any
      return site?.host_agency_id === ownerFilter || site?.state_agencies?.id === ownerFilter
    })
  }, [tenancies, ownerFilter])

  const selectedOwnerName = ownerFilter === 'all' ? null : owners.find(o => o.id === ownerFilter)?.name ?? null

  useEffect(() => {
    if (preview && previewRef.current) {
      previewRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [preview])

  function generateReport(id: string) {
    setGenerating(id)
    setTimeout(() => { setGenerating(null); setPreview(id) }, 600)
  }

  return (
    <div>
      {/* Owner Filter */}
      <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px 20px', marginBottom: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748b', fontSize: '13px', fontWeight: 600 }}>
            <Filter size={14} /> Filter by Agency:
          </div>
          <select
            value={ownerFilter}
            onChange={e => { setOwnerFilter(e.target.value); setPreview(null) }}
            style={{ padding: '7px 12px', border: '1px solid #e2e8f0', borderRadius: '7px', fontSize: '13px', background: 'white', cursor: 'pointer', color: '#0f172a' }}
          >
            <option value="all">All Agencies ({tenancies.length} licenses)</option>
            {owners.map(o => {
              const count = tenancies.filter(t => (t.tower_sites as any)?.state_agencies?.id === o.id).length
              return <option key={o.id} value={o.id}>{o.name} ({count})</option>
            })}
          </select>
          {ownerFilter !== 'all' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ background: '#eff6ff', color: '#2563eb', fontSize: '12px', fontWeight: 600, padding: '3px 10px', borderRadius: '12px' }}>
                {selectedOwnerName} · {filtered.length} licenses
              </span>
              <button onClick={() => { setOwnerFilter('all'); setPreview(null) }} style={{ color: '#64748b', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', padding: '2px 4px' }}>✕ Clear</button>
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', marginBottom: '28px' }}>
        {REPORTS.map(report => (
          <div key={report.id} style={{ background: 'white', border: preview === report.id ? '2px solid #2563eb' : '1px solid #e2e8f0', borderRadius: '10px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'flex', gap: '14px', marginBottom: '14px' }}>
              <div style={{ background: report.color, borderRadius: '8px', padding: '10px', flexShrink: 0 }}>
                <report.icon size={20} color={report.iconColor} />
              </div>
              <div>
                <div style={{ fontSize: '15px', fontWeight: 600, color: '#0f172a' }}>{report.title}</div>
                <div style={{ fontSize: '13px', color: '#64748b', marginTop: '3px' }}>{report.description}</div>
              </div>
            </div>
            <button
              onClick={() => generateReport(report.id)}
              disabled={generating === report.id}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', background: generating === report.id ? '#f1f5f9' : '#1a3a5c', color: generating === report.id ? '#94a3b8' : 'white', border: 'none', borderRadius: '7px', padding: '8px 16px', fontSize: '13px', fontWeight: 600, cursor: generating === report.id ? 'default' : 'pointer' }}
            >
              <FileText size={14} />
              {generating === report.id ? 'Generating…' : 'Generate Report'}
            </button>
          </div>
        ))}
      </div>

      {preview && (
        <div ref={previewRef}>
          <ReportPreview id={preview} tenancies={filtered} ownerName={selectedOwnerName} onClose={() => setPreview(null)} />
        </div>
      )}
    </div>
  )
}

function ReportPreview({ id, tenancies, ownerName, onClose }: { id: string; tenancies: TenancyRow[]; ownerName: string | null; onClose: () => void }) {
  const report = REPORTS.find(r => r.id === id)!
  const now = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  const content: Record<string, React.ReactNode> = {
    rent_roll:         <RentRollReport tenancies={tenancies} />,
    rent_by_month:     <RentByMonthReport tenancies={tenancies} />,
    expired_contracts: <ExpiredContractsReport tenancies={tenancies} />,
    projected_revenue: <ProjectedRevenueReport tenancies={tenancies} />,
    comparables:       <ComparablesReport tenancies={tenancies} />,
    value_added:       <ValueAddedReport tenancies={tenancies} />,
    expiry_calendar:   <ExpiryCalendarReport tenancies={tenancies} />,
    exceptions:        <ExceptionsReport tenancies={tenancies} />,
    lease_timeline:    <LeaseTimelineReport tenancies={tenancies} />,
  }

  return (
    <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '10px', boxShadow: '0 4px 16px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
      <div style={{ background: '#1a3a5c', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '11px', marginBottom: '2px' }}>SCETV SITE MANAGEMENT · Columbia Wireless</div>
          <div style={{ color: 'white', fontSize: '16px', fontWeight: 700 }}>{report.title}</div>
          <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', marginTop: '2px' }}>
            Generated {now}{ownerName ? ` · ${ownerName}` : ''}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={() => window.print()} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.15)', color: 'white', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '6px', padding: '7px 14px', fontSize: '13px', cursor: 'pointer' }}>
            <Download size={14} /> Export PDF
          </button>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '6px', padding: '7px 12px', fontSize: '13px', cursor: 'pointer' }}>✕</button>
        </div>
      </div>
      <div style={{ padding: '24px' }}>{content[id]}</div>
    </div>
  )
}

// ─── Report: Rent Roll ────────────────────────────────────────────────────────

function RentRollReport({ tenancies }: { tenancies: TenancyRow[] }) {
  const active = tenancies.filter(t => ['active', 'pending', 'expiring_soon'].includes(t.status))
  const sorted = [...active].sort((a, b) => (a.tower_sites?.site_code ?? '').localeCompare(b.tower_sites?.site_code ?? ''))
  const total = active.reduce((s, t) => s + Number(t.annual_rent), 0)
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '20px' }}>
        <Stat label="Active Licenses" value={String(active.length)} />
        <Stat label="Annual Revenue" value={fmt(total)} />
        <Stat label="Avg Rent / License" value={active.length > 0 ? fmt(total / active.length) : '—'} />
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #1a3a5c' }}>
            {['Site Code', 'Site Name', 'Licensee', 'Mount Type', 'Annual Rent', 'Escalation', 'License End'].map(h => (
              <th key={h} style={{ padding: '8px 10px', textAlign: 'left', color: '#1a3a5c', fontWeight: 700, fontSize: '12px' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((t, i) => (
            <tr key={t.id} style={{ background: i % 2 === 0 ? 'white' : '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
              <td style={{ padding: '7px 10px' }}>
                {t.tower_sites ? <SiteLink id={t.tower_sites.id} code={t.tower_sites.site_code} /> : '—'}
              </td>
              <td style={{ padding: '7px 10px' }}>{t.tower_sites?.name ?? '—'}</td>
              <td style={{ padding: '7px 10px' }}><LicenseeLink id={t.licensees?.id} name={t.licensees?.name ?? '—'} /></td>
              <td style={{ padding: '7px 10px', color: '#64748b' }}>{t.mount_type}</td>
              <td style={{ padding: '7px 10px', fontWeight: 600 }}>{fmt(Number(t.annual_rent))}</td>
              <td style={{ padding: '7px 10px' }}>{t.escalation_rate}%</td>
              <td style={{ padding: '7px 10px', color: '#64748b' }}>{fmtDate(t.license_end)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr style={{ borderTop: '2px solid #1a3a5c', fontWeight: 700 }}>
            <td colSpan={4} style={{ padding: '8px 10px' }}>TOTAL ({active.length} licenses)</td>
            <td style={{ padding: '8px 10px' }}>{fmt(total)}</td>
            <td colSpan={2} />
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

// ─── Report: Rent by Month ────────────────────────────────────────────────────

function RentByMonthReport({ tenancies }: { tenancies: TenancyRow[] }) {
  const now = new Date()
  const [selMonth, setSelMonth] = useState(now.getMonth() + 1)
  const [selYear,  setSelYear]  = useState(now.getFullYear())

  const MONTHS_FULL  = ['January','February','March','April','May','June','July','August','September','October','November','December']
  const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const yearOpts = Array.from({ length: 7 }, (_, i) => now.getFullYear() - 3 + i)

  const allPaying = tenancies.filter(t => Number(t.annual_rent) > 0)

  // Year-overview chart: 12 months of selected year
  const chartData = MONTHS_SHORT.map((m, idx) => {
    const mS = new Date(selYear, idx, 1)
    const mE = new Date(selYear, idx + 1, 0)
    const rev = allPaying
      .filter(t => t.license_start && t.license_end &&
        new Date(t.license_start) <= mE && new Date(t.license_end) >= mS)
      .reduce((s, t) => s + Number(t.annual_rent) / 12, 0)
    return { month: m, revenue: Math.round(rev), sel: idx + 1 === selMonth }
  })

  // Table: leases active in selected month
  const selStart = new Date(selYear, selMonth - 1, 1)
  const selEnd   = new Date(selYear, selMonth, 0)
  const tableRows = allPaying
    .filter(t => t.license_start && t.license_end &&
      new Date(t.license_start) <= selEnd && new Date(t.license_end) >= selStart)
    .sort((a, b) => {
      const agA = a.tower_sites?.state_agencies?.name ?? 'zzz'
      const agB = b.tower_sites?.state_agencies?.name ?? 'zzz'
      if (agA !== agB) return agA.localeCompare(agB)
      return (a.tower_sites?.site_code ?? '').localeCompare(b.tower_sites?.site_code ?? '')
    })

  const monthTotal  = tableRows.reduce((s, t) => s + Number(t.annual_rent) / 12, 0)
  const annualBase  = allPaying.reduce((s, t) => s + Number(t.annual_rent), 0)
  const thStyle: React.CSSProperties = { padding: '8px 10px', textAlign: 'left', color: '#1a3a5c', fontWeight: 700, fontSize: '12px' }

  return (
    <div>
      {/* Filters */}
      <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '20px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px 16px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600, color: '#475569' }}>
          Month
          <select value={selMonth} onChange={e => setSelMonth(Number(e.target.value))}
            style={{ padding: '5px 10px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '13px', background: 'white' }}>
            {MONTHS_FULL.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
          </select>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600, color: '#475569' }}>
          Year
          <select value={selYear} onChange={e => setSelYear(Number(e.target.value))}
            style={{ padding: '5px 10px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '13px', background: 'white' }}>
            {yearOpts.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </label>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '20px' }}>
        <Stat label={`${MONTHS_FULL[selMonth - 1]} ${selYear}`} value={fmt(monthTotal)} />
        <Stat label="Active Leases This Month" value={String(tableRows.length)} />
        <Stat label="Annualized (Full Portfolio)" value={fmt(annualBase)} />
      </div>

      {/* Year-overview bar chart — selected month highlighted dark */}
      <ResponsiveContainer width="100%" height={150}>
        <BarChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
          <YAxis tickFormatter={fmtK} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={52} />
          <Tooltip formatter={(v: any) => [fmt(v), 'Monthly Revenue']} contentStyle={{ fontSize: '12px', borderRadius: '8px' }} />
          <Bar dataKey="revenue" radius={[3, 3, 0, 0]}>
            {chartData.map((d, i) => <Cell key={i} fill={d.sel ? '#1a3a5c' : '#bfdbfe'} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Per-site / per-carrier detail table */}
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', marginTop: '20px' }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #1a3a5c' }}>
            {['Host Agency', 'Site', 'Carrier', 'Status', `${MONTHS_FULL[selMonth - 1]} Rent`].map(h => (
              <th key={h} style={thStyle}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {tableRows.map((t, i) => (
            <tr key={t.id} style={{ background: i % 2 === 0 ? 'white' : '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
              <td style={{ padding: '7px 10px', color: '#64748b', fontSize: '12px' }}>
                {t.tower_sites?.state_agencies?.name ?? '—'}
              </td>
              <td style={{ padding: '7px 10px' }}>
                {t.tower_sites ? <SiteLink id={t.tower_sites.id} code={t.tower_sites.site_code} /> : '—'}
                <span style={{ fontSize: '11px', color: '#94a3b8', marginLeft: '5px' }}>{t.tower_sites?.name}</span>
              </td>
              <td style={{ padding: '7px 10px' }}>
                <LicenseeLink id={t.licensees?.id} name={t.licensees?.name ?? '—'} />
              </td>
              <td style={{ padding: '7px 10px' }}>
                <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 7px', borderRadius: '10px',
                  background: t.status === 'active' ? '#dcfce7' : '#fef3c7',
                  color: t.status === 'active' ? '#15803d' : '#92400e' }}>
                  {t.status}
                </span>
              </td>
              <td style={{ padding: '7px 10px', fontWeight: 700, textAlign: 'right' }}>
                {fmt(Number(t.annual_rent) / 12)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr style={{ borderTop: '2px solid #1a3a5c', fontWeight: 700, background: '#f8fafc' }}>
            <td colSpan={4} style={{ padding: '8px 10px' }}>TOTAL ({tableRows.length} leases)</td>
            <td style={{ padding: '8px 10px', textAlign: 'right' }}>{fmt(monthTotal)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

// ─── Report: Expired Contracts ────────────────────────────────────────────────

function ExpiredContractsReport({ tenancies }: { tenancies: TenancyRow[] }) {
  const lapsed = tenancies
    .filter(t => ['expired', 'terminated'].includes(t.status) && Number(t.annual_rent) > 0)
    .sort((a, b) => new Date(b.license_end).getTime() - new Date(a.license_end).getTime())

  const totalLostAnnual = lapsed.reduce((s, t) => s + Number(t.annual_rent), 0)
  const now = new Date()

  const withGap = lapsed.map(t => {
    const endDate = new Date(t.license_end)
    const yearsLapsed = Math.max(0, (now.getTime() - endDate.getTime()) / (365.25 * 24 * 3600 * 1000))
    return { ...t, yearsLapsed, uncollected: Math.round(Number(t.annual_rent) * yearsLapsed) }
  })

  const totalUncollected = withGap.reduce((s, t) => s + t.uncollected, 0)

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '16px' }}>
        <Stat label="Lapsed Contracts" value={String(lapsed.length)} color="#dc2626" />
        <Stat label="Lost Annual Revenue" value={fmt(totalLostAnnual)} color="#dc2626" />
        <Stat label="Est. Uncollected Since Expiry" value={fmt(totalUncollected)} color="#dc2626" />
      </div>
      <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '8px', padding: '12px 16px', fontSize: '13px', color: '#c2410c', marginBottom: '20px' }}>
        <strong>Recovery opportunity:</strong> Re-engaging lapsed tenants at current market rates could generate {fmt(totalLostAnnual)}+ in new annual revenue.
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #1a3a5c' }}>
            {['Site', 'Licensee', 'Status', 'Expired', 'Yrs Lapsed', 'Last Rent', 'Est. Uncollected'].map(h => (
              <th key={h} style={{ padding: '8px 10px', textAlign: 'left', color: '#1a3a5c', fontWeight: 700, fontSize: '12px' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {withGap.map((t, i) => (
            <tr key={t.id} style={{ background: i % 2 === 0 ? 'white' : '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
              <td style={{ padding: '7px 10px' }}>
                {t.tower_sites ? <SiteLink id={t.tower_sites.id} code={t.tower_sites.site_code} /> : '—'}
              </td>
              <td style={{ padding: '7px 10px' }}><LicenseeLink id={t.licensees?.id} name={t.licensees?.name ?? '—'} /></td>
              <td style={{ padding: '7px 10px' }}>
                <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 7px', borderRadius: '10px', background: t.status === 'terminated' ? '#fce7f3' : '#fee2e2', color: t.status === 'terminated' ? '#be185d' : '#b91c1c' }}>
                  {t.status}
                </span>
              </td>
              <td style={{ padding: '7px 10px' }}>{fmtDate(t.license_end)}</td>
              <td style={{ padding: '7px 10px', color: '#64748b' }}>{t.yearsLapsed.toFixed(1)} yrs</td>
              <td style={{ padding: '7px 10px', fontWeight: 600 }}>{fmt(Number(t.annual_rent))}</td>
              <td style={{ padding: '7px 10px', fontWeight: 700, color: '#dc2626' }}>{fmt(t.uncollected)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr style={{ borderTop: '2px solid #1a3a5c', fontWeight: 700 }}>
            <td colSpan={5} style={{ padding: '8px 10px' }}>TOTAL OPPORTUNITY</td>
            <td style={{ padding: '8px 10px' }}>{fmt(totalLostAnnual)}/yr</td>
            <td style={{ padding: '8px 10px', color: '#dc2626' }}>{fmt(totalUncollected)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

// ─── Report: Projected Revenue ────────────────────────────────────────────────

function ProjectedRevenueReport({ tenancies }: { tenancies: TenancyRow[] }) {
  const currentYear = new Date().getFullYear()
  const [startYear, setStartYear] = useState(currentYear)
  const [endYear, setEndYear]     = useState(currentYear + 5)
  const [carrier, setCarrier]     = useState('all')

  const active = tenancies.filter(t => ['active', 'pending', 'expiring_soon'].includes(t.status))
  const carrierOptions = [...new Set(active.map(t => t.licensees?.name).filter(Boolean))] as string[]
  const rows = (carrier === 'all' ? active : active.filter(t => t.licensees?.name === carrier))
    .sort((a, b) => (a.tower_sites?.site_code ?? '').localeCompare(b.tower_sites?.site_code ?? ''))

  const safeEnd = Math.max(endYear, startYear + 1)
  const years = Array.from({ length: safeEnd - startYear + 1 }, (_, i) => startYear + i)

  function projectedRent(t: TenancyRow, year: number): number {
    if (!t.license_end) return 0
    const endY = new Date(t.license_end).getFullYear()
    if (year > endY) return 0
    const startY = t.license_start ? new Date(t.license_start).getFullYear() : year
    const rate = 1 + Number(t.escalation_rate ?? 3) / 100
    return Math.round(Number(t.annual_rent) * Math.pow(rate, Math.max(0, year - startY)))
  }

  const matrix = rows.map(t => ({ t, vals: years.map(y => projectedRent(t, y)) }))
  const totals = years.map((_, i) => matrix.reduce((s, r) => s + r.vals[i], 0))
  const grandTotal = totals.reduce((s, v) => s + v, 0)
  const maxCellVal = Math.max(...matrix.flatMap(r => r.vals).filter(v => v > 0), 1)

  function heatBg(v: number): string {
    if (v <= 0) return 'transparent'
    const t = Math.min(1, v / maxCellVal)
    // white → #dbeafe (light blue) → #2563eb (strong blue)
    if (t < 0.5) {
      const s = t * 2
      return `rgb(${Math.round(255 + (219 - 255) * s)},${Math.round(255 + (234 - 255) * s)},${Math.round(255 + (254 - 255) * s)})`
    }
    const s = (t - 0.5) * 2
    return `rgb(${Math.round(219 + (37 - 219) * s)},${Math.round(234 + (99 - 234) * s)},${Math.round(254 + (235 - 254) * s)})`
  }
  function heatFg(v: number): string {
    return v / maxCellVal > 0.6 ? 'white' : '#0f172a'
  }

  const thStyle: React.CSSProperties = { padding: '8px 10px', textAlign: 'left', color: '#1a3a5c', fontWeight: 700, fontSize: '12px', whiteSpace: 'nowrap' }
  const tdBase: React.CSSProperties = { padding: '7px 10px', fontSize: '13px', whiteSpace: 'nowrap' }

  return (
    <div>
      <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '16px' }}>
        Projects revenue by site and carrier. Use Start/End Year and Carrier filter, then review year-by-year projections. Cells showing $0 indicate the lease expires before that year.
      </p>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '20px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px 16px' }}>
        {[
          { label: 'Start Year', value: startYear, setter: setStartYear,
            opts: Array.from({ length: 6 }, (_, i) => currentYear - 2 + i) },
          { label: 'End Year',   value: endYear,   setter: setEndYear,
            opts: Array.from({ length: 11 }, (_, i) => currentYear + i) },
        ].map(({ label, value, setter, opts }) => (
          <label key={label} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#475569', fontWeight: 600 }}>
            {label}
            <select value={value} onChange={e => setter(Number(e.target.value))}
              style={{ padding: '5px 10px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '13px', background: 'white' }}>
              {opts.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </label>
        ))}
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#475569', fontWeight: 600 }}>
          Carrier
          <select value={carrier} onChange={e => setCarrier(e.target.value)}
            style={{ padding: '5px 10px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '13px', background: 'white', maxWidth: '220px' }}>
            <option value="all">ALL CARRIERS</option>
            {carrierOptions.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '20px' }}>
        <Stat label="Active Leases Shown" value={String(rows.length)} />
        <Stat label={`${startYear} Revenue`} value={fmt(totals[0] ?? 0)} />
        <Stat label={`${safeEnd} Revenue`} value={fmt(totals[totals.length - 1] ?? 0)} color="#7c3aed" />
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #1a3a5c' }}>
              <th style={thStyle}>Site</th>
              <th style={thStyle}>Carrier</th>
              {years.map(y => <th key={y} style={{ ...thStyle, textAlign: 'right' }}>{y}</th>)}
            </tr>
          </thead>
          <tbody>
            {/* TOTAL row pinned */}
            <tr style={{ background: '#1a3a5c', color: 'white', fontWeight: 700 }}>
              <td style={{ ...tdBase, color: 'white' }} colSpan={2}>TOTAL ({rows.length} leases)</td>
              {totals.map((v, i) => (
                <td key={i} style={{ ...tdBase, color: 'white', textAlign: 'right', fontWeight: 700 }}>{fmt(v)}</td>
              ))}
            </tr>
            {matrix.map(({ t, vals }, ri) => (
              <tr key={t.id} style={{ background: ri % 2 === 0 ? 'white' : '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ ...tdBase }}>
                  {t.tower_sites ? <SiteLink id={t.tower_sites.id} code={t.tower_sites.site_code} /> : '—'}
                  <span style={{ fontSize: '11px', color: '#94a3b8', marginLeft: '6px' }}>{t.tower_sites?.name}</span>
                </td>
                <td style={{ ...tdBase }}><LicenseeLink id={t.licensees?.id} name={t.licensees?.name ?? '—'} /></td>
                {vals.map((v, i) => {
                  const cliff = v === 0 && i > 0 && vals[i - 1] > 0
                  const bg    = cliff ? '#fee2e2' : heatBg(v)
                  const fg    = cliff ? '#dc2626' : (v > 0 ? heatFg(v) : '#cbd5e1')
                  return (
                    <td key={i} style={{ ...tdBase, textAlign: 'right', fontWeight: v > 0 ? 600 : 400, color: fg, background: bg }}>
                      {v === 0 ? '$0' : fmt(v)}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: '2px solid #1a3a5c', fontWeight: 700, background: '#f8fafc' }}>
              <td style={{ ...tdBase }} colSpan={2}>GRAND TOTAL ({startYear}–{safeEnd})</td>
              {totals.map((v, i) => (
                <td key={i} style={{ ...tdBase, textAlign: 'right', fontWeight: 700 }}>{fmt(v)}</td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
      <div style={{ marginTop: '10px', fontSize: '11px', color: '#94a3b8' }}>
        Projection applies each lease's individual escalation rate. Leases are not automatically renewed — cells show $0 after expiry.
      </div>
    </div>
  )
}

// ─── Report: Comparables ─────────────────────────────────────────────────────

const MARKET_BENCHMARKS = [
  { category: 'Telecom (Major Carrier)',    marketLow: 8400,  marketHigh: 18000, marketAvg: 12000, source: 'Managed portfolio — commercial rooftop & tower' },
  { category: 'Federal Agency',             marketLow: 12000, marketHigh: 24000, marketAvg: 16800, source: 'FBI/DHS/CBP lease data — comparable government towers' },
  { category: 'Broadcast / Non-profit',     marketLow: 6000,  marketHigh: 10800, marketAvg: 8400,  source: 'NBC, K-Love, Sinclair comparable agreements' },
  { category: 'Utility / Cooperative',      marketLow: 3600,  marketHigh: 7200,  marketAvg: 5400,  source: 'Public utility and co-op tower licenses' },
  { category: 'State / Gov\'t Agency',      marketLow: 0,     marketHigh: 1200,  marketAvg: 0,     source: 'Inter-governmental reciprocal agreements' },
]

function categorizeLicensee(name: string): string {
  const n = name.toLowerCase()
  if (n.includes('verizon') || n.includes('t-mobile') || n.includes('sprint') || n.includes('at&t') || n.includes('cingular')) return 'Telecom (Major Carrier)'
  if (n.includes('fbi') || n.includes('customs') || n.includes('faa') || n.includes('noaa')) return 'Federal Agency'
  if (n.includes('gray') || n.includes('wmbf') || n.includes('k-love') || n.includes('wccp') || n.includes('sinclair') || n.includes('nbc')) return 'Broadcast / Non-profit'
  if (n.includes('santee') || n.includes('farmer') || n.includes('telephone') || n.includes('cooperative')) return 'Utility / Cooperative'
  if (n.includes('sled') || n.includes('sc dnr') || n.includes('sc doa') || n.includes('dept of') || n.includes('div. of')) return 'State / Gov\'t Agency'
  return 'Other'
}

function ComparablesReport({ tenancies }: { tenancies: TenancyRow[] }) {
  const active = tenancies.filter(t => ['active', 'pending', 'expiring_soon'].includes(t.status))

  const rows = active.map(t => {
    const cat = categorizeLicensee(t.licensees?.name ?? '')
    const bench = MARKET_BENCHMARKS.find(b => b.category === cat)
    const rent = Number(t.annual_rent)
    const gap = bench ? rent - bench.marketAvg : 0
    return { ...t, cat, bench, rent, gap }
  }).filter(r => r.rent > 0)

  const belowMarket = rows.filter(r => r.gap < -1000)
  const totalGap = belowMarket.reduce((s, r) => s + Math.abs(r.gap), 0)

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '16px' }}>
        <Stat label="Leases Analyzed" value={String(rows.length)} />
        <Stat label="Below Market Rate" value={String(belowMarket.length)} color="#d97706" />
        <Stat label="Annual Revenue Uplift Potential" value={fmt(totalGap)} color="#16a34a" />
      </div>

      <div style={{ marginBottom: '20px' }}>
        <div style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a', marginBottom: '12px' }}>Market Rate Benchmarks</div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #1a3a5c' }}>
              {['Tenant Category', 'Market Low', 'Market Avg', 'Market High', 'Source'].map(h => (
                <th key={h} style={{ padding: '8px 10px', textAlign: 'left', color: '#1a3a5c', fontWeight: 700, fontSize: '12px' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MARKET_BENCHMARKS.map((b, i) => (
              <tr key={b.category} style={{ background: i % 2 === 0 ? 'white' : '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '7px 10px', fontWeight: 600 }}>{b.category}</td>
                <td style={{ padding: '7px 10px' }}>{b.marketLow === 0 ? '$0' : fmt(b.marketLow)}</td>
                <td style={{ padding: '7px 10px', fontWeight: 600 }}>{fmt(b.marketAvg)}</td>
                <td style={{ padding: '7px 10px' }}>{fmt(b.marketHigh)}</td>
                <td style={{ padding: '7px 10px', color: '#94a3b8', fontSize: '11px' }}>{b.source}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {belowMarket.length > 0 && (
        <div>
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#d97706', marginBottom: '8px' }}>
            Leases Below Market Rate ({belowMarket.length})
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #e2e8f0', background: '#fffbeb' }}>
                {['Site', 'Licensee', 'Category', 'Current Rate', 'Market Avg', 'Annual Gap'].map(h => (
                  <th key={h} style={{ padding: '7px 10px', textAlign: 'left', color: '#92400e', fontWeight: 600, fontSize: '11px' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {belowMarket.sort((a, b) => a.gap - b.gap).map((t, i) => (
                <tr key={t.id} style={{ background: i % 2 === 0 ? 'white' : '#fffbeb', borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '7px 10px' }}>
                    {t.tower_sites ? <SiteLink id={t.tower_sites.id} code={t.tower_sites.site_code} /> : '—'}
                  </td>
                  <td style={{ padding: '7px 10px' }}><LicenseeLink id={t.licensees?.id} name={t.licensees?.name ?? '—'} /></td>
                  <td style={{ padding: '7px 10px', color: '#64748b' }}>{t.cat}</td>
                  <td style={{ padding: '7px 10px', fontWeight: 600 }}>{fmt(t.rent)}</td>
                  <td style={{ padding: '7px 10px' }}>{t.bench ? fmt(t.bench.marketAvg) : '—'}</td>
                  <td style={{ padding: '7px 10px', fontWeight: 700, color: '#d97706' }}>+{fmt(Math.abs(t.gap))}/yr</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Report: Value Added ──────────────────────────────────────────────────────

function computeLifetimeValue(t: TenancyRow): { valueToDate: number; lifetimeValue: number } {
  if (t.contract_type === 'settlement') {
    const amt = Number(t.settlement_amount ?? 0)
    return { valueToDate: amt, lifetimeValue: amt }
  }
  const rent = Number(t.annual_rent)
  if (!rent) return { valueToDate: 0, lifetimeValue: 0 }
  const rate = 1 + Number(t.escalation_rate ?? 3) / 100
  const start = t.license_start ? new Date(t.license_start) : null
  const end   = t.license_end   ? new Date(t.license_end)   : null
  const now   = new Date()
  if (!start || !end) return { valueToDate: 0, lifetimeValue: 0 }

  const termYears   = Math.max(0, (end.getTime() - start.getTime()) / (365.25 * 24 * 3600 * 1000))
  const activeYears = Math.max(0, (Math.min(now.getTime(), end.getTime()) - start.getTime()) / (365.25 * 24 * 3600 * 1000))

  let lifetimeValue = 0
  for (let i = 0; i < Math.ceil(termYears); i++) lifetimeValue += rent * Math.pow(rate, i)

  let valueToDate = 0
  for (let i = 0; i < Math.floor(activeYears); i++) valueToDate += rent * Math.pow(rate, i)

  return { valueToDate: Math.round(valueToDate), lifetimeValue: Math.round(lifetimeValue) }
}

function ValueAddedReport({ tenancies }: { tenancies: TenancyRow[] }) {
  const [typeFilter, setTypeFilter] = useState<'all' | 'new_agreement' | 'amendment' | 'settlement'>('all')

  const withValue = tenancies.filter(t =>
    t.contract_type === 'settlement'
      ? Number(t.settlement_amount ?? 0) > 0
      : Number(t.annual_rent) > 0
  )

  const rows = withValue
    .map(t => ({ ...t, ...computeLifetimeValue(t) }))
    .filter(t => typeFilter === 'all' || t.contract_type === typeFilter)
    .sort((a, b) => (a.tower_sites?.site_code ?? '').localeCompare(b.tower_sites?.site_code ?? ''))

  const allRows = withValue.map(t => ({ ...t, ...computeLifetimeValue(t) }))
  const totalVTD      = allRows.reduce((s, r) => s + r.valueToDate, 0)
  const totalLifetime = allRows.reduce((s, r) => s + r.lifetimeValue, 0)
  const countByType = (type: string) => allRows.filter(r => r.contract_type === type).length

  // Waterfall data
  const historical = tenancies.filter(t => ['terminated','expired'].includes(t.status) && Number(t.annual_rent) > 0)
  const activeAll  = tenancies.filter(t => ['active','pending','expiring_soon'].includes(t.status))
  const historicalAvg   = historical.length ? Math.round(historical.reduce((s,t) => s + Number(t.annual_rent), 0) / historical.length * Math.min(historical.length, 6)) : 0
  const activeNewRev    = activeAll.filter(t => t.contract_type === 'new_agreement').reduce((s,t) => s + Number(t.annual_rent), 0)
  const amendUplift     = tenancies.filter(t => t.contract_type === 'amendment').reduce((s,t) => s + Number(t.amendment_delta ?? 0), 0)
  const settleTotal     = tenancies.filter(t => t.contract_type === 'settlement').reduce((s,t) => s + Number(t.settlement_amount ?? 0), 0)
  const currentTotal    = activeAll.reduce((s,t) => s + Number(t.annual_rent), 0)

  let wfBase = 0
  const waterfallData = [
    { name: 'Historical\nPortfolio', base: 0,                displayVal: historicalAvg,  fill: '#94a3b8', isTotal: false },
    { name: 'New\nAgreements',       base: (wfBase = 0, wfBase), displayVal: activeNewRev, fill: '#16a34a', isTotal: false },
    { name: 'Amendment\nUplift',     base: (wfBase += activeNewRev, wfBase), displayVal: amendUplift,  fill: '#2563eb', isTotal: false },
    { name: 'Settlements',           base: (wfBase += amendUplift,  wfBase), displayVal: settleTotal,  fill: '#d97706', isTotal: false },
    { name: 'Total Under\nManagement', base: 0,              displayVal: currentTotal + settleTotal, fill: '#1a3a5c', isTotal: true },
  ]

  const thStyle: React.CSSProperties = { padding: '8px 10px', textAlign: 'left', color: '#1a3a5c', fontWeight: 700, fontSize: '12px' }
  const tdBase:  React.CSSProperties = { padding: '7px 10px', fontSize: '13px' }

  return (
    <div>
      <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '16px' }}>
        This report details the value added by Columbia Wireless. There are 3 types of value: New Agreements brought to the portfolio, Amendments to existing agreements (rent increases negotiated), and Settlements (fees collected when carriers leave equipment behind on de-install).
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '20px' }}>
        <Stat label="New Agreements" value={String(countByType('new_agreement'))} color="#15803d" />
        <Stat label="Amendments" value={String(countByType('amendment'))} color="#1d4ed8" />
        <Stat label="Settlements" value={String(countByType('settlement'))} color="#92400e" />
        <Stat label="Total Lifetime Value" value={fmt(totalLifetime)} color="#7c3aed" />
      </div>

      {/* Waterfall chart */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a', marginBottom: '8px' }}>Value Bridge — Columbia Wireless Contribution</div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={waterfallData} margin={{ top: 8, right: 8, left: 0, bottom: 24 }} barCategoryGap="25%">
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#475569' }} axisLine={false} tickLine={false} interval={0} />
            <YAxis tickFormatter={fmtK} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={56} />
            <Tooltip
              formatter={(value: any, name: any) => name === 'base' ? null : [fmt(Number(value)), 'Value']}
              contentStyle={{ fontSize: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}
            />
            <Bar dataKey="base" stackId="wf" fill="transparent" isAnimationActive={false} />
            <Bar dataKey="displayVal" stackId="wf" radius={[4, 4, 0, 0]} isAnimationActive={false}>
              {waterfallData.map((d, i) => <Cell key={i} fill={d.fill} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap', fontSize: '11px' }}>
          {[
            { label: 'Historical Portfolio Avg', fill: '#94a3b8' },
            { label: 'New Agreements',           fill: '#16a34a' },
            { label: 'Amendment Uplift',         fill: '#2563eb' },
            { label: 'Settlements',              fill: '#d97706' },
            { label: 'Total Under Management',   fill: '#1a3a5c' },
          ].map(l => (
            <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#64748b' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: l.fill }} />
              {l.label}
            </div>
          ))}
        </div>
      </div>

      {/* Type filter */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
        {(['all', 'new_agreement', 'amendment', 'settlement'] as const).map(type => {
          const meta = type === 'all' ? { label: 'All Types', color: '#475569', bg: '#f1f5f9' } : CONTRACT_TYPE_META[type]
          const active = typeFilter === type
          return (
            <button key={type} onClick={() => setTypeFilter(type)}
              style={{ padding: '5px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', border: active ? `2px solid ${meta.color}` : '1px solid #e2e8f0', background: active ? meta.bg : 'white', color: meta.color }}>
              {meta.label}
            </button>
          )
        })}
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #1a3a5c' }}>
            {['Site', 'Carrier', 'Type of Value', 'Commenced', 'Expires', 'Value to Date', 'Lifetime Value'].map(h => (
              <th key={h} style={thStyle}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((t, i) => {
            const meta = CONTRACT_TYPE_META[t.contract_type] ?? CONTRACT_TYPE_META.new_agreement
            return (
              <tr key={t.id} style={{ background: i % 2 === 0 ? 'white' : '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
                <td style={tdBase}>
                  {t.tower_sites ? <SiteLink id={t.tower_sites.id} code={t.tower_sites.site_code} /> : '—'}
                </td>
                <td style={tdBase}><LicenseeLink id={t.licensees?.id} name={t.licensees?.name ?? '—'} /></td>
                <td style={tdBase}>
                  <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '10px', background: meta.bg, color: meta.color, whiteSpace: 'nowrap' }}>
                    {meta.label}
                  </span>
                  {t.contract_type === 'amendment' && t.amendment_delta ? (
                    <span style={{ fontSize: '11px', color: '#16a34a', marginLeft: '6px' }}>+{fmt(Number(t.amendment_delta))}/yr</span>
                  ) : null}
                </td>
                <td style={{ ...tdBase, color: '#64748b' }}>{t.license_start ? fmtDate(t.license_start) : '—'}</td>
                <td style={{ ...tdBase, color: '#64748b' }}>{t.contract_type === 'settlement' ? '—' : (t.license_end ? fmtDate(t.license_end) : '—')}</td>
                <td style={{ ...tdBase, fontWeight: 600 }}>{fmt(t.valueToDate)}</td>
                <td style={{ ...tdBase, fontWeight: 700, color: '#7c3aed' }}>{fmt(t.lifetimeValue)}</td>
              </tr>
            )
          })}
        </tbody>
        <tfoot>
          <tr style={{ borderTop: '2px solid #1a3a5c', fontWeight: 700, background: '#f8fafc' }}>
            <td colSpan={5} style={{ ...tdBase }}>TOTAL ({rows.length} records shown)</td>
            <td style={{ ...tdBase }}>{fmt(rows.reduce((s, r) => s + r.valueToDate, 0))}</td>
            <td style={{ ...tdBase, color: '#7c3aed' }}>{fmt(rows.reduce((s, r) => s + r.lifetimeValue, 0))}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

// ─── Report: Expiry Calendar ──────────────────────────────────────────────────

function ExpiryCalendarReport({ tenancies }: { tenancies: TenancyRow[] }) {
  const now = new Date()
  const upcoming = [...tenancies]
    .filter(t => ['active', 'pending', 'expiring_soon'].includes(t.status) && new Date(t.license_end) >= now)
    .sort((a, b) => new Date(a.license_end).getTime() - new Date(b.license_end).getTime())
    .slice(0, 30)
  return (
    <div>
      <div style={{ marginBottom: '16px', fontSize: '13px', color: '#64748b' }}>Sorted by upcoming expiration. Licenses expiring within 180 days are highlighted.</div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #1a3a5c' }}>
            {['Site Code', 'Site Name', 'Licensee', 'License End', 'Days Left', 'Annual Rent'].map(h => (
              <th key={h} style={{ padding: '8px 10px', textAlign: 'left', color: '#1a3a5c', fontWeight: 700, fontSize: '12px' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {upcoming.map((t, i) => {
            const days = Math.round((new Date(t.license_end).getTime() - now.getTime()) / 86400000)
            const urgent = days <= 180
            return (
              <tr key={t.id} style={{ background: urgent ? '#fffbeb' : i % 2 === 0 ? 'white' : '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '7px 10px' }}>{t.tower_sites ? <SiteLink id={t.tower_sites.id} code={t.tower_sites.site_code} /> : '—'}</td>
                <td style={{ padding: '7px 10px' }}>{t.tower_sites?.name ?? '—'}</td>
                <td style={{ padding: '7px 10px' }}><LicenseeLink id={t.licensees?.id} name={t.licensees?.name ?? '—'} /></td>
                <td style={{ padding: '7px 10px' }}>{fmtDate(t.license_end)}</td>
                <td style={{ padding: '7px 10px', fontWeight: urgent ? 700 : 400, color: urgent ? '#d97706' : '#334155' }}>{days}d</td>
                <td style={{ padding: '7px 10px', fontWeight: 600 }}>{fmt(Number(t.annual_rent))}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ─── Report: Exceptions ───────────────────────────────────────────────────────

function ExceptionsReport({ tenancies }: { tenancies: TenancyRow[] }) {
  const exceptions = tenancies.filter(t => !['active', 'pending'].includes(t.status))
  const byStatus: Record<string, TenancyRow[]> = {}
  exceptions.forEach(t => { (byStatus[t.status] = byStatus[t.status] || []).push(t) })
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '20px' }}>
        <Stat label="Expiring Soon" value={String(tenancies.filter(t => t.status === 'expiring_soon').length)} color="#d97706" />
        <Stat label="Expired" value={String(tenancies.filter(t => t.status === 'expired').length)} color="#dc2626" />
        <Stat label="Terminated" value={String(tenancies.filter(t => t.status === 'terminated').length)} color="#be185d" />
      </div>
      {Object.entries(byStatus).map(([status, group]) => (
        <div key={status} style={{ marginBottom: '20px' }}>
          <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {status.replace('_', ' ')} ({group.length})
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
                {['Site Code', 'Site Name', 'Licensee', 'License End', 'Annual Rent', 'Notes'].map(h => (
                  <th key={h} style={{ padding: '7px 10px', textAlign: 'left', color: '#64748b', fontWeight: 600, fontSize: '11px' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {group.map(t => (
                <tr key={t.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '7px 10px' }}>{t.tower_sites ? <SiteLink id={t.tower_sites.id} code={t.tower_sites.site_code} /> : '—'}</td>
                  <td style={{ padding: '7px 10px' }}>{t.tower_sites?.name ?? '—'}</td>
                  <td style={{ padding: '7px 10px' }}><LicenseeLink id={t.licensees?.id} name={t.licensees?.name ?? '—'} /></td>
                  <td style={{ padding: '7px 10px' }}>{fmtDate(t.license_end)}</td>
                  <td style={{ padding: '7px 10px', fontWeight: 600 }}>{fmt(Number(t.annual_rent))}</td>
                  <td style={{ padding: '7px 10px', color: '#64748b', fontSize: '12px' }}>{t.notes || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  )
}

// ─── Report: Lease Timeline (Gantt) ──────────────────────────────────────────

const GANTT_COLORS: Record<string, string> = {
  telecom: '#2563eb', federal: '#7c3aed', broadcast: '#d97706',
  utility: '#16a34a', state: '#64748b',   other: '#94a3b8',
}

function ganttCategory(name: string): string {
  const n = name.toLowerCase()
  if (n.includes('verizon') || n.includes('t-mobile') || n.includes('sprint') || n.includes('at&t') || n.includes('cingular')) return 'telecom'
  if (n.includes('fbi') || n.includes('customs') || n.includes('faa') || n.includes('noaa')) return 'federal'
  if (n.includes('gray') || n.includes('wmbf') || n.includes('k-love') || n.includes('wccp') || n.includes('sinclair') || n.includes('nbc') || n.includes('fm')) return 'broadcast'
  if (n.includes('santee') || n.includes('farmer') || n.includes('telephone') || n.includes('cooperative')) return 'utility'
  if (n.includes('sled') || n.includes('sc dnr') || n.includes('sc doa') || n.includes('dept of') || n.includes('div.')) return 'state'
  return 'other'
}

function LeaseTimelineReport({ tenancies }: { tenancies: TenancyRow[] }) {
  const paying = tenancies.filter(t =>
    Number(t.annual_rent) > 0 && t.license_start && t.license_end && t.tower_sites
  )

  // Group by site
  const siteMap = new Map<string, { siteCode: string; siteName: string; siteId: string; lics: TenancyRow[] }>()
  paying.forEach(t => {
    const sid = t.tower_sites!.id
    if (!siteMap.has(sid)) siteMap.set(sid, { siteCode: t.tower_sites!.site_code, siteName: t.tower_sites!.name, siteId: sid, lics: [] })
    siteMap.get(sid)!.lics.push(t)
  })
  const sites = [...siteMap.values()].sort((a, b) => a.siteCode.localeCompare(b.siteCode))

  if (!sites.length) return <div style={{ color: '#94a3b8', fontSize: '13px' }}>No license data for timeline.</div>

  const allYears = paying.flatMap(t => [
    new Date(t.license_start!).getFullYear(),
    new Date(t.license_end!).getFullYear(),
  ])
  const minYear   = Math.min(...allYears)
  const maxYear   = Math.max(...allYears, new Date().getFullYear() + 1)
  const yearSpan  = maxYear - minYear || 1
  const todayYear = new Date().getFullYear() + (new Date().getMonth() / 12)

  const LEFT_PAD  = 120
  const RIGHT_PAD = 16
  const ROW_H     = 34
  const TOP_PAD   = 32
  const SVG_W     = 860
  const CHART_W   = SVG_W - LEFT_PAD - RIGHT_PAD
  const SVG_H     = TOP_PAD + sites.length * ROW_H + 28

  const xOf = (year: number) => LEFT_PAD + ((year - minYear) / yearSpan) * CHART_W

  const tickYears = Array.from({ length: maxYear - minYear + 1 }, (_, i) => minYear + i)
    .filter(y => yearSpan <= 10 ? true : y % 2 === 0)

  return (
    <div>
      <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '12px' }}>
        Each bar represents one lease. Bar width = contract term. Bar height reflects annual rent (taller = higher value). Opacity: solid = active, faded = historical. Dashed line = today.
      </p>

      {/* Legend */}
      <div style={{ display: 'flex', gap: '14px', marginBottom: '16px', flexWrap: 'wrap' }}>
        {Object.entries(GANTT_COLORS).map(([cat, color]) => (
          <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: '#64748b' }}>
            <div style={{ width: '12px', height: '10px', borderRadius: '2px', background: color }} />
            <span style={{ textTransform: 'capitalize' }}>{cat}</span>
          </div>
        ))}
      </div>

      <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
        <svg width={SVG_W} height={SVG_H} style={{ display: 'block' }}>

          {/* Year grid lines + labels */}
          {tickYears.map(y => {
            const x = xOf(y)
            return (
              <g key={y}>
                <line x1={x} y1={TOP_PAD - 6} x2={x} y2={SVG_H - 24} stroke="#e2e8f0" strokeWidth={1} />
                <text x={x} y={TOP_PAD - 10} textAnchor="middle" fontSize={10} fill="#94a3b8">{y}</text>
              </g>
            )
          })}

          {/* Today dashed line */}
          {(() => {
            const tx = xOf(todayYear)
            return (
              <>
                <line x1={tx} y1={TOP_PAD - 6} x2={tx} y2={SVG_H - 24} stroke="#2563eb" strokeWidth={1.5} strokeDasharray="4 3" />
                <text x={tx} y={TOP_PAD - 12} textAnchor="middle" fontSize={9} fill="#2563eb" fontWeight="600">Today</text>
              </>
            )
          })()}

          {/* Site rows */}
          {sites.map((site, si) => {
            const rowY   = TOP_PAD + si * ROW_H
            const maxRent = Math.max(...site.lics.map(l => Number(l.annual_rent)))

            return (
              <g key={site.siteId}>
                <rect x={0} y={rowY} width={SVG_W} height={ROW_H}
                  fill={si % 2 === 0 ? 'white' : '#f8fafc'} />
                <text x={LEFT_PAD - 8} y={rowY + ROW_H / 2 + 4}
                  textAnchor="end" fontSize={11} fill="#334155" fontWeight="600">
                  {site.siteCode}
                </text>

                {site.lics.map(lic => {
                  const sx    = xOf(new Date(lic.license_start!).getFullYear())
                  const ex    = xOf(new Date(lic.license_end!).getFullYear())
                  const barW  = Math.max(3, ex - sx)
                  const ratio = maxRent > 0 ? Number(lic.annual_rent) / maxRent : 0.5
                  const barH  = Math.round(8 + ratio * 16)
                  const barY  = rowY + (ROW_H - barH) / 2
                  const cat   = ganttCategory(lic.licensees?.name ?? '')
                  const active = ['active','pending','expiring_soon'].includes(lic.status)

                  return (
                    <g key={lic.id}>
                      <rect x={sx} y={barY} width={barW} height={barH} rx={3}
                        fill={GANTT_COLORS[cat]} opacity={active ? 1 : 0.4}>
                        <title>{lic.licensees?.name ?? '?'} · {fmt(Number(lic.annual_rent))}/yr · {lic.license_start} → {lic.license_end}</title>
                      </rect>
                    </g>
                  )
                })}
              </g>
            )
          })}

          {/* Bottom year axis line */}
          <line x1={LEFT_PAD} y1={SVG_H - 24} x2={SVG_W - RIGHT_PAD} y2={SVG_H - 24} stroke="#e2e8f0" strokeWidth={1} />
        </svg>
      </div>
    </div>
  )
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ background: '#f8fafc', borderRadius: '8px', padding: '12px 14px', border: '1px solid #e2e8f0' }}>
      <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
      <div style={{ fontSize: '18px', fontWeight: 700, color: color || '#0f172a' }}>{value}</div>
    </div>
  )
}

function SiteLink({ id, code }: { id: string; code: string }) {
  return (
    <Link href={`/sites/${id}`} style={{ fontWeight: 600, color: '#2563eb', textDecoration: 'none' }}
      onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
      onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}>
      {code}
    </Link>
  )
}

function LicenseeLink({ id, name }: { id: string | undefined; name: string }) {
  if (!id) return <span style={{ color: '#64748b' }}>{name}</span>
  return (
    <Link href={`/tenants/${id}`} style={{ color: '#64748b', textDecoration: 'none' }}
      onMouseEnter={e => { e.currentTarget.style.color = '#2563eb'; e.currentTarget.style.textDecoration = 'underline' }}
      onMouseLeave={e => { e.currentTarget.style.color = '#64748b'; e.currentTarget.style.textDecoration = 'none' }}>
      {name}
    </Link>
  )
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
