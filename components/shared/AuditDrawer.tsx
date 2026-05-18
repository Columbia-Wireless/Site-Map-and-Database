'use client'

import { useState } from 'react'
import { History, X, RefreshCw } from 'lucide-react'

interface Props {
  entityId: string
  entityType: 'owner' | 'licensee'
}

export default function AuditDrawer({ entityId, entityType }: Props) {
  const [open, setOpen]       = useState(false)
  const [rows, setRows]       = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  async function load() {
    setLoading(true)
    const base = entityType === 'owner' ? `/api/owners/${entityId}/audit` : `/api/tenants/${entityId}/audit`
    const res  = await fetch(base)
    if (res.ok) setRows(await res.json())
    setLoading(false)
  }

  function handleOpen() {
    setOpen(true)
    load()
  }

  return (
    <>
      <button
        onClick={handleOpen}
        style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'white', color: '#1a3a5c', border: '1px solid #e2e8f0', borderRadius: '7px', padding: '9px 16px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
      >
        <History size={14} /> Audit
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => setOpen(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 999 }}
          />

          {/* Drawer */}
          <div style={{
            position: 'fixed', top: 0, right: 0, height: '100vh', width: '680px', maxWidth: '95vw',
            background: 'white', boxShadow: '-4px 0 24px rgba(0,0,0,0.12)', zIndex: 1000,
            display: 'flex', flexDirection: 'column',
          }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 24px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <History size={16} color="#2563eb" />
                <span style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>Change History</span>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button
                  onClick={load}
                  disabled={loading}
                  style={{ background: 'none', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '5px 8px', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}
                >
                  <RefreshCw size={12} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
                  Refresh
                </button>
                <button
                  onClick={() => setOpen(false)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: '4px', display: 'flex', alignItems: 'center' }}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '0' }}>
              {loading ? (
                <div style={{ padding: '48px', textAlign: 'center', color: '#94a3b8', fontSize: '14px' }}>Loading…</div>
              ) : rows.length === 0 ? (
                <div style={{ padding: '48px', textAlign: 'center', color: '#94a3b8', fontSize: '14px' }}>No changes recorded yet.</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', position: 'sticky', top: 0 }}>
                      {['Date', 'User', 'Field', 'Previous', 'New Value'].map(h => (
                        <th key={h} style={{ padding: '9px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, i) => (
                      <tr key={row.id} style={{ background: i % 2 === 0 ? 'white' : '#fafafa', borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '9px 16px', fontSize: '12px', color: '#64748b', whiteSpace: 'nowrap' }}>
                          {new Date(row.changed_at).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
                        </td>
                        <td style={{ padding: '9px 16px', fontSize: '12px', color: '#334155' }}>{row.changed_by}</td>
                        <td style={{ padding: '9px 16px', fontSize: '12px', fontWeight: 600, color: '#0f172a' }}>{row.field_name}</td>
                        <td style={{ padding: '9px 16px', fontSize: '12px', color: '#94a3b8', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={row.old_value ?? ''}>{row.old_value || '—'}</td>
                        <td style={{ padding: '9px 16px', fontSize: '12px', color: '#0f172a', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={row.new_value ?? ''}>{row.new_value || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}
    </>
  )
}
