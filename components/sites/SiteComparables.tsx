'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { MapPin, ArrowUpDown, Download, PlusCircle } from 'lucide-react'
import AddComparableModal from './AddComparableModal'

interface InternalComp {
  id: string
  site_code: string
  name: string
  city: string
  state: string
  tower_type: string
  height_ft: number | null
  distance_miles: number
  active_tenants: number
  tenant_slots: number | null
  occupancy_pct: number | null
  annual_revenue: number
  same_type: boolean
}

interface ExternalComp {
  id: string
  site_name: string
  city: string
  state: string
  tower_type: string | null
  height_ft: number | null
  annual_rent: number | null
  active_tenants: number | null
  tenant_slots: number | null
  distance_miles: number | null
  occupancy_pct: number | null
  completeness_pct: number | null
  status: 'pending' | 'approved'
  source: string | null
  pdf_filename: string | null
}

interface DisplayRow {
  id: string
  isExternal: boolean
  // shared display fields
  displayName: string
  site_code?: string
  city: string
  state: string
  tower_type: string | null
  height_ft: number | null
  distance_miles: number | null
  active_tenants: number | null
  tenant_slots: number | null
  occupancy_pct: number | null
  annual_value: number | null   // annual_revenue (internal) or annual_rent (external)
  same_type?: boolean
  // external only
  status?: 'pending' | 'approved'
  completeness_pct?: number | null
  source?: string | null
}

type SortKey = 'distance_miles' | 'annual_value' | 'occupancy_pct' | 'active_tenants'

const TYPE_LABELS: Record<string, string> = {
  monopole: 'Monopole', lattice: 'Lattice', rooftop: 'Rooftop',
  water_tower: 'Water Tower', guyed: 'Guyed', small_cell: 'Small Cell',
}

const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)

const RADIUS_OPTIONS = [25, 50, 100, 150]

function toDisplayRow(c: InternalComp): DisplayRow {
  return {
    id: c.id, isExternal: false,
    displayName: c.name, site_code: c.site_code,
    city: c.city, state: c.state, tower_type: c.tower_type,
    height_ft: c.height_ft, distance_miles: c.distance_miles,
    active_tenants: c.active_tenants, tenant_slots: c.tenant_slots,
    occupancy_pct: c.occupancy_pct, annual_value: c.annual_revenue,
    same_type: c.same_type,
  }
}

function extToDisplayRow(c: ExternalComp): DisplayRow {
  return {
    id: c.id, isExternal: true,
    displayName: c.site_name, city: c.city, state: c.state,
    tower_type: c.tower_type, height_ft: c.height_ft,
    distance_miles: c.distance_miles, active_tenants: c.active_tenants,
    tenant_slots: c.tenant_slots, occupancy_pct: c.occupancy_pct,
    annual_value: c.annual_rent,
    status: c.status, completeness_pct: c.completeness_pct,
    source: c.source,
  }
}

export default function SiteComparables({ siteId }: { siteId: string }) {
  const [radius, setRadius]         = useState(50)
  const [internalComps, setInternalComps] = useState<InternalComp[]>([])
  const [externalComps, setExternalComps] = useState<ExternalComp[]>([])
  const [focalType, setFocalType]   = useState<string | null>(null)
  const [loading, setLoading]       = useState(true)
  const [message, setMessage]       = useState('')
  const [sortKey, setSortKey]       = useState<SortKey>('distance_miles')
  const [sortDir, setSortDir]       = useState<'asc' | 'desc'>('asc')
  const [typeOnly, setTypeOnly]     = useState(false)
  const [showModal, setShowModal]   = useState(false)

  const loadExternal = useCallback(() => {
    fetch(`/api/sites/${siteId}/comparables/external`)
      .then(r => r.json())
      .then(data => setExternalComps(data.comparables ?? []))
      .catch(() => {})
  }, [siteId])

  useEffect(() => {
    setLoading(true)
    Promise.all([
      fetch(`/api/sites/${siteId}/comparables?radius=${radius}`).then(r => r.json()),
      fetch(`/api/sites/${siteId}/comparables/external`).then(r => r.json()),
    ]).then(([intData, extData]) => {
      setInternalComps(intData.comparables ?? [])
      setFocalType(intData.focal_type ?? null)
      setMessage(intData.message ?? '')
      setExternalComps(extData.comparables ?? [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [siteId, radius])

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir(key === 'distance_miles' ? 'asc' : 'desc') }
  }

  const allRows: DisplayRow[] = [
    ...internalComps.map(toDisplayRow),
    ...externalComps.map(extToDisplayRow),
  ]

  const filtered = typeOnly ? allRows.filter(r => r.same_type || r.isExternal) : allRows

  const displayed = [...filtered].sort((a, b) => {
    const av = a[sortKey] ?? -1
    const bv = b[sortKey] ?? -1
    return sortDir === 'asc' ? (av as number) - (bv as number) : (bv as number) - (av as number)
  })

  const avgRevenue = displayed.filter(r => r.annual_value != null && (r.annual_value ?? 0) > 0).length
    ? displayed.filter(r => r.annual_value != null && (r.annual_value ?? 0) > 0)
        .reduce((s, r) => s + (r.annual_value ?? 0), 0) /
      displayed.filter(r => r.annual_value != null && (r.annual_value ?? 0) > 0).length
    : 0

  const withOcc = displayed.filter(r => r.occupancy_pct != null)
  const avgOccupancy = withOcc.length
    ? withOcc.reduce((s, r) => s + (r.occupancy_pct ?? 0), 0) / withOcc.length
    : null

  const nearest  = displayed.find(r => r.distance_miles != null)
  const furthest = [...displayed].reverse().find(r => r.distance_miles != null)

  function downloadCSV() {
    const headers = ['Source', 'Name', 'Site Code', 'City', 'State', 'Tower Type', 'Height (ft)',
      'Distance (mi)', 'Active Tenants', 'Tenant Slots', 'Occupancy %', 'Annual Revenue', 'Status']
    const rows = displayed.map(r => [
      r.isExternal ? (r.source ?? 'External') : 'Internal',
      r.displayName, r.site_code ?? '', r.city, r.state,
      r.tower_type ? (TYPE_LABELS[r.tower_type] ?? r.tower_type) : '',
      r.height_ft ?? '', r.distance_miles ?? '',
      r.active_tenants ?? '', r.tenant_slots ?? '',
      r.occupancy_pct != null ? r.occupancy_pct : '',
      r.annual_value != null ? r.annual_value : '',
      r.isExternal ? (r.status ?? '') : 'Internal',
    ])
    const csv = [headers, ...rows].map(row =>
      row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')
    ).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `comparables-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const thStyle = (key: SortKey) => ({
    padding: '10px 14px', textAlign: 'left' as const, fontSize: '11px', fontWeight: 600,
    color: '#64748b', textTransform: 'uppercase' as const, letterSpacing: '0.05em',
    cursor: 'pointer', whiteSpace: 'nowrap' as const, userSelect: 'none' as const,
    background: sortKey === key ? '#f1f5f9' : undefined,
  })

  const sortIcon = (key: SortKey) => sortKey === key ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''
  const selectStyle = { padding: '7px 10px', border: '1px solid #e2e8f0', borderRadius: '7px', fontSize: '13px', background: 'white', cursor: 'pointer' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <MapPin size={14} color="#64748b" />
          <span style={{ fontSize: '13px', color: '#64748b' }}>Radius:</span>
          <select value={radius} onChange={e => setRadius(Number(e.target.value))} style={selectStyle}>
            {RADIUS_OPTIONS.map(r => <option key={r} value={r}>{r} miles</option>)}
          </select>
        </div>
        {focalType && (
          <label style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '13px', color: '#475569', cursor: 'pointer' }}>
            <input type="checkbox" checked={typeOnly} onChange={e => setTypeOnly(e.target.checked)}
              style={{ width: '14px', height: '14px', cursor: 'pointer' }} />
            Same type only ({TYPE_LABELS[focalType] ?? focalType})
          </label>
        )}
        <span style={{ fontSize: '13px', color: '#64748b' }}>
          {loading ? 'Loading…' : `${displayed.length} comparable site${displayed.length !== 1 ? 's' : ''}`}
          {!loading && externalComps.length > 0 && (
            <span style={{ marginLeft: '6px', fontSize: '11px', color: '#94a3b8' }}>
              ({externalComps.length} external)
            </span>
          )}
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
          {displayed.length > 0 && (
            <button onClick={downloadCSV} style={{
              display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 13px',
              background: 'white', border: '1px solid #e2e8f0', borderRadius: '7px',
              fontSize: '13px', fontWeight: 500, color: '#475569', cursor: 'pointer',
            }}>
              <Download size={14} /> Export CSV
            </button>
          )}
          <button onClick={() => setShowModal(true)} style={{
            display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 13px',
            background: '#2563eb', border: 'none', borderRadius: '7px',
            fontSize: '13px', fontWeight: 600, color: 'white', cursor: 'pointer',
          }}>
            <PlusCircle size={14} /> Add Comparable
          </button>
        </div>
      </div>

      {/* Summary stats */}
      {!loading && displayed.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px' }}>
          {[
            { label: 'Avg Annual Revenue', value: avgRevenue > 0 ? fmt(avgRevenue) : '—', sub: 'across comparables' },
            { label: 'Avg Occupancy', value: avgOccupancy != null ? `${Math.round(avgOccupancy)}%` : '—', sub: 'of slotted sites' },
            { label: 'Nearest Site', value: nearest?.distance_miles != null ? `${nearest.distance_miles} mi` : '—', sub: nearest?.site_code ?? nearest?.displayName },
            { label: 'Furthest Site', value: furthest?.distance_miles != null ? `${furthest.distance_miles} mi` : '—', sub: furthest?.site_code ?? furthest?.displayName },
          ].map(({ label, value, sub }) => (
            <div key={label} style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px 16px', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
              <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>{label}</div>
              <div style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a' }}>{value}</div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>{sub}</div>
            </div>
          ))}
        </div>
      )}

      {/* Table */}
      <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        {loading ? (
          <div style={{ padding: '48px', textAlign: 'center', color: '#94a3b8', fontSize: '14px' }}>Loading comparables…</div>
        ) : message && displayed.length === 0 ? (
          <div style={{ padding: '48px', textAlign: 'center', color: '#94a3b8', fontSize: '14px' }}>{message}</div>
        ) : displayed.length === 0 ? (
          <div style={{ padding: '48px', textAlign: 'center', color: '#94a3b8', fontSize: '14px' }}>
            No comparables yet. Adjust the radius or add an external comparable.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '750px' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                  <th onClick={() => toggleSort('distance_miles')} style={thStyle('distance_miles')}>
                    Distance{sortIcon('distance_miles')}
                  </th>
                  <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>Site</th>
                  <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>Tower Type</th>
                  <th onClick={() => toggleSort('active_tenants')} style={thStyle('active_tenants')}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><ArrowUpDown size={10} />Tenants{sortIcon('active_tenants')}</span>
                  </th>
                  <th onClick={() => toggleSort('occupancy_pct')} style={thStyle('occupancy_pct')}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><ArrowUpDown size={10} />Occupancy{sortIcon('occupancy_pct')}</span>
                  </th>
                  <th onClick={() => toggleSort('annual_value')} style={thStyle('annual_value')}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><ArrowUpDown size={10} />Revenue / yr{sortIcon('annual_value')}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {displayed.map((row, i) => {
                  const occColor = row.occupancy_pct == null ? '#94a3b8'
                    : row.occupancy_pct >= 100 ? '#16a34a'
                    : row.occupancy_pct >= 60  ? '#2563eb'
                    : '#d97706'
                  const rowBg = row.isExternal
                    ? (i % 2 === 0 ? '#fefce8' : '#fef9c3')
                    : (i % 2 === 0 ? 'white' : '#fafafa')
                  return (
                    <tr
                      key={row.id}
                      style={{ background: rowBg, borderBottom: '1px solid #f1f5f9' }}
                      onMouseEnter={e => (e.currentTarget.style.background = row.isExternal ? '#fef08a' : '#eff6ff')}
                      onMouseLeave={e => (e.currentTarget.style.background = rowBg)}
                    >
                      <td style={{ padding: '11px 14px', whiteSpace: 'nowrap' }}>
                        <span style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>
                          {row.distance_miles != null ? `${row.distance_miles} mi` : '—'}
                        </span>
                        {row.same_type && (
                          <span style={{ marginLeft: '6px', fontSize: '10px', fontWeight: 600, background: '#eff6ff', color: '#2563eb', padding: '1px 5px', borderRadius: '4px' }}>SAME TYPE</span>
                        )}
                      </td>
                      <td style={{ padding: '11px 14px' }}>
                        {row.isExternal ? (
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a' }}>{row.displayName}</span>
                              <span style={{ fontSize: '10px', fontWeight: 700, background: '#fef3c7', color: '#92400e', padding: '1px 5px', borderRadius: '4px', border: '1px solid #fbbf24' }}>EXTERNAL</span>
                              {row.status === 'approved'
                                ? <span style={{ fontSize: '10px', fontWeight: 600, background: '#dcfce7', color: '#15803d', padding: '1px 5px', borderRadius: '4px' }}>APPROVED</span>
                                : <span style={{ fontSize: '10px', fontWeight: 600, background: '#fef9c3', color: '#854d0e', padding: '1px 5px', borderRadius: '4px' }}>PENDING</span>
                              }
                            </div>
                            <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                              {row.city}, {row.state}
                              {row.source && <span> · {row.source}</span>}
                            </div>
                          </div>
                        ) : (
                          <Link href={`/sites/${row.id}`} style={{ textDecoration: 'none' }}>
                            <div style={{ fontSize: '13px', fontWeight: 600, color: '#2563eb' }}>{row.site_code}</div>
                            <div style={{ fontSize: '12px', color: '#64748b' }}>{row.displayName}</div>
                            <div style={{ fontSize: '11px', color: '#94a3b8' }}>{row.city}, {row.state}</div>
                          </Link>
                        )}
                      </td>
                      <td style={{ padding: '11px 14px' }}>
                        {row.tower_type ? (
                          <>
                            <span style={{ fontSize: '12px', background: '#f1f5f9', padding: '3px 8px', borderRadius: '5px', color: '#475569', whiteSpace: 'nowrap' }}>
                              {TYPE_LABELS[row.tower_type] ?? row.tower_type}
                            </span>
                            {row.height_ft && <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>{row.height_ft} ft</div>}
                          </>
                        ) : <span style={{ fontSize: '12px', color: '#94a3b8' }}>—</span>}
                      </td>
                      <td style={{ padding: '11px 14px', fontSize: '13px', fontWeight: 600, color: '#0f172a' }}>
                        {row.active_tenants != null ? (
                          <>
                            {row.active_tenants}
                            {row.tenant_slots && <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 400 }}> / {row.tenant_slots}</span>}
                          </>
                        ) : <span style={{ color: '#94a3b8', fontWeight: 400 }}>—</span>}
                      </td>
                      <td style={{ padding: '11px 14px' }}>
                        {row.occupancy_pct != null ? (
                          <div>
                            <span style={{ fontSize: '13px', fontWeight: 700, color: occColor }}>{row.occupancy_pct}%</span>
                            <div style={{ width: '60px', height: '4px', background: '#e2e8f0', borderRadius: '2px', marginTop: '4px', overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${Math.min(row.occupancy_pct, 100)}%`, background: occColor, borderRadius: '2px' }} />
                            </div>
                          </div>
                        ) : <span style={{ fontSize: '12px', color: '#94a3b8' }}>—</span>}
                      </td>
                      <td style={{ padding: '11px 14px', fontSize: '13px', fontWeight: 600, color: '#0f172a' }}>
                        {row.annual_value != null && row.annual_value > 0
                          ? fmt(row.annual_value)
                          : <span style={{ color: '#94a3b8', fontWeight: 400 }}>—</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '12px', color: '#94a3b8', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ width: '12px', height: '12px', background: 'white', border: '1px solid #e2e8f0', borderRadius: '2px' }} />
          Internal (SCETV portfolio · Haversine distance)
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ width: '12px', height: '12px', background: '#fef9c3', border: '1px solid #fbbf24', borderRadius: '2px' }} />
          External comparable (manually added or PDF-extracted)
        </div>
      </div>

      {showModal && (
        <AddComparableModal
          siteId={siteId}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); loadExternal() }}
        />
      )}
    </div>
  )
}
