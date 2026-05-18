'use client'

import { useState, useEffect } from 'react'
import { PlusCircle, Trash2, Edit3, FileText, X, Play, Download } from 'lucide-react'
import { FIELD_CATALOG, FILTER_OPS, ROLES, type ReportConfig, type DataSource, type FilterDef } from '@/lib/report-fields'

const DATA_SOURCES = Object.entries(FIELD_CATALOG).map(([key, val]) => ({ key: key as DataSource, label: val.label }))

const ROLE_LABELS: Record<string, string> = {
  viewer: 'Viewer', reporter: 'Reporter', editor: 'Editor', admin: 'Admin', super_admin: 'Super Admin',
}

const inputStyle = { width: '100%', padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: '7px', fontSize: '13px', outline: 'none', background: 'white', boxSizing: 'border-box' as const }
const selectStyle = { ...inputStyle, cursor: 'pointer' }
const btnPrimary = { display: 'flex' as const, alignItems: 'center' as const, gap: '6px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '7px', padding: '9px 16px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }
const btnSecondary = { display: 'flex' as const, alignItems: 'center' as const, gap: '6px', background: 'white', color: '#475569', border: '1px solid #e2e8f0', borderRadius: '7px', padding: '9px 16px', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }

const EMPTY_CONFIG = (): ReportConfig => ({
  name: '', description: '', data_source: 'sites', columns: [], filters: [], sort_field: '', sort_dir: 'asc', min_role: 'viewer',
})

function csvEscape(v: any) {
  if (v == null) return ''
  const s = String(v)
  return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s
}

export default function ReportBuilderPage() {
  const [reports, setReports]   = useState<any[]>([])
  const [loading, setLoading]   = useState(true)
  const [editing, setEditing]   = useState<ReportConfig | null>(null)
  const [editId, setEditId]     = useState<string | null>(null)
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')
  const [runId, setRunId]       = useState<string | null>(null)
  const [runRows, setRunRows]   = useState<any[]>([])
  const [runCols, setRunCols]   = useState<string[]>([])
  const [runLoading, setRunLoading] = useState(false)
  const [runError, setRunError] = useState('')

  useEffect(() => { loadReports() }, [])

  async function loadReports() {
    setLoading(true)
    const res = await fetch('/api/reports/saved')
    const data = await res.json()
    setReports(data.reports ?? [])
    setLoading(false)
  }

  function startNew() {
    setEditing(EMPTY_CONFIG())
    setEditId(null)
    setError('')
  }

  function startEdit(r: any) {
    setEditing({ name: r.name, description: r.description ?? '', data_source: r.data_source, columns: r.columns, filters: r.filters ?? [], sort_field: r.sort_field ?? '', sort_dir: r.sort_dir, min_role: r.min_role })
    setEditId(r.id)
    setError('')
  }

  function cancel() { setEditing(null); setEditId(null); setError('') }

  function setField<K extends keyof ReportConfig>(k: K, v: ReportConfig[K]) {
    setEditing(e => e ? { ...e, [k]: v } : e)
  }

  function onSourceChange(src: DataSource) {
    setEditing(e => e ? { ...e, data_source: src, columns: [], filters: [], sort_field: '' } : e)
  }

  function toggleColumn(key: string) {
    setEditing(e => {
      if (!e) return e
      const cols = e.columns.includes(key) ? e.columns.filter(c => c !== key) : [...e.columns, key]
      return { ...e, columns: cols }
    })
  }

  function addFilter() {
    const fields = FIELD_CATALOG[editing!.data_source]?.fields ?? []
    if (!fields.length) return
    const newFilter: FilterDef = { field: fields[0].key, op: 'eq', value: '' }
    setEditing(e => e ? { ...e, filters: [...e.filters, newFilter] } : e)
  }

  function updateFilter(i: number, patch: Partial<FilterDef>) {
    setEditing(e => {
      if (!e) return e
      const filters = e.filters.map((f, idx) => idx === i ? { ...f, ...patch } : f)
      return { ...e, filters }
    })
  }

  function removeFilter(i: number) {
    setEditing(e => e ? { ...e, filters: e.filters.filter((_, idx) => idx !== i) } : e)
  }

  async function save() {
    if (!editing) return
    if (!editing.name.trim()) { setError('Report name is required'); return }
    if (!editing.columns.length) { setError('Select at least one column'); return }
    setSaving(true); setError('')
    const url    = editId ? `/api/reports/saved/${editId}` : '/api/reports/saved'
    const method = editId ? 'PATCH' : 'POST'
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editing) })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) { setError(data.error ?? 'Failed'); return }
    await loadReports()
    cancel()
  }

  async function deleteReport(id: string, name: string) {
    if (!confirm(`Delete "${name}"?`)) return
    await fetch(`/api/reports/saved/${id}`, { method: 'DELETE' })
    setReports(r => r.filter(x => x.id !== id))
    if (runId === id) { setRunId(null); setRunRows([]); setRunCols([]) }
  }

  async function runReport(r: any) {
    if (runId === r.id) { setRunId(null); return }
    setRunId(r.id); setRunRows([]); setRunCols([]); setRunError(''); setRunLoading(true)
    const res = await fetch('/api/reports/run', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(r),
    })
    const data = await res.json()
    setRunLoading(false)
    if (!res.ok) { setRunError(data.error ?? 'Failed'); return }
    setRunRows(data.rows ?? [])
    setRunCols(data.columns ?? [])
  }

  function downloadCSV(r: any) {
    const fieldLabels = Object.fromEntries((FIELD_CATALOG[r.data_source as DataSource]?.fields ?? []).map((f: any) => [f.key, f.label]))
    const lines = [
      runCols.map((c: string) => fieldLabels[c] ?? c).join(','),
      ...runRows.map(row => runCols.map((c: string) => csvEscape(row[c])).join(',')),
    ]
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${r.name.replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    fetch('/api/audit/report-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'report_downloaded', reportId: r.id, reportName: r.name, rowCount: runRows.length }),
    })
  }

  const fields = editing ? (FIELD_CATALOG[editing.data_source]?.fields ?? []) : []

  return (
    <div style={{ padding: '32px', maxWidth: '900px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ background: '#eff6ff', borderRadius: '10px', padding: '10px' }}>
            <FileText size={22} color="#2563eb" />
          </div>
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a', margin: 0 }}>Report Builder</h1>
            <div style={{ fontSize: '13px', color: '#64748b', marginTop: '2px' }}>Create custom reports visible on the Reports page</div>
          </div>
        </div>
        {!editing && (
          <button onClick={startNew} style={btnPrimary}>
            <PlusCircle size={15} /> New Report
          </button>
        )}
      </div>

      {/* Builder form */}
      {editing && (
        <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '24px', marginBottom: '28px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <span style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>{editId ? 'Edit Report' : 'New Report'}</span>
            <button onClick={cancel} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={18} /></button>
          </div>

          {error && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '7px', padding: '10px 14px', fontSize: '13px', color: '#b91c1c', marginBottom: '16px' }}>{error}</div>}

          {/* Name + description */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748b', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Report Name *</label>
              <input value={editing.name} onChange={e => setField('name', e.target.value)} placeholder="e.g. Active Sites by State" style={inputStyle} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748b', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Description</label>
              <input value={editing.description} onChange={e => setField('description', e.target.value)} placeholder="Brief description" style={inputStyle} />
            </div>
          </div>

          {/* Data source + min role */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748b', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Data Source *</label>
              <select value={editing.data_source} onChange={e => onSourceChange(e.target.value as DataSource)} style={selectStyle}>
                {DATA_SOURCES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748b', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Minimum Role to View</label>
              <select value={editing.min_role} onChange={e => setField('min_role', e.target.value)} style={selectStyle}>
                {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
              </select>
            </div>
          </div>

          {/* Columns */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748b', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Columns * (drag to reorder)</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {fields.map(f => {
                const selected = editing.columns.includes(f.key)
                return (
                  <button
                    key={f.key}
                    onClick={() => toggleColumn(f.key)}
                    style={{
                      padding: '5px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 500, cursor: 'pointer',
                      border: selected ? '1px solid #2563eb' : '1px solid #e2e8f0',
                      background: selected ? '#eff6ff' : 'white',
                      color: selected ? '#1d4ed8' : '#64748b',
                      transition: 'all 0.15s',
                    }}
                  >
                    {selected && '✓ '}{f.label}
                  </button>
                )
              })}
            </div>
            {editing.columns.length > 0 && (
              <div style={{ marginTop: '8px', fontSize: '12px', color: '#94a3b8' }}>
                Selected: {editing.columns.map(c => fields.find(f => f.key === c)?.label ?? c).join(' → ')}
              </div>
            )}
          </div>

          {/* Filters */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <label style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Filters</label>
              <button onClick={addFilter} style={{ ...btnSecondary, padding: '5px 10px', fontSize: '12px' }}>
                <PlusCircle size={12} /> Add Filter
              </button>
            </div>
            {editing.filters.length === 0 && (
              <div style={{ fontSize: '13px', color: '#94a3b8' }}>No filters — all records returned.</div>
            )}
            {editing.filters.map((f, i) => (
              <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap' }}>
                <select value={f.field} onChange={e => updateFilter(i, { field: e.target.value })} style={{ ...selectStyle, flex: '1 1 140px' }}>
                  {fields.map(fd => <option key={fd.key} value={fd.key}>{fd.label}</option>)}
                </select>
                <select value={f.op} onChange={e => updateFilter(i, { op: e.target.value as any })} style={{ ...selectStyle, flex: '0 0 110px' }}>
                  {FILTER_OPS.map(op => <option key={op.value} value={op.value}>{op.label}</option>)}
                </select>
                <input value={f.value} onChange={e => updateFilter(i, { value: e.target.value })} placeholder="value" style={{ ...inputStyle, flex: '1 1 120px' }} />
                <button onClick={() => removeFilter(i)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', flexShrink: 0 }}><X size={16} /></button>
              </div>
            ))}
          </div>

          {/* Sort */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '24px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748b', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Sort By</label>
              <select value={editing.sort_field} onChange={e => setField('sort_field', e.target.value)} style={selectStyle}>
                <option value="">— default order —</option>
                {fields.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748b', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Direction</label>
              <select value={editing.sort_dir} onChange={e => setField('sort_dir', e.target.value as 'asc' | 'desc')} style={selectStyle}>
                <option value="asc">Ascending</option>
                <option value="desc">Descending</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={save} disabled={saving} style={{ ...btnPrimary, opacity: saving ? 0.7 : 1 }}>
              {saving ? 'Saving…' : editId ? 'Save Changes' : 'Create Report'}
            </button>
            <button onClick={cancel} style={btnSecondary}>Cancel</button>
          </div>
        </div>
      )}

      {/* Saved reports list */}
      {loading ? (
        <div style={{ fontSize: '14px', color: '#94a3b8', padding: '32px', textAlign: 'center' }}>Loading…</div>
      ) : reports.length === 0 && !editing ? (
        <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '48px', textAlign: 'center' }}>
          <FileText size={32} color="#e2e8f0" style={{ margin: '0 auto 12px' }} />
          <div style={{ fontSize: '14px', color: '#94a3b8' }}>No custom reports yet. Click "New Report" to create one.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {reports.map(r => {
            const isOpen = runId === r.id
            const fieldLabels = Object.fromEntries((FIELD_CATALOG[r.data_source as DataSource]?.fields ?? []).map((f: any) => [f.key, f.label]))
            return (
              <div key={r.id} style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div style={{ background: '#eff6ff', borderRadius: '8px', padding: '8px', flexShrink: 0 }}>
                    <FileText size={16} color="#2563eb" />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a' }}>{r.name}</div>
                    <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                      {FIELD_CATALOG[r.data_source as DataSource]?.label} · {r.columns.length} columns
                      {r.filters?.length ? ` · ${r.filters.length} filter${r.filters.length > 1 ? 's' : ''}` : ''}
                      {' · '}<span style={{ color: '#94a3b8' }}>visible to {ROLE_LABELS[r.min_role] ?? r.min_role}+</span>
                    </div>
                    {r.description && <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>{r.description}</div>}
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexShrink: 0, alignItems: 'center' }}>
                    {isOpen && runRows.length > 0 && (
                      <button onClick={() => downloadCSV(r)} style={{ display: 'flex', alignItems: 'center', gap: '5px', background: '#f0fdf4', color: '#15803d', border: '1px solid #86efac', borderRadius: '7px', padding: '6px 12px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                        <Download size={13} /> CSV
                      </button>
                    )}
                    <button onClick={() => runReport(r)} disabled={runLoading && isOpen} style={{ display: 'flex', alignItems: 'center', gap: '5px', background: isOpen ? '#f1f5f9' : '#2563eb', color: isOpen ? '#475569' : 'white', border: isOpen ? '1px solid #e2e8f0' : 'none', borderRadius: '7px', padding: '6px 12px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                      <Play size={13} fill={isOpen ? '#475569' : 'white'} /> {runLoading && isOpen ? 'Running…' : isOpen ? 'Hide' : 'Run'}
                    </button>
                    <button onClick={() => startEdit(r)} style={{ ...btnSecondary, padding: '6px 12px' }}>
                      <Edit3 size={13} /> Edit
                    </button>
                    <button onClick={() => deleteReport(r.id, r.name)} style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'white', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: '7px', padding: '6px 12px', fontSize: '13px', cursor: 'pointer' }}>
                      <Trash2 size={13} /> Delete
                    </button>
                  </div>
                </div>

                {isOpen && (
                  <div style={{ borderTop: '1px solid #f1f5f9' }}>
                    {runError && <div style={{ padding: '16px 20px', color: '#b91c1c', fontSize: '13px' }}>{runError}</div>}
                    {runLoading && <div style={{ padding: '32px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>Running report…</div>}
                    {!runLoading && !runError && runRows.length === 0 && <div style={{ padding: '32px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>No records match this report.</div>}
                    {!runLoading && runRows.length > 0 && (
                      <>
                        <div style={{ overflowX: 'auto' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '500px' }}>
                            <thead>
                              <tr style={{ background: '#f8fafc' }}>
                                {runCols.map(c => (
                                  <th key={c} style={{ padding: '9px 14px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap', borderBottom: '1px solid #e2e8f0' }}>
                                    {fieldLabels[c] ?? c}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {runRows.slice(0, 200).map((row, i) => (
                                <tr key={i} style={{ background: i % 2 === 0 ? 'white' : '#fafafa', borderBottom: '1px solid #f1f5f9' }}>
                                  {runCols.map(c => (
                                    <td key={c} style={{ padding: '9px 14px', fontSize: '13px', color: '#334155', whiteSpace: 'nowrap' }}>
                                      {row[c] != null ? String(row[c]) : <span style={{ color: '#cbd5e1' }}>—</span>}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <div style={{ padding: '10px 16px', fontSize: '12px', color: '#94a3b8', background: '#fafafa', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between' }}>
                          <span>{runRows.length} record{runRows.length !== 1 ? 's' : ''}{runRows.length > 200 ? ' (showing first 200)' : ''}</span>
                          {runRows.length > 200 && <span>Use CSV export for full dataset</span>}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
