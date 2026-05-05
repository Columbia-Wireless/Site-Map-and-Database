'use client'

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { TowerSite } from '@/lib/types'

export default function RevenueChart({ sites }: { sites: TowerSite[] }) {
  const byState: Record<string, number> = {}
  sites.forEach(s => {
    byState[s.state] = (byState[s.state] || 0) + Number(s.annual_rent)
  })

  const data = Object.entries(byState)
    .map(([state, revenue]) => ({ state, revenue }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10)

  const fmt = (v: number) => `$${(v / 1000).toFixed(0)}k`

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
        <XAxis dataKey="state" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
        <YAxis tickFormatter={fmt} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={45} />
        <Tooltip
          formatter={(v) => [`$${Number(v).toLocaleString()}`, 'Revenue']}
          contentStyle={{ border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '13px' }}
        />
        <Bar dataKey="revenue" radius={[4, 4, 0, 0]}>
          {data.map((_, i) => (
            <Cell key={i} fill={i === 0 ? '#1a3a5c' : i < 3 ? '#2563eb' : '#93c5fd'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
