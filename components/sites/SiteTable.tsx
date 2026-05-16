'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Search, ChevronUp, ChevronDown } from 'lucide-react'
import { TowerSite } from '@/lib/types'

interface TenancySummary {
  id: string
  annual_rent: number
  license_end: string
  status: string
  licensees: { name: string } | null
}

export interface TowerSiteRow extends TowerSite {
  site_licenses: TenancySummary[]
  state_agencies?: { id: string; name: string } | null
}

const TYPE_LABELS: Record<string, string> = {
  monopole: 'Monopole', lattice: 'Lattice', rooftop: 'Rooftop',
  water_tower: 'Water Tower', guyed: 'Guyed', small_cell: 'Small Cell',
}

const TYPE_ICONS: Record<string, string> = {
  monopole: '▐', lattice: '⌖', rooftop: '⊞', water_tower: '◎', guyed: '⊥', small_cell: '◦',
}

const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)

type SortKey = 'site_code' | 'name' | 'state' | 'total_revenue' | 'next_expiry' | 'tenant_count' | 'occupancy_pct'

function OccupancyBar({ occupied, slots }: { occupied: number; slots: number | null }) {
  if (occupied === 0 && !slots) {
    return <span style={{ color: '#94a3b8', fontSize: '12px' }}>Vacant</span>
  }
  const pct = slots ? Math.min(100, (occupied / slots) * 100) : null
  const barColor = pct === null ? '#3b82f6' : pct >= 100 ? '#16a34a' : pct >= 60 ? '#3b82f6' : '#d97706'

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
        <span style={{ fontWeight: 700, fontSize: '13px', color: '#0f172a' }}>{occupied}</span>
        {slots ? (
          <span style={{ fontSize: '12px', color: '#64748b' }}>/ {slots} slots</span>
        ) : (
          <span style={{ fontSize: '12px', color: '#64748b' }}>occupied</span>
        )}
      </div>
      {slots && (
        <div style={{ width: '64px', height: '5px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: barColor, borderRadius: '3px', transition: 'width 0.3s' }} />
        </div>
      )}
    </div>
  )
}

export default function SiteTable({ sites }: { sites: TowerSiteRow[] }) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [stateFilter, setStateFilter] = useState<string>('all')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [occupancyFilter, setOccupancyFilter] = useState<string>('all')
  const [sortKey, setSortKey] = useState<SortKey>('site_code')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  const states = useMemo(() => Array.from(new Set(sites.map(s => s.state))).sort(), [sites])
  const types = useMemo(() => Array.from(new Set(sites.map(s => s.tower_type).filter(Boolean))).sort(), [sites])

  const enriched = useMemo(() => sites.map(site => {
    const tenancies = site.site_licenses ?? []
    const active = tenancies.filter(t => ['active', 'pending', 'expiring_soon'].includes(t.status))
    const activeNames = active.map(t => t.licensees?.name).filter(Boolean) as string[]
    const totalRevenue = tenancies.reduce((sum, t) => sum + Number(t.annual_rent), 0)
    const upcoming = tenancies
      .filter(t => t.status !== 'expired' && t.status !== 'terminated')
      .map(t => t.license_end).sort()
    const nextExpiry = upcoming[0] ?? null
    const slots = (site as any).tenant_slots as number | null
    const occupancyPct = slots ? (active.length / slots) * 100 : null
    return {
      ...site,
      _activeTenants: active.length,
      _totalTenants: tenancies.length,
      _totalRevenue: totalRevenue,
      _nextExpiry: nextExpiry,
      _activeNames: activeNames,
      _slots: slots,
      _occupancyPct: occupancyPct,
    }
  }), [sites])

  const filtered = useMemo(() => {
    let result = enriched
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(s =>
        s.site_code.toLowerCase().includes(q) ||
        s.name.toLowerCase().includes(q) ||
        s.city.toLowerCase().includes(q) ||
        s.address.toLowerCase().includes(q) ||
        s._activeNames.some(n => n.toLowerCase().includes(q))
      )
    }
    if (stateFilter !== 'all') result = result.filter(s => s.state === stateFilter)
    if (typeFilter !== 'all') result = result.filter(s => s.tower_type === typeFilter)
    if (occupancyFilter === 'vacant') result = result.filter(s => s._activeTenants === 0)
    if (occupancyFilter === 'occupied') result = result.filter(s => s._activeTenants > 0)
    if (occupancyFilter === 'full') result = result.filter(s => s._slots && s._activeTenants >= s._slots)
    if (occupancyFilter === 'available') result = result.filter(s => !s._slots || s._activeTenants < s._slots)
    return [...result].sort((a, b) => {
      let av: string | number, bv: string | number
      switch (sortKey) {
        case 'total_revenue': av = a._totalRevenue; bv = b._totalRevenue; break
        case 'next_expiry': av = a._nextExpiry ?? '9999'; bv = b._nextExpiry ?? '9999'; break
        case 'tenant_count': av = a._activeTenants; bv = b._activeTenants; break
        case 'occupancy_pct': av = a._occupancyPct ?? -1; bv = b._occupancyPct ?? -1; break
        default: av = String(a[sortKey as keyof TowerSite] ?? ''); bv = String(b[sortKey as keyof TowerSite] ?? '')
      }
      const cmp = av < bv ? -1 : av > bv ? 1 : 0
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [enriched, search, stateFilter, typeFilter, occupancyFilter, sortKey, sortDir])

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <ChevronUp size={13} style={{ opacity: 0.25 }} />
    return sortDir === 'asc' ? <ChevronUp size={13} /> : <ChevronDown size={13} />
  }

  const thStyle: React.CSSProperties = {
    padding: '10px 14px', textAlign: 'left', fontSize: '11px', fontWeight: 600,
    color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em',
    cursor: 'pointer', whiteSpace: 'nowrap', userSelect: 'none',
    borderBottom: '1px solid #e2e8f0', background: '#f8fafc',
  }

  function th(label: string, col: SortKey) {
    return (
      <th onClick={() => toggleSort(col)} style={thStyle}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {label} <SortIcon col={col} />
        </span>
      </th>
    )
  }

  function thStatic(label: string) {
    return <th style={{ ...thStyle, cursor: 'default' }}>{label}</th>
  }

  return (
    <div>
      {/* Filters */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '1 1 240px', maxWidth: '320px' }}>
          <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search sites, licensees, cities…"
            style={{ width: '100%', paddingLeft: '32px', paddingRight: '12px', paddingTop: '8px', paddingBottom: '8px', border: '1px solid #e2e8f0', borderRadius: '7px', fontSize: '14px', background: 'white', outline: 'none', boxSizing: 'border-box' }}
          />
        </div>
        <select value={stateFilter} onChange={e => setStateFilter(e.target.value)} style={{ padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: '7px', fontSize: '13px', background: 'white', cursor: 'pointer' }}>
          <option value="all">All States</option>
          {states.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} style={{ padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: '7px', fontSize: '13px', background: 'white', cursor: 'pointer' }}>
          <option value="all">All Types</option>
          {types.map(t => <option key={t} value={t}>{TYPE_LABELS[t] ?? t}</option>)}
        </select>
        <select value={occupancyFilter} onChange={e => setOccupancyFilter(e.target.value)} style={{ padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: '7px', fontSize: '13px', background: 'white', cursor: 'pointer' }}>
          <option value="all">All Occupancy</option>
          <option value="vacant">Vacant</option>
          <option value="occupied">Occupied</option>
          <option value="full">Full</option>
          <option value="available">Has Availability</option>
        </select>
        <div style={{ marginLeft: 'auto', fontSize: '13px', color: '#64748b' }}>
          {filtered.length} of {sites.length} sites
        </div>
      </div>

      {/* Table */}
      <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {th('Site Code', 'site_code')}
                {th('Name / Location', 'name')}
                {th('State', 'state')}
                {thStatic('Tower Type')}
                {thStatic('Agency')}
                {th('Occupancy', 'occupancy_pct')}
                {thStatic('Current Tenants')}
                {th('Revenue / yr', 'total_revenue')}
                {th('Next Expiry', 'next_expiry')}
              </tr>
            </thead>
            <tbody>
              {filtered.map((site, i) => {
                const now = new Date()
                const expiryDays = site._nextExpiry
                  ? Math.round((new Date(site._nextExpiry).getTime() - now.getTime()) / 86400000)
                  : null
                const expiryUrgent = expiryDays !== null && expiryDays <= 180 && expiryDays >= 0
                const expiryExpired = expiryDays !== null && expiryDays < 0
                const isHovered = hoveredId === site.id

                return (
                  <tr
                    key={site.id}
                    onClick={() => router.push(`/sites/${site.id}`)}
                    style={{ cursor: 'pointer', background: isHovered ? '#eff6ff' : i % 2 === 0 ? 'white' : '#fafafa', borderBottom: '1px solid #f1f5f9', transition: 'background 0.1s' }}
                    onMouseEnter={() => setHoveredId(site.id)}
                    onMouseLeave={() => setHoveredId(null)}
                  >
                    <td style={{ padding: '11px 14px', fontSize: '13px', fontWeight: 600, color: '#2563eb', whiteSpace: 'nowrap' }}>
                      {site.site_code}
                    </td>
                    <td style={{ padding: '11px 14px', fontSize: '13px' }}>
                      <div style={{ fontWeight: 500, color: '#0f172a' }}>{site.name}</div>
                      <div style={{ fontSize: '12px', color: '#94a3b8' }}>{site.address}, {site.city}</div>
                    </td>
                    <td style={{ padding: '11px 14px', fontSize: '13px', color: '#334155' }}>{site.state}</td>
                    <td style={{ padding: '11px 14px', fontSize: '12px', color: '#475569' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: '#f1f5f9', borderRadius: '5px', padding: '3px 8px', fontWeight: 500 }}>
                        {TYPE_LABELS[site.tower_type] || site.tower_type}
                      </span>
                      {site.height_ft && (
                        <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>{site.height_ft} ft</div>
                      )}
                    </td>
                    <td style={{ padding: '11px 14px', fontSize: '12px', color: '#64748b', whiteSpace: 'nowrap', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {(site as any).state_agencies?.name ?? '—'}
                    </td>
                    <td style={{ padding: '11px 14px' }}>
                      <OccupancyBar occupied={site._activeTenants} slots={site._slots} />
                    </td>
                    <td style={{ padding: '11px 14px', maxWidth: '200px' }}>
                      {site._activeNames.length === 0 ? (
                        <span style={{ fontSize: '12px', color: '#94a3b8' }}>—</span>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          {site._activeNames.slice(0, 2).map((name, ni) => (
                            <span key={ni} style={{ fontSize: '12px', color: '#334155', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '190px' }}>
                              {name}
                            </span>
                          ))}
                          {site._activeNames.length > 2 && (
                            <span style={{ fontSize: '11px', color: '#94a3b8' }}>+{site._activeNames.length - 2} more</span>
                          )}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '11px 14px', fontSize: '13px', fontWeight: 600, color: '#0f172a', whiteSpace: 'nowrap' }}>
                      {site._totalRevenue > 0 ? fmt(site._totalRevenue) : '—'}
                    </td>
                    <td style={{ padding: '11px 14px', fontSize: '13px', whiteSpace: 'nowrap', color: expiryExpired ? '#dc2626' : expiryUrgent ? '#d97706' : '#334155', fontWeight: expiryUrgent || expiryExpired ? 600 : 400 }}>
                      {site._nextExpiry
                        ? new Date(site._nextExpiry).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                        : '—'}
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} style={{ padding: '40px', textAlign: 'center', color: '#94a3b8', fontSize: '14px' }}>
                    No sites match your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
