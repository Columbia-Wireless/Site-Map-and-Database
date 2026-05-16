'use client'

import { useState } from 'react'
import { FileText, AlertCircle, Edit3, Loader2 } from 'lucide-react'
import TermsReviewModal from './TermsReviewModal'

interface Doc {
  id: string
  name: string
  doc_type: string
  doc_status: string
  uploaded_at: string
  extracted_terms?: Record<string, any>
}

interface Props {
  docs: Doc[]
  siteId: string
}

// Field groupings for display
const TERM_GROUPS: { label: string; fields: string[] }[] = [
  {
    label: 'Parties & Location',
    fields: ['licensor', 'licensee', 'site_id', 'premises_address', 'premises_description'],
  },
  {
    label: 'Financial',
    fields: ['monthly_rent', 'annual_rent', 'escalation_rate', 'escalation_type', 'one_time_fee'],
  },
  {
    label: 'Term & Renewal',
    fields: ['signature_date', 'commencement_date', 'initial_term_years', 'renewal_options', 'holdover_provisions'],
  },
  {
    label: 'Legal',
    fields: [
      'governing_law', 'permitted_use', 'assignment_allowed',
      'termination_notice', 'termination_notice_days',
      'insurance_per_occurrence', 'insurance_aggregate', 'insurance_liability',
      'relocation_provisions',
    ],
  },
  {
    label: 'Equipment',
    fields: ['equipment_description'],
  },
  {
    label: 'Notes',
    fields: ['notes'],
  },
]

const CONFIDENCE_DOT: Record<string, { color: string; label: string }> = {
  high:     { color: '#16a34a', label: 'High confidence' },
  medium:   { color: '#d97706', label: 'Needs verification' },
  low:      { color: '#dc2626', label: 'Not found / unclear' },
  human:    { color: '#2563eb', label: 'Manually entered' },
}

function termValue(v: any): string {
  if (v === null || v === undefined) return '—'
  if (typeof v === 'object' && 'value' in v) return v.value != null && v.value !== '' ? String(v.value) : '—'
  return String(v)
}

function termConfidence(v: any): 'high' | 'medium' | 'low' | 'human' {
  if (typeof v === 'object' && v !== null) {
    if (v.edited_by) return 'human'
    if ('confidence' in v) return v.confidence
  }
  if (v === null || v === undefined || v === '') return 'low'
  return 'high'
}

function termNote(v: any): string | null {
  if (typeof v === 'object' && v !== null && 'note' in v) return v.note ?? null
  return null
}

function formatKey(key: string): string {
  return key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function formatValue(key: string, raw: any): string {
  const val = termValue(raw)
  if (val === '—') return val
  if (key === 'monthly_rent' || key === 'annual_rent' || key.includes('insurance') || key === 'one_time_fee') {
    const n = Number(val)
    if (!isNaN(n)) return '$' + n.toLocaleString()
  }
  if (key === 'escalation_rate') {
    const n = Number(val)
    if (!isNaN(n)) return n + '%'
  }
  return val
}

export default function SiteTermsPanel({ docs: initialDocs, siteId }: Props) {
  const [docs, setDocs] = useState(initialDocs)
  const extractedDocs = docs.filter(d => d.extracted_terms && Object.keys(d.extracted_terms).length > 0)
  const [selectedId, setSelectedId] = useState<string>(extractedDocs[0]?.id ?? '')
  const [showModal, setShowModal] = useState(false)

  if (extractedDocs.length === 0) return null

  const doc = extractedDocs.find(d => d.id === selectedId) ?? extractedDocs[0]
  const terms = doc.extracted_terms!

  // Collect all field keys that have data
  const allKeys = Object.keys(terms).filter(k => !k.startsWith('_'))

  // Flatten grouped fields, then append any ungrouped keys at the end
  const groupedKeys = new Set(TERM_GROUPS.flatMap(g => g.fields))
  const extraKeys = allKeys.filter(k => !groupedKeys.has(k))

  // Count flags
  const flagCount = allKeys.filter(k => {
    const conf = termConfidence(terms[k])
    return conf === 'medium' || conf === 'low'
  }).length

  // Address mismatch check
  const addrCheck = (terms as any)._address_check
  const hasAddressMismatch = addrCheck?.mismatch && !addrCheck?.accepted
  const totalFlags = flagCount + (hasAddressMismatch ? 1 : 0)

  const statusColor = doc.doc_status === 'notarized' ? '#2563eb'
    : doc.doc_status === 'extracted' || doc.doc_status === 'approved' ? '#15803d'
    : doc.doc_status === 'review_required' ? '#b91c1c'
    : '#64748b'

  const statusBg = doc.doc_status === 'notarized' ? '#eff6ff'
    : doc.doc_status === 'extracted' || doc.doc_status === 'approved' ? '#dcfce7'
    : doc.doc_status === 'review_required' ? '#fee2e2'
    : '#f1f5f9'

  const statusLabel = doc.doc_status === 'notarized' ? 'Notarized'
    : doc.doc_status === 'extracted' ? 'Terms Extracted'
    : doc.doc_status === 'approved' ? 'Manually Approved'
    : doc.doc_status === 'review_required' ? `Needs Review (${totalFlags} flag${totalFlags !== 1 ? 's' : ''})`
    : doc.doc_status

  return (
  <>
    <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '10px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', overflow: 'hidden' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #f1f5f9' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <FileText size={16} color="#2563eb" />
          <span style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a' }}>Extracted Lease Terms</span>
          <span style={{ fontSize: '11px', fontWeight: 600, padding: '3px 8px', borderRadius: '10px', background: statusBg, color: statusColor }}>
            {statusLabel}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Document selector if multiple extracted docs */}
          {extractedDocs.length > 1 && (
            <select
              value={selectedId}
              onChange={e => setSelectedId(e.target.value)}
              style={{ fontSize: '12px', padding: '5px 8px', borderRadius: '6px', border: '1px solid #e2e8f0', color: '#374151', background: 'white' }}
            >
              {extractedDocs.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          )}
          {extractedDocs.length === 1 && (
            <span style={{ fontSize: '12px', color: '#94a3b8' }}>{doc.name}</span>
          )}
          <button
            onClick={() => setShowModal(true)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '6px', padding: '7px 14px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
          >
            <Edit3 size={13} /> Review &amp; Edit Terms
          </button>
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '10px 20px', background: '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
        <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600 }}>CONFIDENCE:</span>
        {Object.entries(CONFIDENCE_DOT).map(([k, v]) => (
          <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: '#64748b' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: v.color, display: 'inline-block' }} />
            {v.label}
          </span>
        ))}
      </div>

      {/* Address mismatch banner */}
      {hasAddressMismatch && (
        <AddressMismatchBanner
          siteAddress={addrCheck.site_address}
          leaseAddress={addrCheck.extracted_address}
          siteId={siteId}
          docId={doc.id}
          terms={terms as Record<string, any>}
          onAccepted={updated => setDocs(prev => prev.map(d => d.id === updated.id ? { ...d, ...updated } : d))}
        />
      )}

      {/* Term groups */}
      <div style={{ padding: '20px' }}>
        {[...TERM_GROUPS, ...(extraKeys.length > 0 ? [{ label: 'Other', fields: extraKeys }] : [])].map(group => {
          const visibleFields = group.fields.filter(f => allKeys.includes(f))
          if (visibleFields.length === 0) return null
          return (
            <div key={group.label} style={{ marginBottom: '24px' }}>
              {/* Group header */}
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', letterSpacing: '0.08em', marginBottom: '10px', paddingBottom: '6px', borderBottom: '2px solid #f1f5f9' }}>
                {group.label.toUpperCase()}
              </div>
              {/* Fields grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '2px' }}>
                {visibleFields.map(field => {
                  const raw = terms[field]
                  const conf = termConfidence(raw)
                  const dot = CONFIDENCE_DOT[conf]
                  const val = formatValue(field, raw)
                  const note = termNote(raw)
                  const isLong = val.length > 80
                  return (
                    <div
                      key={field}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '10px',
                        padding: '10px 12px',
                        borderRadius: '6px',
                        background: conf === 'medium' ? '#fffbeb' : conf === 'low' ? '#fff5f5' : conf === 'human' ? '#eff6ff' : 'transparent',
                        gridColumn: isLong ? 'span 2' : 'span 1',
                      }}
                    >
                      {/* Dot */}
                      <span
                        title={dot.label}
                        style={{ width: '9px', height: '9px', borderRadius: '50%', background: dot.color, flexShrink: 0, marginTop: '5px' }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600, marginBottom: '3px' }}>
                          {formatKey(field)}
                        </div>
                        <div style={{ fontSize: '14px', color: conf === 'low' ? '#94a3b8' : '#0f172a', fontWeight: conf === 'low' ? 400 : 500, fontStyle: conf === 'low' ? 'italic' : 'normal', lineHeight: '1.5' }}>
                          {val}
                        </div>
                        {note && (
                          <div style={{ fontSize: '12px', color: conf === 'medium' ? '#b45309' : '#dc2626', marginTop: '4px', lineHeight: '1.4' }}>
                            {note}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>

    {/* Review modal */}
    {showModal && (
      <TermsReviewModal
        doc={doc}
        siteId={siteId}
        onClose={() => setShowModal(false)}
        onSaved={updated => {
          setDocs(prev => prev.map(d => d.id === updated.id ? { ...d, ...updated } : d))
          setShowModal(false)
        }}
      />
    )}
  </>
  )
}

// ── Address mismatch banner ──────────────────────────────────────────────────

function AddressMismatchBanner({
  siteAddress, leaseAddress, siteId, docId, terms, onAccepted,
}: {
  siteAddress: string
  leaseAddress: string
  siteId: string
  docId: string
  terms: Record<string, any>
  onAccepted: (doc: any) => void
}) {
  const [loading, setLoading] = useState(false)

  async function accept() {
    setLoading(true)
    const newTerms = {
      ...terms,
      _address_check: { ...terms._address_check, accepted: true },
    }
    const res = await fetch(`/api/sites/${siteId}/documents/${docId}/terms`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ field: '_address_check', all_terms: newTerms }),
    })
    const data = await res.json()
    setLoading(false)
    if (res.ok) onAccepted(data)
    else console.error('Address accept failed: ' + data.error)
  }

  return (
    <div style={{ margin: '0 20px 0', background: '#fefce8', border: '1px solid #fde68a', borderRadius: '8px', padding: '14px 16px', display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
      <AlertCircle size={16} color="#b45309" style={{ flexShrink: 0, marginTop: '2px' }} />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '13px', fontWeight: 600, color: '#92400e', marginBottom: '8px' }}>
          Address mismatch — lease address differs from site record
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '13px' }}>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 600, color: '#b45309', marginBottom: '3px' }}>SITE RECORD</div>
            <div style={{ color: '#0f172a' }}>{siteAddress}</div>
          </div>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 600, color: '#b45309', marginBottom: '3px' }}>LEASE DOCUMENT</div>
            <div style={{ color: '#0f172a' }}>{leaseAddress || '—'}</div>
          </div>
        </div>
      </div>
      <button
        onClick={accept}
        disabled={loading}
        style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: '6px', background: loading ? '#e2e8f0' : '#92400e', color: loading ? '#94a3b8' : 'white', border: 'none', borderRadius: '6px', padding: '7px 14px', fontSize: '12px', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer' }}
      >
        {loading ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : null}
        {loading ? 'Saving…' : 'Accept Discrepancy'}
      </button>
    </div>
  )
}
