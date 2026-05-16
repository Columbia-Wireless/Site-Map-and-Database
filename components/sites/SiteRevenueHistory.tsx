'use client'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts'

interface License {
  id: string
  licensee_name: string
  annual_rent: number
  license_start: string | null
  license_end: string | null
  status: string
}

const TENANT_CATEGORIES: Record<string, { label: string; color: string }> = {
  telecom:   { label: 'Telecom',          color: '#2563eb' },
  federal:   { label: 'Federal Agency',   color: '#7c3aed' },
  broadcast: { label: 'Broadcast / Media', color: '#d97706' },
  utility:   { label: 'Utility / Co-op',  color: '#16a34a' },
  state:     { label: 'State Agency',     color: '#64748b' },
  other:     { label: 'Other',            color: '#94a3b8' },
}

function categorize(name: string): keyof typeof TENANT_CATEGORIES {
  const n = name.toLowerCase()
  if (n.includes('verizon') || n.includes('t-mobile') || n.includes('sprint') || n.includes('at&t') || n.includes('cingular')) return 'telecom'
  if (n.includes('fbi') || n.includes('customs') || n.includes('faa') || n.includes('noaa') || n.includes('federal')) return 'federal'
  if (n.includes('gray') || n.includes('wmbf') || n.includes('k-love') || n.includes('wccp') || n.includes('sinclair') || n.includes('nbc') || n.includes('fm')) return 'broadcast'
  if (n.includes('santee') || n.includes('farmer') || n.includes('telephone') || n.includes('cooperative')) return 'utility'
  if (n.includes('sled') || n.includes('sc dnr') || n.includes('sc doa') || n.includes('sc dept') || n.includes('dept of')) return 'state'
  return 'other'
}

function buildYearlyData(licenses: License[]) {
  if (!licenses.length) return []

  const starts = licenses
    .map(l => l.license_start ? new Date(l.license_start).getFullYear() : null)
    .filter(Boolean) as number[]
  const ends = licenses
    .map(l => l.license_end ? new Date(l.license_end).getFullYear() : null)
    .filter(Boolean) as number[]

  const minYear = Math.min(...starts, new Date().getFullYear() - 5)
  const maxYear = new Date().getFullYear()

  const years: Record<string, any>[] = []
  for (let y = minYear; y <= maxYear; y++) {
    const row: Record<string, any> = { year: y }
    for (const cat of Object.keys(TENANT_CATEGORIES)) row[cat] = 0

    for (const lic of licenses) {
      if (!lic.annual_rent || lic.annual_rent <= 0) continue
      const start = lic.license_start ? new Date(lic.license_start).getFullYear() : null
      const end = lic.license_end ? new Date(lic.license_end).getFullYear() : null
      if (start == null || end == null) continue
      if (y >= start && y <= end) {
        const cat = categorize(lic.licensee_name)
        row[cat] = (row[cat] ?? 0) + lic.annual_rent
      }
    }

    row.total = Object.keys(TENANT_CATEGORIES).reduce((s, k) => s + (row[k] ?? 0), 0)
    years.push(row)
  }

  return years
}

const fmt = (v: number) =>
  v >= 1000 ? `$${(v / 1000).toFixed(0)}K` : `$${v}`

export default function SiteRevenueHistory({ licenses }: { licenses: License[] }) {
  const data = buildYearlyData(licenses)
  if (!data.length || data.every(r => r.total === 0)) return null

  const peakRevenue = Math.max(...data.map(r => r.total))
  const peakYear = data.find(r => r.total === peakRevenue)?.year
  const currentYear = new Date().getFullYear()
  const currentRevenue = data.find(r => r.year === currentYear)?.total ?? 0
  const activeCats = Object.keys(TENANT_CATEGORIES).filter(
    k => data.some(r => (r[k] ?? 0) > 0)
  )

  return (
    <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', paddingBottom: '12px', borderBottom: '1px solid #f1f5f9' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a' }}>Revenue History</span>
        </div>
        <div style={{ display: 'flex', gap: '16px' }}>
          {peakYear && (
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Peak Year ({peakYear})</div>
              <div style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>${peakRevenue.toLocaleString()}/yr</div>
            </div>
          )}
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Current</div>
            <div style={{ fontSize: '15px', fontWeight: 700, color: currentRevenue < peakRevenue * 0.7 ? '#dc2626' : '#16a34a' }}>
              ${currentRevenue.toLocaleString()}/yr
            </div>
          </div>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} barCategoryGap="30%">
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis dataKey="year" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
          <YAxis tickFormatter={fmt} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={48} />
          <Tooltip
            formatter={(value: any, name: any) => [
              `$${Number(value).toLocaleString()}`,
              TENANT_CATEGORIES[name]?.label ?? name,
            ]}
            contentStyle={{ fontSize: '12px', border: '1px solid #e2e8f0', borderRadius: '8px' }}
          />
          <Legend
            formatter={(v) => TENANT_CATEGORIES[v]?.label ?? v}
            wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
          />
          {activeCats.map(cat => (
            <Bar key={cat} dataKey={cat} stackId="a" fill={TENANT_CATEGORIES[cat].color} />
          ))}
          <ReferenceLine
            x={currentYear}
            stroke="#94a3b8"
            strokeDasharray="4 2"
            label={{ value: 'Today', position: 'top', fontSize: 10, fill: '#94a3b8' }}
          />
        </BarChart>
      </ResponsiveContainer>

      {currentRevenue < peakRevenue * 0.7 && (
        <div style={{ marginTop: '12px', background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', color: '#c2410c' }}>
          <strong>Revenue gap:</strong> Site peaked at ${peakRevenue.toLocaleString()}/yr. Current revenue is ${currentRevenue.toLocaleString()}/yr —{' '}
          <strong>${(peakRevenue - currentRevenue).toLocaleString()}/yr opportunity</strong> from vacant slots or lapsed tenants.
        </div>
      )}
    </div>
  )
}
