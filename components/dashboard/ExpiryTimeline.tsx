'use client'

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { TowerSite } from '@/lib/types'

export default function ExpiryTimeline({ sites }: { sites: TowerSite[] }) {
  const now = new Date()
  const buckets: Record<string, number> = {}

  for (let i = 0; i < 36; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    buckets[key] = 0
  }

  sites.forEach(s => {
    const end = new Date(s.lease_end)
    const key = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}`
    if (key in buckets) buckets[key]++
  })

  const data = Object.entries(buckets).map(([month, count]) => {
    const [y, m] = month.split('-')
    const label = new Date(Number(y), Number(m) - 1, 1)
      .toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
    return { label, count }
  })

  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data} margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
        <XAxis
          dataKey="label"
          tick={{ fontSize: 10, fill: '#94a3b8' }}
          axisLine={false}
          tickLine={false}
          interval={2}
        />
        <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={20} />
        <Tooltip
          formatter={(v) => [Number(v), 'Leases Expiring']}
          contentStyle={{ border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '13px' }}
        />
        <Bar dataKey="count" fill="#2563eb" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
