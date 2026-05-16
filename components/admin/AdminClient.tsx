'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Database, Trash2, AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react'

interface Counts {
  sites: number | null
  owners: number | null
  tenants: number | null
  tenancies: number | null
  documents: number | null
  changeLogs: number | null
  media: number | null
}

interface Props {
  counts: Counts
  totalRows: number
}

const TABLE_LABELS: { key: keyof Counts; label: string; description: string }[] = [
  { key: 'sites',      label: 'Tower Sites',    description: 'Site records, coordinates, status' },
  { key: 'owners',     label: 'Host Agencies',  description: 'Host agency / landlord records' },
  { key: 'tenants',    label: 'Licensees',      description: 'Carrier / licensee records' },
  { key: 'tenancies',  label: 'Licenses',       description: 'License agreements and rental terms' },
  { key: 'documents',  label: 'Documents',      description: 'Uploaded lease and compliance docs' },
  { key: 'changeLogs', label: 'Change Log',     description: 'Audit trail of all edits' },
  { key: 'media',      label: 'Site Media',     description: 'Photos and videos (storage files)' },
]

export default function AdminClient({ counts, totalRows }: Props) {
  const router = useRouter()
  const [confirmText, setConfirmText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const canReset = confirmText === 'RESET' && totalRows > 0

  async function handleReset() {
    if (!canReset) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/reset', { method: 'POST' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Reset failed')
      setDone(true)
      setTimeout(() => router.push('/dashboard'), 2500)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#f8fafc',
      }}>
        <div style={{ textAlign: 'center' }}>
          <CheckCircle2 size={56} color="#16a34a" style={{ marginBottom: '16px' }} />
          <div style={{ fontSize: '22px', fontWeight: 700, color: '#0f172a', marginBottom: '8px' }}>
            All data cleared
          </div>
          <div style={{ fontSize: '14px', color: '#64748b' }}>
            Redirecting to dashboard…
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', padding: '40px 24px' }}>
      <div style={{ maxWidth: '760px', margin: '0 auto' }}>

        {/* Header */}
        <div style={{ marginBottom: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <Database size={22} color="#1a3a5c" />
            <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#0f172a', margin: 0 }}>
              Data Management
            </h1>
          </div>
          <p style={{ fontSize: '14px', color: '#64748b', margin: 0 }}>
            Review live data counts and reset the database to begin entering real data.
          </p>
        </div>

        {/* Current data counts */}
        <div style={{
          background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px',
          padding: '24px', marginBottom: '28px',
        }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#64748b', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Current Data
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
            {TABLE_LABELS.map(({ key, label, description }, i) => (
              <div key={key} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 0',
                borderBottom: i < TABLE_LABELS.length - 1 ? '1px solid #f1f5f9' : 'none',
              }}>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 500, color: '#1e293b' }}>{label}</div>
                  <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '1px' }}>{description}</div>
                </div>
                <div style={{
                  fontSize: '18px', fontWeight: 700,
                  color: (counts[key] ?? 0) > 0 ? '#1a3a5c' : '#94a3b8',
                  minWidth: '48px', textAlign: 'right',
                }}>
                  {(counts[key] ?? 0).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
          <div style={{
            marginTop: '16px', paddingTop: '16px', borderTop: '2px solid #f1f5f9',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#64748b' }}>Total rows</span>
            <span style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a' }}>
              {totalRows.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Reset section */}
        <div style={{
          background: 'white', border: '1px solid #fca5a5', borderRadius: '12px',
          padding: '24px',
        }}>
          {/* Warning banner */}
          <div style={{
            display: 'flex', gap: '12px', alignItems: 'flex-start',
            background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px',
            padding: '14px 16px', marginBottom: '24px',
          }}>
            <AlertTriangle size={18} color="#dc2626" style={{ flexShrink: 0, marginTop: '1px' }} />
            <div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#991b1b', marginBottom: '4px' }}>
                This action is permanent and cannot be undone
              </div>
              <div style={{ fontSize: '12px', color: '#dc2626', lineHeight: '1.6' }}>
                All sites, agencies, licensees, licenses, documents, change log entries, and uploaded media will be permanently deleted. Use this only when you are ready to move from sample data to live data.
              </div>
            </div>
          </div>

          <div style={{ fontSize: '15px', fontWeight: 600, color: '#0f172a', marginBottom: '6px' }}>
            Reset all data
          </div>
          <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '20px' }}>
            Type <strong>RESET</strong> in the box below to confirm, then click the button.
          </div>

          <input
            type="text"
            value={confirmText}
            onChange={e => setConfirmText(e.target.value)}
            placeholder="Type RESET to confirm"
            disabled={loading || totalRows === 0}
            style={{
              width: '100%', boxSizing: 'border-box',
              padding: '10px 14px', fontSize: '14px',
              border: `1px solid ${confirmText === 'RESET' ? '#dc2626' : '#e2e8f0'}`,
              borderRadius: '8px', outline: 'none', marginBottom: '16px',
              background: totalRows === 0 ? '#f8fafc' : 'white',
              color: '#0f172a',
              fontFamily: 'monospace',
            }}
          />

          {error && (
            <div style={{
              background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px',
              padding: '10px 14px', fontSize: '13px', color: '#dc2626', marginBottom: '16px',
            }}>
              {error}
            </div>
          )}

          {totalRows === 0 && (
            <div style={{
              background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px',
              padding: '10px 14px', fontSize: '13px', color: '#16a34a', marginBottom: '16px',
            }}>
              The database is already empty — nothing to reset.
            </div>
          )}

          <button
            onClick={handleReset}
            disabled={!canReset || loading}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              background: canReset && !loading ? '#dc2626' : '#f1f5f9',
              color: canReset && !loading ? 'white' : '#94a3b8',
              border: 'none', borderRadius: '8px', padding: '10px 20px',
              fontSize: '14px', fontWeight: 600, cursor: canReset && !loading ? 'pointer' : 'not-allowed',
              transition: 'background 0.15s',
            }}
          >
            {loading
              ? <><RefreshCw size={15} style={{ animation: 'spin 1s linear infinite' }} /> Resetting…</>
              : <><Trash2 size={15} /> Reset all data</>
            }
          </button>
        </div>

        <style>{`
          @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        `}</style>
      </div>
    </div>
  )
}
