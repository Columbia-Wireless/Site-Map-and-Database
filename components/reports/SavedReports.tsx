'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Play, Download, ChevronDown, ChevronUp, Settings2 } from 'lucide-react'
import { FIELD_CATALOG, type DataSource } from '@/lib/report-fields'

interface SavedReport {
  id: string
  name: string
  description: string
  data_source: DataSource
  columns: string[]
  filters: any[]
  sort_field: string
  sort_dir: 'asc' | 'desc'
  min_role: string
}

function csvEscape(v: any): string {
  if (v == null) return ''
  const s = String(v)
  if (s.includes(',') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`
  return s
}

function RunPanel({ report, isAdmin }: { report: SavedReport; isAdmin: boolean }) {
  const [rows, setRows]       = useState<any[] | null>(null)
  const [cols, setCols]       = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen]       = useState(false)
  const [error, setError]     = useState('')

  const fieldLabels = Object.fromEntries(
    (FIELD_CATALOG[report.data_source]?.fields ?? []).map(f => [f.key, f.label])
  )

  async function run() {
    setLoading(true); setError(''); setOpen(true)
    const res = await fetch('/api/reports/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(report),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) { setError(data.error ?? 'Failed'); return }
    setRows(data.rows)
    setCols(data.columns)
  }

  function exportCSV() {
    if (!rows?.length) return
    const headers = cols.map(c => fieldLabels[c] ?? c)
    const lines = [
      headers.join(','),
      ...rows.map(r => cols.map(c => csvEscape(r[c])).join(','))
    ]
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url
    a.download = `${report.name.replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    fetch('/api/audit/report-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'report_downloaded', reportId: report.id, reportName: report.name, rowCount: rows.length }),
    })
  }

  return (
    <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
      {/* Card header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '16px 20px' }}>
        <div style={{ background: '#f0fdf4', borderRadius: '9px', padding: '9px', flexShrink: 0 }}>
          <Settings2 size={18} color="#15803d" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>{report.name}</div>
          {report.description && <div style={{ fontSize: '13px', color: '#64748b', marginTop: '1px' }}>{report.description}</div>}
          <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '3px' }}>
            {FIELD_CATALOG[report.data_source]?.label} · {report.columns.length} columns
            {report.filters?.length ? ` · ${report.filters.length} filter${report.filters.length > 1 ? 's' : ''}` : ''}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
          {rows && rows.length > 0 && (
            <button onClick={exportCSV} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#f0fdf4', color: '#15803d', border: '1px solid #86efac', borderRadius: '7px', padding: '7px 14px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
              <Download size={13} /> CSV
            </button>
          )}
          <button
            onClick={open && rows ? () => setOpen(o => !o) : run}
            disabled={loading}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '7px', padding: '7px 14px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', opacity: loading ? 0.7 : 1 }}
          >
            {loading ? (
              <div style={{ width: '13px', height: '13px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
            ) : open && rows ? (
              open ? <ChevronUp size={14} /> : <ChevronDown size={14} />
            ) : (
              <Play size={13} />
            )}
            {loading ? 'Running…' : open && rows ? (open ? 'Hide' : 'Show') : 'Run'}
          </button>
          {isAdmin && (
            <Link href="/admin/reports" style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'white', color: '#64748b', border: '1px solid #e2e8f0', borderRadius: '7px', padding: '7px 12px', fontSize: '12px', textDecoration: 'none' }}>
              Edit
            </Link>
          )}
        </div>
      </div>

      {/* Results */}
      {open && (
        <div style={{ borderTop: '1px solid #f1f5f9' }}>
          {error && (
            <div style={{ padding: '16px 20px', color: '#b91c1c', fontSize: '13px' }}>{error}</div>
          )}
          {rows && rows.length === 0 && (
            <div style={{ padding: '32px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>No records match this report.</div>
          )}
          {rows && rows.length > 0 && (
            <>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '500px' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc' }}>
                      {cols.map(c => (
                        <th key={c} style={{ padding: '9px 14px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap', borderBottom: '1px solid #e2e8f0' }}>
                          {fieldLabels[c] ?? c}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 200).map((row, i) => (
                      <tr key={i} style={{ background: i % 2 === 0 ? 'white' : '#fafafa', borderBottom: '1px solid #f1f5f9' }}>
                        {cols.map(c => (
                          <td key={c} style={{ padding: '9px 14px', fontSize: '13px', color: '#334155', whiteSpace: 'nowrap', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {row[c] != null ? String(row[c]) : <span style={{ color: '#cbd5e1' }}>—</span>}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ padding: '10px 16px', fontSize: '12px', color: '#94a3b8', background: '#fafafa', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between' }}>
                <span>{rows.length} record{rows.length !== 1 ? 's' : ''}{rows.length > 200 ? ` (showing first 200)` : ''}</span>
                <span>Export CSV for full dataset</span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

export default function SavedReports({ reports, isAdmin }: { reports: SavedReport[]; isAdmin: boolean }) {
  if (reports.length === 0) return null

  return (
    <div style={{ marginTop: '40px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div>
          <h2 style={{ fontSize: '17px', fontWeight: 700, color: '#0f172a', margin: 0 }}>Custom Reports</h2>
          <p style={{ fontSize: '13px', color: '#64748b', margin: '2px 0 0' }}>{reports.length} report{reports.length !== 1 ? 's' : ''} available</p>
        </div>
        {isAdmin && (
          <Link href="/admin/reports" style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'white', color: '#475569', border: '1px solid #e2e8f0', borderRadius: '7px', padding: '8px 14px', fontSize: '13px', fontWeight: 500, textDecoration: 'none' }}>
            <Settings2 size={14} /> Manage Reports
          </Link>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {reports.map(r => <RunPanel key={r.id} report={r} isAdmin={isAdmin} />)}
      </div>
    </div>
  )
}
