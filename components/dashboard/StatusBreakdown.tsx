'use client'

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'

interface TenancyForChart { status: string }

const STATUS_COLORS: Record<string, string> = {
  active: '#16a34a',
  expiring_soon: '#d97706',
  expired: '#dc2626',
  terminated: '#be185d',
  pending: '#64748b',
}

const STATUS_LABELS: Record<string, string> = {
  active: 'Active',
  expiring_soon: 'Expiring Soon',
  expired: 'Expired',
  terminated: 'Terminated',
  pending: 'Pending',
}

export default function StatusBreakdown({ tenancies }: { tenancies: TenancyForChart[] }) {
  const counts: Record<string, number> = {}
  tenancies.forEach(t => { counts[t.status] = (counts[t.status] || 0) + 1 })

  const data = Object.entries(counts).map(([status, count]) => ({
    name: STATUS_LABELS[status] || status,
    value: count,
    status,
  }))

  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie data={data} cx="50%" cy="45%" innerRadius={55} outerRadius={80} paddingAngle={2} dataKey="value">
          {data.map((entry, i) => (
            <Cell key={i} fill={STATUS_COLORS[entry.status] || '#94a3b8'} />
          ))}
        </Pie>
        <Tooltip
          formatter={(v, name) => [Number(v), String(name)]}
          contentStyle={{ border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '13px' }}
        />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '12px' }} />
      </PieChart>
    </ResponsiveContainer>
  )
}
