export const dynamic = 'force-dynamic'

import { getSupabase } from '@/lib/supabase'
import { DollarSign, MapPin, AlertTriangle, Clock, TrendingUp, FileText } from 'lucide-react'
import RevenueChart from '@/components/dashboard/RevenueChart'
import StatusBreakdown from '@/components/dashboard/StatusBreakdown'
import ExpiryTimeline from '@/components/dashboard/ExpiryTimeline'
import RecentActivity from '@/components/dashboard/RecentActivity'

async function getMetrics() {
  const supabase = getSupabase()
  const { data: sites } = await supabase.from('tower_sites').select('*')
  if (!sites) return null

  const total = sites.length
  const active = sites.filter(s => s.status === 'active').length
  const expiring = sites.filter(s => s.status === 'expiring_soon').length
  const expired = sites.filter(s => s.status === 'expired').length
  const disputed = sites.filter(s => s.status === 'disputed').length
  const totalRevenue = sites.reduce((sum, s) => sum + Number(s.annual_rent), 0)
  const avgRent = totalRevenue / total

  const now = new Date()
  const in90 = sites.filter(s => {
    const end = new Date(s.lease_end)
    const days = (end.getTime() - now.getTime()) / 86400000
    return days >= 0 && days <= 90
  }).length

  return { total, active, expiring, expired, disputed, totalRevenue, avgRent, in90, sites }
}

async function getRecentChanges() {
  const supabase = getSupabase()
  const { data } = await supabase
    .from('site_change_log')
    .select('*, tower_sites(site_code, name)')
    .order('changed_at', { ascending: false })
    .limit(8)
  return data || []
}

export default async function DashboardPage() {
  const [metrics, recentChanges] = await Promise.all([getMetrics(), getRecentChanges()])
  if (!metrics) return <div style={{ padding: '40px' }}>Unable to load data.</div>

  const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)

  return (
    <div style={{ padding: '32px', maxWidth: '1400px' }}>
      {/* Header */}
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#0f172a', margin: 0 }}>
          Portfolio Overview
        </h1>
        <p style={{ color: '#64748b', marginTop: '4px', fontSize: '14px' }}>
          {metrics.total} sites under management — as of {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
        </p>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '28px' }}>
        <KpiCard
          label="Annual Revenue"
          value={fmt(metrics.totalRevenue)}
          sub="across all active licenses"
          icon={<DollarSign size={20} color="#2563eb" />}
          color="#eff6ff"
        />
        <KpiCard
          label="Active Sites"
          value={`${metrics.active} / ${metrics.total}`}
          sub={`${metrics.expired} expired, ${metrics.disputed} disputed`}
          icon={<MapPin size={20} color="#16a34a" />}
          color="#f0fdf4"
        />
        <KpiCard
          label="Expiring ≤ 90 Days"
          value={String(metrics.in90)}
          sub="requiring immediate action"
          icon={<AlertTriangle size={20} color="#d97706" />}
          color="#fffbeb"
          alert={metrics.in90 > 0}
        />
        <KpiCard
          label="Avg. Annual Rent"
          value={fmt(metrics.avgRent)}
          sub="per site license"
          icon={<TrendingUp size={20} color="#7c3aed" />}
          color="#f5f3ff"
        />
      </div>

      {/* Charts row */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px', marginBottom: '16px' }}>
        <ChartCard title="Revenue by State">
          <RevenueChart sites={metrics.sites} />
        </ChartCard>
        <ChartCard title="Portfolio Status">
          <StatusBreakdown sites={metrics.sites} />
        </ChartCard>
      </div>

      {/* Bottom row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <ChartCard title="Lease Expiry Timeline (Next 36 Months)">
          <ExpiryTimeline sites={metrics.sites} />
        </ChartCard>
        <ChartCard title="Recent Activity">
          <RecentActivity changes={recentChanges} />
        </ChartCard>
      </div>
    </div>
  )
}

function KpiCard({ label, value, sub, icon, color, alert }: {
  label: string; value: string; sub: string; icon: React.ReactNode; color: string; alert?: boolean
}) {
  return (
    <div style={{
      background: 'white',
      border: `1px solid ${alert ? '#fbbf24' : '#e2e8f0'}`,
      borderRadius: '10px',
      padding: '20px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 500, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {label}
          </div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#0f172a' }}>{value}</div>
          <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>{sub}</div>
        </div>
        <div style={{ background: color, borderRadius: '8px', padding: '8px' }}>{icon}</div>
      </div>
    </div>
  )
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: 'white',
      border: '1px solid #e2e8f0',
      borderRadius: '10px',
      padding: '20px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
    }}>
      <div style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a', marginBottom: '16px' }}>{title}</div>
      {children}
    </div>
  )
}
