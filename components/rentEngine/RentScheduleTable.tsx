'use client'

import { useState } from 'react'
import { Calendar } from 'lucide-react'
import RentScheduleIssues, { RentScheduleIssue } from './RentScheduleIssues'

// Mirrors lib/rentEngine/types/lease.ts's RentScheduleItem / OneTimeCharge —
// kept as local types here rather than imported so this component (which
// runs in the browser) never needs to bundle the server-only engine code,
// just the shape of what the API already serialized.
export interface RentScheduleRow {
  periodIndex: number
  formattedPeriod: string // YYYY-MM
  siteId: string
  siteCode: string
  siteName: string
  tenantName: string
  baseRent: number
  escalationAmount: number
  fixedMonthlyCharge: number
  totalMonthlyRent: number
  netMonthlyRent?: number
  contractRent: number
  paymentFrequency: string
  activeDocReference: string
  docType: string
  status: 'active' | 'projected' | 'pending_resolution'
}

export interface OneTimeChargeRow {
  description: string
  amount: number
  dueDate: string | null
  siteCode: string
  tenantName: string
  sourceDocReference: string
}

interface Props {
  rows: RentScheduleRow[]
  oneTimeCharges: OneTimeChargeRow[]
  issues: RentScheduleIssue[]
  siteId: string
  /** Show the Site column — turn on when rolling up multiple sites (owner view). */
  showSite?: boolean
  /** Show the Tenant column — turn on when rolling up multiple carriers (owner/site view). */
  showTenant?: boolean
}

const STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  active:             { bg: '#dcfce7', color: '#15803d', label: 'Active' },
  projected:          { bg: '#eff6ff', color: '#1d4ed8', label: 'Projected' },
  pending_resolution: { bg: '#fef3c7', color: '#92400e', label: 'Pending' },
}

function fmt(n: number | undefined) {
  if (n === undefined) return '—'
  return '$' + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function RentScheduleTable({ rows, oneTimeCharges, issues, siteId, showSite = false, showTenant = false }: Props) {
  const [expanded, setExpanded] = useState(false)
  const visibleRows = expanded ? rows : rows.slice(0, 24) // one row per month for 2 years by default

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <RentScheduleIssues issues={issues} siteId={siteId} hasNoRows={rows.length === 0} />

      {oneTimeCharges.length > 0 && (
        <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden' }}>
          <div style={{ padding: '10px 16px', background: '#f8fafc', borderBottom: '1px solid #f1f5f9', fontSize: '12px', fontWeight: 600, color: '#475569' }}>
            One-time charges
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                {['Description', 'Amount', 'Due', 'Source'].map(h => (
                  <th key={h} style={{ padding: '8px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {oneTimeCharges.map((c, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #f8fafc' }}>
                  <td style={{ padding: '8px 16px', fontSize: '13px', color: '#0f172a' }}>{c.description}</td>
                  <td style={{ padding: '8px 16px', fontSize: '13px', fontWeight: 600, color: '#0f172a' }}>{fmt(c.amount)}</td>
                  <td style={{ padding: '8px 16px', fontSize: '13px', color: '#64748b' }}>{c.dueDate ?? <span style={{ fontStyle: 'italic', color: '#94a3b8' }}>not stated</span>}</td>
                  <td style={{ padding: '8px 16px', fontSize: '12px', color: '#94a3b8' }}>{c.sourceDocReference}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {rows.length > 0 && (
        <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', background: '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
            <Calendar size={13} color="#64748b" />
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>Rent schedule</span>
            <span style={{ fontSize: '11px', color: '#94a3b8' }}>{rows.length} period{rows.length !== 1 ? 's' : ''}</span>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                {[
                  'Period',
                  ...(showSite ? ['Site'] : []),
                  ...(showTenant ? ['Tenant'] : []),
                  'Base Rent', 'Escalation', 'Fixed Charge', 'Total', 'Status', 'Source',
                ].map(h => (
                  <th key={h} style={{ padding: '8px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleRows.map(row => {
                const st = STATUS_STYLE[row.status] ?? STATUS_STYLE.projected
                return (
                  <tr key={row.periodIndex} style={{ borderBottom: '1px solid #f8fafc' }}>
                    <td style={{ padding: '7px 16px', fontSize: '13px', color: '#0f172a', fontWeight: 500 }}>{row.formattedPeriod}</td>
                    {showSite && <td style={{ padding: '7px 16px', fontSize: '13px', color: '#64748b' }}>{row.siteCode}</td>}
                    {showTenant && <td style={{ padding: '7px 16px', fontSize: '13px', color: '#64748b' }}>{row.tenantName}</td>}
                    <td style={{ padding: '7px 16px', fontSize: '13px', color: '#64748b' }}>{fmt(row.baseRent)}</td>
                    <td style={{ padding: '7px 16px', fontSize: '13px', color: '#64748b' }}>{fmt(row.escalationAmount)}</td>
                    <td style={{ padding: '7px 16px', fontSize: '13px', color: '#64748b' }}>{fmt(row.fixedMonthlyCharge)}</td>
                    <td style={{ padding: '7px 16px', fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>{fmt(row.totalMonthlyRent)}</td>
                    <td style={{ padding: '7px 16px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '10px', background: st.bg, color: st.color }}>{st.label}</span>
                    </td>
                    <td style={{ padding: '7px 16px', fontSize: '12px', color: '#94a3b8' }}>{row.activeDocReference}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {rows.length > 24 && (
            <button
              onClick={() => setExpanded(v => !v)}
              style={{ width: '100%', padding: '10px', background: '#f8fafc', border: 'none', borderTop: '1px solid #f1f5f9', fontSize: '12px', fontWeight: 600, color: '#2563eb', cursor: 'pointer' }}
            >
              {expanded ? 'Show fewer periods' : `Show all ${rows.length} periods`}
            </button>
          )}
        </div>
      )}

      {rows.length === 0 && oneTimeCharges.length === 0 && issues.length === 0 && (
        <div style={{ padding: '32px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
          No rent schedule data yet.
        </div>
      )}
    </div>
  )
}
