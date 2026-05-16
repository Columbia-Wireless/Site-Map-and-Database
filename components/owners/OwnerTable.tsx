'use client'

import Link from 'next/link'
import { SiteOwner } from '@/lib/types'

const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)

const TYPE_LABELS: Record<string, string> = {
  corporate: 'Corporate / PE',
  municipality: 'Municipality',
  state: 'State Gov.',
  federal: 'Federal Gov.',
  utility: 'Utility',
  private: 'Private',
  nonprofit: 'Nonprofit',
  other: 'Other',
}

const TYPE_COLORS: Record<string, { bg: string; color: string }> = {
  corporate:    { bg: '#eff6ff', color: '#2563eb' },
  municipality: { bg: '#f0fdf4', color: '#15803d' },
  state:        { bg: '#f0fdf4', color: '#166534' },
  federal:      { bg: '#fef3c7', color: '#b45309' },
  utility:      { bg: '#fdf4ff', color: '#9333ea' },
  private:      { bg: '#f1f5f9', color: '#475569' },
  nonprofit:    { bg: '#fff7ed', color: '#c2410c' },
  other:        { bg: '#f8fafc', color: '#64748b' },
}

type OwnerRow = SiteOwner & {
  site_count: number
  vacant_count: number
  annual_revenue: number
}

interface Props {
  owners: OwnerRow[]
}

export default function OwnerTable({ owners }: Props) {
  if (owners.length === 0) {
    return (
      <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '48px', textAlign: 'center', color: '#94a3b8', fontSize: '14px' }}>
        No owners on record. Add your first owner to get started.
      </div>
    )
  }

  return (
    <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
            {['Owner', 'Type', 'Primary Contact', 'Sites', 'Vacant', 'Annual Revenue', 'Status'].map(h => (
              <th key={h} style={{ padding: '9px 14px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {owners.map((owner, i) => {
            const typeStyle = TYPE_COLORS[owner.type] ?? TYPE_COLORS.other
            return (
              <tr
                key={owner.id}
                style={{ background: i % 2 === 0 ? 'white' : '#fafafa', borderBottom: '1px solid #f1f5f9', cursor: 'pointer' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#f0f7ff')}
                onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? 'white' : '#fafafa')}
              >
                <td style={{ padding: '12px 14px' }}>
                  <Link href={`/owners/${owner.id}`} style={{ textDecoration: 'none' }}>
                    <div style={{ fontWeight: 600, color: '#1a3a5c', fontSize: '14px' }}>{owner.name}</div>
                    {(owner.city || owner.state) && (
                      <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>
                        {[owner.city, owner.state].filter(Boolean).join(', ')}
                      </div>
                    )}
                  </Link>
                </td>
                <td style={{ padding: '12px 14px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 600, padding: '3px 8px', borderRadius: '12px', background: typeStyle.bg, color: typeStyle.color, whiteSpace: 'nowrap' }}>
                    {TYPE_LABELS[owner.type] ?? owner.type}
                  </span>
                </td>
                <td style={{ padding: '12px 14px', fontSize: '13px', color: '#334155' }}>
                  {owner.contact_name || '—'}
                  {owner.contact_email && (
                    <div style={{ fontSize: '12px', color: '#94a3b8' }}>{owner.contact_email}</div>
                  )}
                </td>
                <td style={{ padding: '12px 14px', fontSize: '14px', fontWeight: 600, color: '#0f172a' }}>
                  {owner.site_count}
                </td>
                <td style={{ padding: '12px 14px' }}>
                  <span style={{
                    fontSize: '13px', fontWeight: 600,
                    color: owner.vacant_count > 0 ? '#d97706' : '#16a34a',
                  }}>
                    {owner.vacant_count}
                  </span>
                </td>
                <td style={{ padding: '12px 14px', fontSize: '14px', fontWeight: 600, color: '#0f172a' }}>
                  {owner.annual_revenue > 0 ? fmt(owner.annual_revenue) : <span style={{ color: '#94a3b8', fontWeight: 400 }}>—</span>}
                </td>
                <td style={{ padding: '12px 14px' }}>
                  <span style={{
                    fontSize: '11px', fontWeight: 600, padding: '3px 8px', borderRadius: '12px',
                    background: owner.status === 'active' ? '#dcfce7' : '#f1f5f9',
                    color: owner.status === 'active' ? '#15803d' : '#475569',
                  }}>
                    {owner.status === 'active' ? 'Active' : 'Inactive'}
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
