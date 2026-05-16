export const dynamic = 'force-dynamic'

import { getSupabase } from '@/lib/supabase'
import { DollarSign, MapPin, AlertTriangle, TrendingUp } from 'lucide-react'
import RevenueChart from '@/components/dashboard/RevenueChart'
import StatusBreakdown from '@/components/dashboard/StatusBreakdown'
import ExpiryTimeline from '@/components/dashboard/ExpiryTimeline'
import RecentActivity from '@/components/dashboard/RecentActivity'
import OwnerRevenueChart from '@/components/dashboard/OwnerRevenueChart'

async function getMetrics() {
  const supabase = getSupabase()

  const [{ data: sites }, { data: tenancies }] = await Promise.all([
    supabase.from('tower_sites').select('id, state'),
    supabase.from('site_licenses').select('site_id, annual_rent, license_end, status, tower_sites(state, host_agency_id, state_agencies(id, name))'),
  ])

  if (!sites || !tenancies) return null

  const total = sites.length

  const activeTenancies = tenancies.filter(t => ['active', 'pending', 'expiring_soon'].includes(t.status))
  const totalRevenue = activeTenancies.reduce((sum, t) => sum + Number(t.annual_rent), 0)
  const activeOnly = tenancies.filter(t => t.status === 'active')
  const avgRent = activeOnly.length > 0 ? activeOnly.reduce((s, t) => s + Number(t.annual_rent), 0) / activeOnly.length : 0

  const activeSiteIds = new Set(activeTenancies.map(t => t.site_id))
  const activeSites = activeSiteIds.size

  const now = new Date()
  const in90 = tenancies.filter(t => {
    if (!['active', 'pending', 'expiring_soon'].includes(t.status)) return false
    const end = new Date(t.license_end)
    const days = (end.getTime() - now.getTime()) / 86400000
    return days >= 0 && days <= 90
  }).length

  return { total, activeSites, totalRevenue, avgRent, in90, tenancies }
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
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#0f172a', margin: 0 }}>Portfolio Overview</h1>
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
          label="Occupied Sites"
          value={`${metrics.activeSites} / ${metrics.total}`}
          sub={`${metrics.total - metrics.activeSites} vacant`}
          icon={<MapPin size={20} color="#16a34a" />}
          color="#f0fdf4"
        />
        <KpiCard
          label="Expiring ≤ 90 Days"
          value={String(metrics.in90)}
          sub="licenses requiring action"
          icon={<AlertTriangle size={20} color="#d97706" />}
          color="#fffbeb"
          alert={metrics.in90 > 0}
        />
        <KpiCard
          label="Avg. Annual Rent"
          value={fmt(metrics.avgRent)}
          sub="per active license"
          icon={<TrendingUp size={20} color="#7c3aed" />}
          color="#f5f3ff"
        />
      </div>

      {/* Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px', marginBottom: '16px' }}>
        <ChartCard title="Revenue by State">
          <RevenueChart tenancies={metrics.tenancies as any} />
        </ChartCard>
        <ChartCard title="License Status Breakdown">
          <StatusBreakdown tenancies={metrics.tenancies as any} />
        </ChartCard>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
        <ChartCard title="License Expiry Timeline (Next 36 Months)">
          <ExpiryTimeline tenancies={metrics.tenancies as any} />
        </ChartCard>
        <ChartCard title="Revenue by Agency">
          <OwnerRevenueChart tenancies={metrics.tenancies as any} />
        </ChartCard>
      </div>

      <ChartCard title="Recent Activity">
        <RecentActivity changes={recentChanges} />
      </ChartCard>
    </div>
  )
}

function KpiCard({ label, value, sub, icon, color, alert }: {
  label: string; value: string; sub: string; icon: React.ReactNode; color: string; alert?: boolean
}) {
  return (
    <div style={{ background: 'white', border: `1px solid ${alert ? '#fbbf24' : '#e2e8f0'}`, borderRadius: '10px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 500, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
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
    <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
      <div style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a', marginBottom: '16px' }}>{title}</div>
      {children}
    </div>
  )
}
