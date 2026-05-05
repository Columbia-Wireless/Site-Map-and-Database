'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Search, ChevronUp, ChevronDown, Filter } from 'lucide-react'
import { TowerSite, SiteStatus } from '@/lib/types'

const STATUS_LABELS: Record<SiteStatus, string> = {
  active: 'Active',
  expiring_soon: 'Expiring Soon',
  expired: 'Expired',
  disputed: 'Disputed',
  pending: 'Pending',
}

const TYPE_LABELS: Record<string, string> = {
  monopole: 'Monopole',
  lattice: 'Lattice',
  rooftop: 'Rooftop',
  water_tower: 'Water Tower',
  guyed: 'Guyed',
  small_cell: 'Small Cell',
}

const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)

type SortKey = 'site_code' | 'name' | 'state' | 'tenant_name' | 'annual_rent' | 'lease_end' | 'status'

export default function SiteTable({ sites }: { sites: TowerSite[] }) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [stateFilter, setStateFilter] = useState<string>('all')
  const [sortKey, setSortKey] = useState<SortKey>('site_code')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const states = useMemo(() =>
    Array.from(new Set(sites.map(s => s.state))).sort(), [sites])

  const filtered = useMemo(() => {
    let result = sites
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(s =>
        s.site_code.toLowerCase().includes(q) ||
        s.name.toLowerCase().includes(q) ||
        s.city.toLowerCase().includes(q) ||
        s.tenant_name.toLowerCase().includes(q) ||
        s.address.toLowerCase().includes(q)
      )
    }
    if (statusFilter !== 'all') result = result.filter(s => s.status === statusFilter)
    if (stateFilter !== 'all') result = result.filter(s => s.state === stateFilter)
    return [...result].sort((a, b) => {
      const av = a[sortKey]
      const bv = b[sortKey]
      const cmp = String(av) < String(bv) ? -1 : String(av) > String(bv) ? 1 : 0
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [sites, search, statusFilter, stateFilter, sortKey, sortDir])

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <ChevronUp size={13} style={{ opacity: 0.25 }} />
    return sortDir === 'asc' ? <ChevronUp size={13} /> : <ChevronDown size={13} />
  }

  const th = (label: string, col: SortKey) => (
    <th
      onClick={() => toggleSort(col)}
      style={{
        padding: '10px 14px', textAlign: 'left', fontSize: '11px', fontWeight: 600,
        color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em',
        cursor: 'pointer', whiteSpace: 'nowrap', userSelect: 'none',
        borderBottom: '1px solid #e2e8f0', background: '#f8fafc',
      }}
    >
      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        {label} <SortIcon col={col} />
      </span>
    </th>
  )

  return (
    <div>
      {/* Filters */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '1 1 240px', maxWidth: '340px' }}>
          <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search sites, tenants, cities…"
            style={{
              width: '100%', paddingLeft: '32px', paddingRight: '12px', paddingTop: '8px', paddingBottom: '8px',
              border: '1px solid #e2e8f0', borderRadius: '7px', fontSize: '14px',
              background: 'white', outline: 'none', boxSizing: 'border-box',
            }}
          />
        </div>

        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          style={{ padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '7px', fontSize: '14px', background: 'white', cursor: 'pointer' }}
        >
          <option value="all">All Statuses</option>
          {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>

        <select
          value={stateFilter}
          onChange={e => setStateFilter(e.target.value)}
          style={{ padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '7px', fontSize: '14px', background: 'white', cursor: 'pointer' }}
        >
          <option value="all">All States</option>
          {states.map(s => <option key={s} value={s}>{s}</option>)}
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
                {th('Tenant', 'tenant_name')}
                {th('Type', 'site_code')}
                {th('Annual Rent', 'annual_rent')}
                {th('Lease End', 'lease_end')}
                {th('Status', 'status')}
              </tr>
            </thead>
            <tbody>
              {filtered.map((site, i) => (
                <tr
                  key={site.id}
                  onClick={() => router.push(`/sites/${site.id}`)}
                  style={{
                    cursor: 'pointer',
                    background: i % 2 === 0 ? 'white' : '#fafafa',
                    borderBottom: '1px solid #f1f5f9',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#eff6ff')}
                  onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? 'white' : '#fafafa')}
                >
                  <td style={{ padding: '11px 14px', fontSize: '13px', fontWeight: 600, color: '#2563eb', whiteSpace: 'nowrap' }}>
                    {site.site_code}
                  </td>
                  <td style={{ padding: '11px 14px', fontSize: '13px' }}>
                    <div style={{ fontWeight: 500, color: '#0f172a' }}>{site.name}</div>
                    <div style={{ fontSize: '12px', color: '#94a3b8' }}>{site.address}, {site.city}</div>
                  </td>
                  <td style={{ padding: '11px 14px', fontSize: '13px', color: '#334155' }}>{site.state}</td>
                  <td style={{ padding: '11px 14px', fontSize: '13px', color: '#334155' }}>{site.tenant_name}</td>
                  <td style={{ padding: '11px 14px', fontSize: '12px', color: '#64748b' }}>
                    {TYPE_LABELS[site.tower_type] || site.tower_type}
                  </td>
                  <td style={{ padding: '11px 14px', fontSize: '13px', fontWeight: 600, color: '#0f172a', whiteSpace: 'nowrap' }}>
                    {fmt(Number(site.annual_rent))}
                  </td>
                  <td style={{ padding: '11px 14px', fontSize: '13px', color: '#334155', whiteSpace: 'nowrap' }}>
                    {new Date(site.lease_end).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </td>
                  <td style={{ padding: '11px 14px' }}>
                    <span className={`status-${site.status}`} style={{
                      fontSize: '11px', fontWeight: 600, padding: '3px 8px',
                      borderRadius: '12px', whiteSpace: 'nowrap',
                    }}>
                      {STATUS_LABELS[site.status]}
                    </span>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ padding: '40px', textAlign: 'center', color: '#94a3b8', fontSize: '14px' }}>
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
