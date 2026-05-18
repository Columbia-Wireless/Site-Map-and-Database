'use client'

import { useState, useEffect, useCallback } from 'react'
import { Search, Download, RefreshCw, ChevronLeft, ChevronRight, ClipboardList } from 'lucide-react'

interface AuditRow {
  id: string
  entity_type: string | null
  field_name: string | null
  old_value: string | null
  new_value: string | null
  changed_by: string | null
  user_id: string | null
  ip_address: string | null
  changed_at: string
}

const ENTITY_TYPES = ['auth', 'site', 'owner', 'licensee', 'report', 'system']

const TYPE_STYLE: Record<string, { bg: string; color: string }> = {
  auth:     { bg: '#eff6ff', color: '#1d4ed8' },
  site:     { bg: '#f0fdf4', color: '#15803d' },
  owner:    { bg: '#fdf4ff', color: '#7e22ce' },
  licensee: { bg: '#fff7ed', color: '#c2410c' },
  report:   { bg: '#fefce8', color: '#854d0e' },
  system:   { bg: '#f1f5f9', color: '#475569' },
}

const PAGE_SIZE = 50

function csvEscape(v: string | null | undefined): string {
  if (v == null) return ''
  const s = String(v)
  if (s.includes(',') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`
  return s
}

export default function AuditLogPage() {
  const [rows, setRows]         = useState<AuditRow[]>([])
  const [total, setTotal]       = useState(0)
  const [loading, setLoading]   = useState(true)
  const [exporting, setExporting] = useState(false)
  const [page, setPage]         = useState(0)

  const [search, setSearch]         = useState('')
  const [entityType, setEntityType] = useState('all')
  const [dateFrom, setDateFrom]     = useState('')
  const [dateTo, setDateTo]         = useState('')
  const [sortDir, setSortDir]       = useState<'desc' | 'asc'>('desc')

  const buildParams = useCallback((overrides: Record<string, string | number> = {}) => {
    const p = new URLSearchParams()
    if (entityType !== 'all') p.set('entity_type', entityType)
    if (dateFrom) p.set('from', dateFrom)
    if (dateTo)   p.set('to', dateTo + 'T23:59:59')
    p.set('limit', String(overrides.limit ?? PAGE_SIZE))
    p.set('offset', String(overrides.offset ?? page * PAGE_SIZE))
    return p.toString()
  }, [entityType, dateFrom, dateTo, page])

  async function fetchRows(p = page) {
    setLoading(true)
    const params = buildParams({ offset: p * PAGE_SIZE })
    const res = await fetch(`/api/audit?${params}`)
    const data = await res.json()
    setLoading(false)
    if (!data.records) return
    let records: AuditRow[] = data.records
    if (search.trim()) {
      const q = search.toLowerCase()
      records = records.filter(r =>
        [r.field_name, r.changed_by, r.new_value, r.old_value, r.entity_type, r.ip_address]
          .some(v => v?.toLowerCase().includes(q))
      )
    }
    if (sortDir === 'asc') records = [...records].reverse()
    setRows(records)
    setTotal(data.total)
  }

  useEffect(() => {
    setPage(0)
    fetchRows(0)
  }, [entityType, dateFrom, dateTo, sortDir])

  useEffect(() => {
    fetchRows(page)
  }, [page])

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    setPage(0)
    fetchRows(0)
  }

  async function exportCSV() {
    setExporting(true)
    // Fetch all matching records (up to 5000) for export
    const params = buildParams({ limit: 5000, offset: 0 })
    const res = await fetch(`/api/audit?${params}`)
    const data = await res.json()
    setExporting(false)
    if (!data.records?.length) return

    let records: AuditRow[] = data.records
    if (search.trim()) {
      const q = search.toLowerCase()
      records = records.filter(r =>
        [r.field_name, r.changed_by, r.new_value, r.old_value, r.entity_type, r.ip_address]
          .some(v => v?.toLowerCase().includes(q))
      )
    }
    if (sortDir === 'asc') records = [...records].reverse()

    const headers = ['Timestamp', 'Actor', 'Entity Type', 'Event', 'Old Value', 'New Value', 'User ID', 'IP Address']
    const csvLines = [
      headers.join(','),
      ...records.map(r => [
        csvEscape(new Date(r.changed_at).toISOString()),
        csvEscape(r.changed_by),
        csvEscape(r.entity_type),
        csvEscape(r.field_name),
        csvEscape(r.old_value),
        csvEscape(r.new_value),
        csvEscape(r.user_id),
        csvEscape(r.ip_address),
      ].join(','))
    ]

    const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const selectStyle = { padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: '7px', fontSize: '13px', background: 'white', cursor: 'pointer', outline: 'none' }

  return (
    <div style={{ padding: '32px', maxWidth: '1400px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ background: '#eff6ff', borderRadius: '10px', padding: '10px' }}>
            <ClipboardList size={22} color="#2563eb" />
          </div>
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a', margin: 0 }}>Audit Log</h1>
            <div style={{ fontSize: '13px', color: '#64748b', marginTop: '2px' }}>
              All system changes across sites, users, owners, and licensees
            </div>
          </div>
        </div>
        <button
          onClick={exportCSV}
          disabled={exporting}
          style={{ display: 'flex', alignItems: 'center', gap: '7px', background: '#16a34a', color: 'white', border: 'none', borderRadius: '8px', padding: '10px 18px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', opacity: exporting ? 0.7 : 1 }}
        >
          <Download size={15} />
          {exporting ? 'Preparing…' : 'Export CSV'}
        </button>
      </div>

      {/* Filters */}
      <form onSubmit={handleSearch}>
        <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: '1 1 260px', maxWidth: '360px' }}>
            <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search actor, event, value, IP…"
              style={{ width: '100%', paddingLeft: '32px', paddingRight: '12px', paddingTop: '8px', paddingBottom: '8px', border: '1px solid #e2e8f0', borderRadius: '7px', fontSize: '14px', background: 'white', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
          <select value={entityType} onChange={e => setEntityType(e.target.value)} style={selectStyle}>
            <option value="all">All Types</option>
            {ENTITY_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
          </select>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label style={{ fontSize: '12px', color: '#64748b', whiteSpace: 'nowrap' }}>From</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ ...selectStyle, cursor: 'text' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label style={{ fontSize: '12px', color: '#64748b', whiteSpace: 'nowrap' }}>To</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ ...selectStyle, cursor: 'text' }} />
          </div>
          <button type="submit" style={{ ...selectStyle, background: '#2563eb', color: 'white', border: 'none', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Search size={13} /> Search
          </button>
          <button
            type="button"
            onClick={() => fetchRows(page)}
            disabled={loading}
            style={{ ...selectStyle, display: 'flex', alignItems: 'center', gap: '5px', color: '#64748b' }}
          >
            <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            Refresh
          </button>
          <div style={{ marginLeft: 'auto', fontSize: '13px', color: '#64748b', whiteSpace: 'nowrap' }}>
            {total.toLocaleString()} total events
          </div>
        </div>
      </form>

      {/* Table */}
      <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '900px' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                <th
                  onClick={() => setSortDir(d => d === 'desc' ? 'asc' : 'desc')}
                  style={{ padding: '10px 14px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', cursor: 'pointer', whiteSpace: 'nowrap', userSelect: 'none' }}
                >
                  Timestamp {sortDir === 'desc' ? '↓' : '↑'}
                </th>
                {['Actor', 'Type', 'Event', 'Old Value', 'New Value', 'IP'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} style={{ padding: '48px', textAlign: 'center', color: '#94a3b8', fontSize: '14px' }}>Loading…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={7} style={{ padding: '48px', textAlign: 'center', color: '#94a3b8', fontSize: '14px' }}>No events match your filters.</td></tr>
              ) : rows.map((row, i) => {
                const ts = new Date(row.changed_at)
                const typeStyle = TYPE_STYLE[row.entity_type ?? 'system'] ?? TYPE_STYLE.system
                return (
                  <tr key={row.id} style={{ background: i % 2 === 0 ? 'white' : '#fafafa', borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                      <div style={{ fontSize: '13px', color: '#0f172a', fontWeight: 500 }}>{ts.toLocaleDateString()}</div>
                      <div style={{ fontSize: '11px', color: '#94a3b8' }}>{ts.toLocaleTimeString()}</div>
                    </td>
                    <td style={{ padding: '10px 14px', fontSize: '13px', color: '#334155', whiteSpace: 'nowrap' }}>
                      {row.changed_by ?? '—'}
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '10px', background: typeStyle.bg, color: typeStyle.color, whiteSpace: 'nowrap' }}>
                        {row.entity_type ?? 'system'}
                      </span>
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{ fontSize: '12px', fontFamily: 'monospace', background: '#f1f5f9', padding: '2px 7px', borderRadius: '5px', color: '#334155', whiteSpace: 'nowrap' }}>
                        {row.field_name ?? '—'}
                      </span>
                    </td>
                    <td style={{ padding: '10px 14px', fontSize: '12px', color: '#64748b', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {row.old_value ?? <span style={{ color: '#cbd5e1' }}>—</span>}
                    </td>
                    <td style={{ padding: '10px 14px', fontSize: '12px', color: '#0f172a', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {row.new_value ?? <span style={{ color: '#cbd5e1' }}>—</span>}
                    </td>
                    <td style={{ padding: '10px 14px', fontSize: '12px', color: '#94a3b8', whiteSpace: 'nowrap' }}>
                      {row.ip_address ?? '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderTop: '1px solid #f1f5f9', background: '#fafafa' }}>
          <div style={{ fontSize: '13px', color: '#64748b' }}>
            Page {page + 1} of {totalPages} &nbsp;·&nbsp; showing {rows.length} of {total.toLocaleString()} events
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0 || loading}
              style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 12px', border: '1px solid #e2e8f0', borderRadius: '6px', background: 'white', fontSize: '13px', color: '#475569', cursor: page === 0 ? 'not-allowed' : 'pointer', opacity: page === 0 ? 0.4 : 1 }}
            >
              <ChevronLeft size={14} /> Prev
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1 || loading}
              style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 12px', border: '1px solid #e2e8f0', borderRadius: '6px', background: 'white', fontSize: '13px', color: '#475569', cursor: page >= totalPages - 1 ? 'not-allowed' : 'pointer', opacity: page >= totalPages - 1 ? 0.4 : 1 }}
            >
              Next <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
