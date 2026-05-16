'use client'

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

interface TenancyWithOwner {
  annual_rent: number
  status: string
  tower_sites: { host_agency_id: string | null; state_agencies: { id: string; name: string } | null } | null
}

const COLORS = ['#1a3a5c', '#2563eb', '#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe', '#dbeafe']

export default function OwnerRevenueChart({ tenancies }: { tenancies: TenancyWithOwner[] }) {
  const byOwner: Record<string, { name: string; revenue: number }> = {}

  tenancies
    .filter(t => ['active', 'pending', 'expiring_soon'].includes(t.status))
    .forEach(t => {
      const site = (t.tower_sites as any)
      const owner = site?.state_agencies
      const key = owner?.id ?? '__none__'
      const name = owner?.name ?? 'Unassigned'
      if (!byOwner[key]) byOwner[key] = { name, revenue: 0 }
      byOwner[key].revenue += Number(t.annual_rent)
    })

  const data = Object.values(byOwner)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 8)

  const fmt = (v: number) => `$${(v / 1000).toFixed(0)}k`

  if (data.length === 0) {
    return <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '13px' }}>No data</div>
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 0, right: 8, left: 0, bottom: 40 }}>
        <XAxis
          dataKey="name"
          tick={{ fontSize: 11, fill: '#64748b' }}
          axisLine={false}
          tickLine={false}
          interval={0}
          angle={-35}
          textAnchor="end"
        />
        <YAxis tickFormatter={fmt} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={45} />
        <Tooltip
          formatter={(v) => [`$${Number(v).toLocaleString()}`, 'Revenue']}
          labelFormatter={(label) => label}
          contentStyle={{ border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '13px' }}
        />
        <Bar dataKey="revenue" radius={[4, 4, 0, 0]}>
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[Math.min(i, COLORS.length - 1)]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
