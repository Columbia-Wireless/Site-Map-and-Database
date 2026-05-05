'use client'

import { useState } from 'react'
import Link from 'next/link'
import { FileText, Download, AlertTriangle, Calendar, DollarSign, TrendingUp } from 'lucide-react'
import { TowerSite } from '@/lib/types'

const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)

const REPORTS = [
  {
    id: 'rent_roll',
    title: 'Rent Roll Summary',
    description: 'Complete listing of all sites with current annual rent, escalation rate, and lease terms.',
    icon: DollarSign,
    color: '#eff6ff',
    iconColor: '#2563eb',
  },
  {
    id: 'expiry_calendar',
    title: 'Lease Expiry Calendar',
    description: 'Sites organized by upcoming lease expiration date for proactive renewal management.',
    icon: Calendar,
    color: '#fffbeb',
    iconColor: '#d97706',
  },
  {
    id: 'exceptions',
    title: 'Exceptions Report',
    description: 'Sites requiring immediate attention — expired leases, active disputes, and expiring within 180 days.',
    icon: AlertTriangle,
    color: '#fef2f2',
    iconColor: '#dc2626',
  },
  {
    id: 'revenue_analysis',
    title: 'Revenue Analysis',
    description: 'Portfolio revenue breakdown by state, tenant, and tower type with escalation projections.',
    icon: TrendingUp,
    color: '#f0fdf4',
    iconColor: '#16a34a',
  },
]

export default function ReportsClient({ sites }: { sites: TowerSite[] }) {
  const [generating, setGenerating] = useState<string | null>(null)
  const [preview, setPreview] = useState<string | null>(null)

  function generateReport(id: string) {
    setGenerating(id)
    setTimeout(() => {
      setGenerating(null)
      setPreview(id)
    }, 800)
  }

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', marginBottom: '28px' }}>
        {REPORTS.map(report => (
          <div key={report.id} style={{
            background: 'white', border: '1px solid #e2e8f0', borderRadius: '10px',
            padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          }}>
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
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                background: generating === report.id ? '#f1f5f9' : '#1a3a5c',
                color: generating === report.id ? '#94a3b8' : 'white',
                border: 'none', borderRadius: '7px', padding: '8px 16px',
                fontSize: '13px', fontWeight: 600, cursor: generating === report.id ? 'default' : 'pointer',
              }}
            >
              <FileText size={14} />
              {generating === report.id ? 'Generating…' : 'Generate Report'}
            </button>
          </div>
        ))}
      </div>

      {preview && <ReportPreview id={preview} sites={sites} onClose={() => setPreview(null)} />}
    </div>
  )
}

function ReportPreview({ id, sites, onClose }: { id: string; sites: TowerSite[]; onClose: () => void }) {
  const report = REPORTS.find(r => r.id === id)!
  const now = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

  const content = {
    rent_roll: <RentRollReport sites={sites} />,
    expiry_calendar: <ExpiryCalendarReport sites={sites} />,
    exceptions: <ExceptionsReport sites={sites} />,
    revenue_analysis: <RevenueAnalysisReport sites={sites} />,
  }[id]

  return (
    <div style={{
      background: 'white', border: '1px solid #e2e8f0', borderRadius: '10px',
      boxShadow: '0 4px 16px rgba(0,0,0,0.08)', overflow: 'hidden',
    }}>
      {/* Report header bar */}
      <div style={{
        background: '#1a3a5c', padding: '16px 24px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div>
          <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '11px', marginBottom: '2px' }}>
            COLUMBIA WIRELESS FACILITIES
          </div>
          <div style={{ color: 'white', fontSize: '16px', fontWeight: 700 }}>{report.title}</div>
          <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', marginTop: '2px' }}>Generated {now}</div>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => window.print()}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              background: 'rgba(255,255,255,0.15)', color: 'white',
              border: '1px solid rgba(255,255,255,0.3)', borderRadius: '6px',
              padding: '7px 14px', fontSize: '13px', cursor: 'pointer',
            }}
          >
            <Download size={14} /> Export PDF
          </button>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.1)', color: 'white',
              border: '1px solid rgba(255,255,255,0.2)', borderRadius: '6px',
              padding: '7px 12px', fontSize: '13px', cursor: 'pointer',
            }}
          >
            ✕
          </button>
        </div>
      </div>
      <div style={{ padding: '24px' }}>{content}</div>
    </div>
  )
}

function RentRollReport({ sites }: { sites: TowerSite[] }) {
  const total = sites.reduce((s, x) => s + Number(x.annual_rent), 0)
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '20px' }}>
        <Stat label="Total Sites" value={String(sites.length)} />
        <Stat label="Annual Revenue" value={fmt(total)} />
        <Stat label="Avg. Rent / Site" value={fmt(total / sites.length)} />
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #1a3a5c' }}>
            {['Site Code', 'Name', 'Tenant', 'Annual Rent', 'Escalation', 'Lease End'].map(h => (
              <th key={h} style={{ padding: '8px 10px', textAlign: 'left', color: '#1a3a5c', fontWeight: 700, fontSize: '12px' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sites.slice(0, 20).map((s, i) => (
            <tr key={s.id} style={{ background: i % 2 === 0 ? 'white' : '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
              <td style={{ padding: '7px 10px' }}>
                <Link href={`/sites/${s.id}`} style={{ fontWeight: 600, color: '#2563eb', textDecoration: 'none' }}
                  onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
                  onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}>
                  {s.site_code}
                </Link>
              </td>
              <td style={{ padding: '7px 10px' }}>{s.name}</td>
              <td style={{ padding: '7px 10px', color: '#64748b' }}>{s.tenant_name}</td>
              <td style={{ padding: '7px 10px', fontWeight: 600 }}>{fmt(Number(s.annual_rent))}</td>
              <td style={{ padding: '7px 10px' }}>{s.escalation_rate}%</td>
              <td style={{ padding: '7px 10px', color: '#64748b' }}>{new Date(s.lease_end).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr style={{ borderTop: '2px solid #1a3a5c', fontWeight: 700 }}>
            <td colSpan={3} style={{ padding: '8px 10px' }}>TOTAL ({sites.length} sites)</td>
            <td style={{ padding: '8px 10px' }}>{fmt(total)}</td>
            <td colSpan={2} />
          </tr>
        </tfoot>
      </table>
      {sites.length > 20 && <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: '12px', marginTop: '12px' }}>Showing 20 of {sites.length} sites. Full report includes all records.</div>}
    </div>
  )
}

function ExpiryCalendarReport({ sites }: { sites: TowerSite[] }) {
  const now = new Date()
  const upcoming = [...sites]
    .filter(s => new Date(s.lease_end) >= now)
    .sort((a, b) => new Date(a.lease_end).getTime() - new Date(b.lease_end).getTime())
    .slice(0, 25)

  return (
    <div>
      <div style={{ marginBottom: '16px', fontSize: '13px', color: '#64748b' }}>
        Sorted by upcoming lease expiration. Sites expiring within 180 days are highlighted.
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #1a3a5c' }}>
            {['Site Code', 'Name', 'State', 'Tenant', 'Lease End', 'Days Remaining', 'Annual Rent'].map(h => (
              <th key={h} style={{ padding: '8px 10px', textAlign: 'left', color: '#1a3a5c', fontWeight: 700, fontSize: '12px' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {upcoming.map((s, i) => {
            const days = Math.round((new Date(s.lease_end).getTime() - now.getTime()) / 86400000)
            const urgent = days <= 180
            return (
              <tr key={s.id} style={{ background: urgent ? '#fffbeb' : i % 2 === 0 ? 'white' : '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '7px 10px' }}>
                <Link href={`/sites/${s.id}`} style={{ fontWeight: 600, color: '#2563eb', textDecoration: 'none' }}
                  onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
                  onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}>
                  {s.site_code}
                </Link>
              </td>
                <td style={{ padding: '7px 10px' }}>{s.name}</td>
                <td style={{ padding: '7px 10px', color: '#64748b' }}>{s.state}</td>
                <td style={{ padding: '7px 10px', color: '#64748b' }}>{s.tenant_name}</td>
                <td style={{ padding: '7px 10px' }}>{new Date(s.lease_end).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                <td style={{ padding: '7px 10px', fontWeight: urgent ? 700 : 400, color: urgent ? '#d97706' : '#334155' }}>{days} days</td>
                <td style={{ padding: '7px 10px', fontWeight: 600 }}>{fmt(Number(s.annual_rent))}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function ExceptionsReport({ sites }: { sites: TowerSite[] }) {
  const exceptions = sites.filter(s => s.status !== 'active' && s.status !== 'pending')
  const byStatus: Record<string, TowerSite[]> = {}
  exceptions.forEach(s => { (byStatus[s.status] = byStatus[s.status] || []).push(s) })

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '20px' }}>
        <Stat label="Expiring Soon" value={String(sites.filter(s => s.status === 'expiring_soon').length)} color="#d97706" />
        <Stat label="Expired" value={String(sites.filter(s => s.status === 'expired').length)} color="#dc2626" />
        <Stat label="Disputed" value={String(sites.filter(s => s.status === 'disputed').length)} color="#be185d" />
      </div>
      {Object.entries(byStatus).map(([status, group]) => (
        <div key={status} style={{ marginBottom: '20px' }}>
          <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {status.replace('_', ' ')} ({group.length})
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
                {['Site Code', 'Name', 'Tenant', 'Lease End', 'Annual Rent', 'Notes'].map(h => (
                  <th key={h} style={{ padding: '7px 10px', textAlign: 'left', color: '#64748b', fontWeight: 600, fontSize: '11px' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {group.map(s => (
                <tr key={s.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '7px 10px' }}>
                <Link href={`/sites/${s.id}`} style={{ fontWeight: 600, color: '#2563eb', textDecoration: 'none' }}
                  onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
                  onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}>
                  {s.site_code}
                </Link>
              </td>
                  <td style={{ padding: '7px 10px' }}>{s.name}</td>
                  <td style={{ padding: '7px 10px', color: '#64748b' }}>{s.tenant_name}</td>
                  <td style={{ padding: '7px 10px' }}>{new Date(s.lease_end).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                  <td style={{ padding: '7px 10px', fontWeight: 600 }}>{fmt(Number(s.annual_rent))}</td>
                  <td style={{ padding: '7px 10px', color: '#64748b', fontSize: '12px' }}>{s.notes || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  )
}

function RevenueAnalysisReport({ sites }: { sites: TowerSite[] }) {
  const byState: Record<string, { count: number; revenue: number }> = {}
  sites.forEach(s => {
    if (!byState[s.state]) byState[s.state] = { count: 0, revenue: 0 }
    byState[s.state].count++
    byState[s.state].revenue += Number(s.annual_rent)
  })
  const stateData = Object.entries(byState).sort((a, b) => b[1].revenue - a[1].revenue)
  const total = sites.reduce((s, x) => s + Number(x.annual_rent), 0)

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '20px' }}>
        <Stat label="Total Annual Revenue" value={fmt(total)} />
        <Stat label="Projected (1yr @ avg escalation)" value={fmt(total * 1.03)} />
        <Stat label="Projected (5yr)" value={fmt(total * Math.pow(1.03, 5))} />
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #1a3a5c' }}>
            {['State', 'Sites', 'Annual Revenue', 'Avg / Site', '% of Portfolio'].map(h => (
              <th key={h} style={{ padding: '8px 10px', textAlign: 'left', color: '#1a3a5c', fontWeight: 700, fontSize: '12px' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {stateData.map(([state, { count, revenue }], i) => (
            <tr key={state} style={{ background: i % 2 === 0 ? 'white' : '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
              <td style={{ padding: '7px 10px', fontWeight: 600 }}>{state}</td>
              <td style={{ padding: '7px 10px', color: '#64748b' }}>{count}</td>
              <td style={{ padding: '7px 10px', fontWeight: 600 }}>{fmt(revenue)}</td>
              <td style={{ padding: '7px 10px' }}>{fmt(revenue / count)}</td>
              <td style={{ padding: '7px 10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ height: '6px', width: `${Math.round((revenue / total) * 100)}%`, background: '#2563eb', borderRadius: '3px', minWidth: '4px' }} />
                  <span style={{ color: '#64748b' }}>{((revenue / total) * 100).toFixed(1)}%</span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ background: '#f8fafc', borderRadius: '8px', padding: '12px 14px', border: '1px solid #e2e8f0' }}>
      <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
      <div style={{ fontSize: '20px', fontWeight: 700, color: color || '#0f172a' }}>{value}</div>
    </div>
  )
}
