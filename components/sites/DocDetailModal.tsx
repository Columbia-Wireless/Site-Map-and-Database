'use client'

import { useState, useRef, useEffect } from 'react'
import {
  X, FileText, Edit3, Save, ThumbsUp, Shield, Sparkles,
  Loader2, CheckCircle2, AlertCircle, Upload, Hash, Clock,
  User, ExternalLink,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface TermField {
  value: any
  confidence: 'high' | 'medium' | 'low' | 'human'
  note?: string
  edited_by?: string
  edited_at?: string
  original_value?: any
}

interface Doc {
  id: string
  name: string
  doc_type: string
  doc_status: string
  uploaded_by: string
  uploaded_at: string
  file_size_kb: number
  file_hash?: string
  iota_block_id?: string
  iota_explorer_url?: string
  extracted_terms?: Record<string, any>
}

interface Props {
  doc: Doc
  siteId: string
  canEdit: boolean
  onClose: () => void
  onUpdated: (doc: Doc) => void
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TERM_GROUPS: { label: string; fields: string[] }[] = [
  { label: 'Parties & Location',  fields: ['licensor', 'licensee', 'site_id', 'premises_address', 'premises_description'] },
  { label: 'Financial',           fields: ['monthly_rent', 'annual_rent', 'escalation_rate', 'escalation_type', 'one_time_fee'] },
  { label: 'Term & Renewal',      fields: ['signature_date', 'commencement_date', 'initial_term_years', 'renewal_options', 'holdover_provisions'] },
  { label: 'Legal',               fields: ['governing_law', 'permitted_use', 'assignment_allowed', 'termination_notice', 'termination_notice_days', 'insurance_per_occurrence', 'insurance_aggregate', 'insurance_liability', 'relocation_provisions'] },
  { label: 'Equipment',           fields: ['equipment_description'] },
  { label: 'Notes',               fields: ['notes'] },
]

const DOC_TYPE_LABELS: Record<string, string> = {
  lease: 'Lease Agreement', amendment: 'Amendment', addendum: 'Addendum',
  coi: 'Certificate of Insurance', fcc_license: 'FCC License',
  structural: 'Structural Certification', title: 'Title / Deed',
  survey: 'Survey', other: 'Other',
}

const CONFIDENCE_DOT: Record<string, { color: string; label: string }> = {
  high:   { color: '#16a34a', label: 'High confidence' },
  medium: { color: '#d97706', label: 'Needs verification' },
  low:    { color: '#dc2626', label: 'Not found / unclear' },
  human:  { color: '#2563eb', label: 'Manually entered' },
}

const STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  uploaded:        { bg: '#f1f5f9', color: '#475569', label: 'Uploaded' },
  extracting:      { bg: '#fef3c7', color: '#d97706', label: 'Extracting…' },
  extracted:       { bg: '#dcfce7', color: '#15803d', label: 'Terms Extracted' },
  review_required: { bg: '#fee2e2', color: '#b91c1c', label: 'Needs Review' },
  approved:        { bg: '#dcfce7', color: '#15803d', label: 'Approved' },
  notarized:       { bg: '#eff6ff', color: '#2563eb', label: 'Notarized' },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getRaw(terms: Record<string, any>, key: string): TermField | null {
  const v = terms[key]
  if (v === undefined) return null
  if (typeof v === 'object' && v !== null && 'confidence' in v) return v as TermField
  return { value: v, confidence: v ? 'high' : 'low' }
}

function displayValue(f: TermField | null): string {
  if (!f || f.value === null || f.value === undefined || f.value === '') return ''
  return String(f.value)
}

function formatKey(key: string) {
  return key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function formatFieldValue(key: string, f: TermField | null): string {
  const val = displayValue(f)
  if (!val) return ''
  if (['monthly_rent', 'annual_rent', 'one_time_fee', 'insurance_per_occurrence', 'insurance_aggregate', 'insurance_liability'].includes(key)) {
    const n = Number(val)
    if (!isNaN(n)) return '$' + n.toLocaleString()
  }
  if (key === 'escalation_rate') { const n = Number(val); if (!isNaN(n)) return n + '%' }
  return val
}

function fmt(bytes: number) {
  if (bytes >= 1024) return (bytes / 1024).toFixed(1) + ' MB'
  return bytes + ' KB'
}

// ─── Main modal ───────────────────────────────────────────────────────────────

export default function DocDetailModal({ doc, siteId, canEdit, onClose, onUpdated }: Props) {
  const [tab, setTab] = useState<'overview' | 'terms' | 'audit'>('overview')
  const [localDoc, setLocalDoc] = useState(doc)
  const [extracting, setExtracting] = useState(false)
  const [approving, setApproving] = useState(false)
  const [notarizing, setNotarizing] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  // Scroll lock
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  // Escape to close
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  function update(updated: Doc) {
    setLocalDoc(updated)
    onUpdated(updated)
  }

  async function extract() {
    setExtracting(true)
    setActionError(null)
    const res = await fetch(`/api/sites/${siteId}/documents/${doc.id}/extract`, { method: 'POST' })
    const data = await res.json()
    setExtracting(false)
    if (res.ok) { update(data); setTab('terms') }
    else setActionError('Extraction failed: ' + (data.error ?? 'Unknown error'))
  }

  async function approve() {
    setApproving(true)
    setActionError(null)
    const res = await fetch(`/api/sites/${siteId}/documents/${doc.id}/approve`, { method: 'POST' })
    const data = await res.json()
    setApproving(false)
    if (res.ok) update(data)
    else setActionError('Approval failed: ' + (data.error ?? 'Unknown error'))
  }

  async function notarize() {
    setNotarizing(true)
    setActionError(null)
    const res = await fetch(`/api/sites/${siteId}/documents/${doc.id}/notarize`, { method: 'POST' })
    const data = await res.json()
    setNotarizing(false)
    if (res.ok) update(data)
    else setActionError('Notarization failed: ' + (data.error ?? 'Unknown error'))
  }

  const st = STATUS_STYLE[localDoc.doc_status] ?? STATUS_STYLE.uploaded
  const hasTerms = !!localDoc.extracted_terms && Object.keys(localDoc.extracted_terms).filter(k => !k.startsWith('_')).length > 0

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, backdropFilter: 'blur(3px)' }} />

      {/* Modal */}
      <div style={{
        position: 'fixed', top: '4vh', left: '50%', transform: 'translateX(-50%)',
        width: 'min(900px, 96vw)', maxHeight: '92vh',
        background: 'white', borderRadius: '14px',
        boxShadow: '0 24px 64px rgba(0,0,0,0.28)',
        zIndex: 1001, display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>

        {/* ── Header ────────────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '20px 24px 16px', borderBottom: '1px solid #f1f5f9', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', flex: 1, minWidth: 0 }}>
            <div style={{ background: '#eff6ff', borderRadius: '8px', padding: '8px', flexShrink: 0 }}>
              <FileText size={18} color="#2563eb" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a', margin: 0, lineHeight: 1.3 }}>
                  {localDoc.name}
                </h2>
                <span style={{ fontSize: '11px', fontWeight: 600, padding: '3px 8px', borderRadius: '10px', background: st.bg, color: st.color, whiteSpace: 'nowrap' }}>
                  {st.label}
                </span>
              </div>
              <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '3px' }}>
                {DOC_TYPE_LABELS[localDoc.doc_type] ?? localDoc.doc_type} · {fmt(localDoc.file_size_kb)} · {localDoc.uploaded_by}
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, marginLeft: '16px' }}>
            {canEdit && !hasTerms && localDoc.doc_status !== 'extracting' && (
              <button onClick={extract} disabled={extracting} style={btnStyle('#7c3aed')}>
                {extracting ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Sparkles size={13} />}
                {extracting ? 'Extracting…' : 'Extract Terms'}
              </button>
            )}
            {canEdit && localDoc.doc_status === 'review_required' && (
              <button onClick={approve} disabled={approving} style={btnStyle('#15803d')}>
                {approving ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <ThumbsUp size={13} />}
                {approving ? 'Approving…' : 'Approve'}
              </button>
            )}
            {canEdit && localDoc.doc_status === 'approved' && !localDoc.iota_block_id && (
              <button onClick={notarize} disabled={notarizing} style={btnStyle('#2563eb')}>
                {notarizing ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Shield size={13} />}
                {notarizing ? 'Submitting…' : 'Notarize on IOTA'}
              </button>
            )}
            {localDoc.iota_block_id && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '12px', fontWeight: 600, color: '#2563eb', background: '#eff6ff', padding: '6px 12px', borderRadius: '8px' }}>
                <CheckCircle2 size={13} /> Notarized
              </span>
            )}
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '4px', marginLeft: '4px' }}>
              <X size={20} />
            </button>
          </div>
        </div>

        {/* ── Action error banner ───────────────────────────────────────────── */}
        {actionError && (
          <div style={{ margin: '0 24px', marginTop: '12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', color: '#b91c1c', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
            <span>{actionError}</span>
            <button onClick={() => setActionError(null)} style={{ background: 'none', border: 'none', color: '#b91c1c', cursor: 'pointer', padding: '0 0 0 12px', fontSize: '16px', lineHeight: 1 }}>×</button>
          </div>
        )}

        {/* ── Tabs ──────────────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid #e2e8f0', padding: '0 24px', flexShrink: 0, background: 'white' }}>
          {([
            ['overview', 'File Details', false],
            ['terms',    'Extracted Terms', !hasTerms],
            ['audit',    'Audit Trail', false],
          ] as [string, string, boolean][]).map(([key, label, disabled]) => {
            const active = tab === key
            return (
              <button
                key={key}
                onClick={() => !disabled && setTab(key as any)}
                style={{
                  background: 'none', border: 'none', padding: '12px 16px',
                  fontSize: '13px', fontWeight: active ? 700 : 500,
                  color: active ? '#2563eb' : disabled ? '#cbd5e1' : '#64748b',
                  borderBottom: active ? '2px solid #2563eb' : '2px solid transparent',
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  marginBottom: '-1px',
                  display: 'flex', alignItems: 'center', gap: '6px',
                }}
              >
                {label}
                {key === 'terms' && disabled && (
                  <span style={{ fontSize: '10px', color: '#cbd5e1', fontWeight: 400 }}>—not extracted</span>
                )}
              </button>
            )
          })}
        </div>

        {/* ── Body ──────────────────────────────────────────────────────────── */}
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {tab === 'overview' && <OverviewTab doc={localDoc} />}
          {tab === 'terms' && hasTerms && (
            <TermsTab doc={localDoc} siteId={siteId} canEdit={canEdit} onUpdated={update} />
          )}
          {tab === 'audit' && (
            <AuditTrailTab doc={localDoc} siteId={siteId} />
          )}
        </div>
      </div>
    </>
  )
}

// ─── Overview tab ─────────────────────────────────────────────────────────────

function OverviewTab({ doc }: { doc: Doc }) {
  const rows: [string, React.ReactNode][] = [
    ['File name',    doc.name],
    ['Document type', DOC_TYPE_LABELS[doc.doc_type] ?? doc.doc_type],
    ['File size',    fmt(doc.file_size_kb)],
    ['Uploaded by',  doc.uploaded_by],
    ['Uploaded at',  new Date(doc.uploaded_at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })],
  ]
  if (doc.file_hash) rows.push(['SHA-256', <code key="hash" style={{ fontSize: '11px', background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px', wordBreak: 'break-all' }}>{doc.file_hash}</code>])
  if (doc.iota_block_id) rows.push([
    'IOTA Block ID',
    <div key="iota">
      <code style={{ fontSize: '11px', background: '#eff6ff', color: '#2563eb', padding: '2px 6px', borderRadius: '4px', wordBreak: 'break-all' }}>{doc.iota_block_id}</code>
      {doc.iota_explorer_url && (
        <a href={doc.iota_explorer_url} target="_blank" rel="noopener noreferrer" style={{ marginLeft: '8px', fontSize: '12px', color: '#2563eb' }}>
          View on Explorer ↗
        </a>
      )}
    </div>
  ])

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden' }}>
        {rows.map(([label, value], i) => (
          <div key={label} style={{
            display: 'flex', alignItems: 'flex-start', gap: '16px',
            padding: '12px 16px',
            background: i % 2 === 0 ? 'white' : '#fafafa',
            borderBottom: i < rows.length - 1 ? '1px solid #f1f5f9' : 'none',
          }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#94a3b8', width: '130px', flexShrink: 0, paddingTop: '1px' }}>{label}</span>
            <span style={{ fontSize: '13px', color: '#0f172a', flex: 1 }}>{value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Terms tab ────────────────────────────────────────────────────────────────

function TermsTab({ doc, siteId, canEdit, onUpdated }: { doc: Doc; siteId: string; canEdit: boolean; onUpdated: (d: Doc) => void }) {
  const [localDoc, setLocalDoc] = useState(doc)
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [edits, setEdits] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => { if (editingKey && inputRef.current) { inputRef.current.focus(); inputRef.current.select() } }, [editingKey])

  function update(updated: Doc) { setLocalDoc(updated); onUpdated(updated) }

  const terms = localDoc.extracted_terms ?? {}
  const allKeys = Object.keys(terms).filter(k => !k.startsWith('_'))
  const groupedKeys = new Set(TERM_GROUPS.flatMap(g => g.fields))
  const extraKeys = allKeys.filter(k => !groupedKeys.has(k))
  const groups = [...TERM_GROUPS, ...(extraKeys.length > 0 ? [{ label: 'Other', fields: extraKeys }] : [])]

  function getField(key: string): TermField | null { return getRaw(terms, key) }
  function conf(key: string): 'high' | 'medium' | 'low' | 'human' {
    const f = getField(key)
    if (!f) return 'low'
    if (f.edited_by) return 'human'
    return f.confidence ?? 'low'
  }

  const flagCount = allKeys.filter(k => ['medium', 'low'].includes(conf(k))).length
  const addrCheck = (terms as any)._address_check
  const hasAddrMismatch = addrCheck?.mismatch && !addrCheck?.accepted

  async function saveField(key: string, value: string) {
    setSaving(key)
    const field = getField(key) ?? { value: null, confidence: 'low' as const }
    const updated: TermField = { ...field, value, confidence: 'high', edited_by: 'CWF Admin', edited_at: new Date().toISOString(), original_value: field.original_value ?? field.value }
    const newTerms = { ...terms, [key]: updated }
    const res = await fetch(`/api/sites/${siteId}/documents/${doc.id}/terms`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ field: key, field_data: updated, all_terms: newTerms }),
    })
    const data = await res.json()
    setSaving(null)
    if (res.ok) { update(data); setEdits(p => { const n = { ...p }; delete n[key]; return n }); setEditingKey(null) }
    else alert('Save failed: ' + data.error)
  }

  return (
    <div style={{ padding: '20px 24px' }}>
      {/* Legend + flag count */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px', padding: '10px 14px', background: '#f8fafc', borderRadius: '8px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600 }}>CONFIDENCE:</span>
        {Object.entries(CONFIDENCE_DOT).map(([k, v]) => (
          <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: '#64748b' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: v.color, display: 'inline-block' }} />
            {v.label}
          </span>
        ))}
        {flagCount > 0 && (
          <span style={{ marginLeft: 'auto', fontSize: '12px', color: '#b91c1c', background: '#fee2e2', padding: '3px 10px', borderRadius: '10px', fontWeight: 600 }}>
            {flagCount} flag{flagCount !== 1 ? 's' : ''} need attention
          </span>
        )}
        {canEdit && <span style={{ fontSize: '11px', color: '#94a3b8', marginLeft: flagCount > 0 ? '0' : 'auto' }}>Click any field to edit</span>}
      </div>

      {/* Address mismatch banner */}
      {hasAddrMismatch && (
        <div style={{ background: '#fefce8', border: '1px solid #fde68a', borderRadius: '8px', padding: '14px 16px', marginBottom: '16px', display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
          <AlertCircle size={16} color="#b45309" style={{ flexShrink: 0, marginTop: '2px' }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#92400e', marginBottom: '8px' }}>Address mismatch — lease differs from site record</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '13px' }}>
              <div><div style={{ fontSize: '11px', fontWeight: 600, color: '#b45309', marginBottom: '3px' }}>SITE RECORD</div><div>{addrCheck.site_address}</div></div>
              <div><div style={{ fontSize: '11px', fontWeight: 600, color: '#b45309', marginBottom: '3px' }}>LEASE DOCUMENT</div><div>{addrCheck.extracted_address || '—'}</div></div>
            </div>
          </div>
        </div>
      )}

      {/* Term groups */}
      {groups.map(group => {
        const visible = group.fields.filter(f => allKeys.includes(f))
        if (visible.length === 0) return null
        return (
          <div key={group.label} style={{ marginBottom: '24px' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', letterSpacing: '0.08em', marginBottom: '8px', paddingBottom: '6px', borderBottom: '2px solid #f1f5f9' }}>
              {group.label.toUpperCase()}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {visible.map(key => {
                const field = getField(key)
                const c = conf(key)
                const dot = CONFIDENCE_DOT[c]
                const val = formatFieldValue(key, field)
                const isEditing = editingKey === key
                const isSaving = saving === key
                const needsAction = c === 'medium' || c === 'low'
                return (
                  <div
                    key={key}
                    style={{
                      display: 'flex', alignItems: 'flex-start', gap: '12px',
                      padding: '10px 12px', borderRadius: '8px',
                      background: isEditing ? '#f0f9ff' : c === 'medium' ? '#fffbeb' : c === 'low' ? '#fff5f5' : c === 'human' ? '#eff6ff' : 'transparent',
                      border: isEditing ? '1px solid #7dd3fc' : '1px solid transparent',
                      cursor: canEdit && !isEditing ? 'pointer' : 'default',
                    }}
                    onClick={() => { if (canEdit && !isEditing) { setEditingKey(key); setEdits(p => ({ ...p, [key]: val })) } }}
                  >
                    <span title={dot.label} style={{ width: '9px', height: '9px', borderRadius: '50%', background: dot.color, flexShrink: 0, marginTop: '6px' }} />
                    <div style={{ width: '170px', flexShrink: 0 }}>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>{formatKey(key)}</div>
                      {field?.edited_by && <div style={{ fontSize: '10px', color: '#2563eb', marginTop: '2px' }}>Edited by {field.edited_by}</div>}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {isEditing ? (
                        <div>
                          <textarea
                            ref={inputRef}
                            value={edits[key] ?? val}
                            onChange={e => setEdits(p => ({ ...p, [key]: e.target.value }))}
                            onKeyDown={e => {
                              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveField(key, edits[key] ?? val) }
                              if (e.key === 'Escape') setEditingKey(null)
                            }}
                            rows={3}
                            style={{ width: '100%', fontSize: '13px', padding: '6px 10px', borderRadius: '6px', border: '1px solid #7dd3fc', outline: 'none', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }}
                          />
                          <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                            <button onClick={e => { e.stopPropagation(); saveField(key, edits[key] ?? val) }} disabled={isSaving} style={btnStyle('#15803d')}>
                              {isSaving ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={11} />} Save
                            </button>
                            <button onClick={e => { e.stopPropagation(); setEditingKey(null) }} style={{ background: 'none', border: '1px solid #e2e8f0', borderRadius: '5px', padding: '5px 12px', fontSize: '12px', color: '#64748b', cursor: 'pointer' }}>
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '14px', color: c === 'low' ? '#94a3b8' : '#0f172a', fontStyle: c === 'low' ? 'italic' : 'normal', lineHeight: '1.5' }}>
                              {val || <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Not found{canEdit ? ' — click to enter' : ''}</span>}
                            </div>
                            {field?.note && <div style={{ fontSize: '12px', color: c === 'medium' ? '#b45309' : '#dc2626', marginTop: '3px', lineHeight: '1.4' }}>{field.note}</div>}
                            {field?.original_value != null && <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>Original: {String(field.original_value)}</div>}
                          </div>
                          {canEdit && (
                            <button onClick={e => { e.stopPropagation(); setEditingKey(key); setEdits(p => ({ ...p, [key]: val })) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '2px', flexShrink: 0 }} title="Edit">
                              <Edit3 size={13} />
                            </button>
                          )}
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
  )
}

// ─── Audit trail tab ──────────────────────────────────────────────────────────

interface AuditEvent {
  id: string
  event_type: string
  user_name: string
  details: Record<string, any>
  created_at: string
}

const EVENT_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string; bg: string }> = {
  uploaded:        { label: 'Document uploaded',      icon: <Upload size={13} />,       color: '#2563eb', bg: '#eff6ff' },
  terms_extracted: { label: 'Terms extracted by AI',  icon: <Sparkles size={13} />,     color: '#7c3aed', bg: '#f5f3ff' },
  field_edited:    { label: 'Term field edited',       icon: <Edit3 size={13} />,        color: '#d97706', bg: '#fffbeb' },
  approved:        { label: 'Document approved',       icon: <ThumbsUp size={13} />,     color: '#15803d', bg: '#dcfce7' },
  notarized:       { label: 'Notarized on IOTA',       icon: <Shield size={13} />,       color: '#2563eb', bg: '#eff6ff' },
}

function AuditTrailTab({ doc, siteId }: { doc: Doc; siteId: string }) {
  const [events, setEvents] = useState<AuditEvent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/sites/${siteId}/documents/${doc.id}/events`)
      .then(r => r.json())
      .then(data => { setEvents(Array.isArray(data) ? data : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [doc.id, siteId])

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px', color: '#94a3b8', gap: '10px' }}>
        <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Loading audit trail…
      </div>
    )
  }

  if (events.length === 0) {
    return (
      <div style={{ padding: '48px', textAlign: 'center', color: '#94a3b8', fontSize: '14px' }}>
        No events recorded yet.
      </div>
    )
  }

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ position: 'relative' }}>
        {/* Vertical line */}
        <div style={{ position: 'absolute', left: '17px', top: '8px', bottom: '8px', width: '2px', background: '#f1f5f9' }} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {events.map((ev, i) => {
            const cfg = EVENT_CONFIG[ev.event_type] ?? { label: ev.event_type, icon: <Clock size={13} />, color: '#64748b', bg: '#f1f5f9' }
            const isLast = i === events.length - 1
            const dt = new Date(ev.created_at)
            const dateStr = dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
            const timeStr = dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })

            return (
              <div key={ev.id} style={{ display: 'flex', gap: '14px', paddingBottom: isLast ? 0 : '16px' }}>
                {/* Icon bubble */}
                <div style={{ position: 'relative', flexShrink: 0, zIndex: 1 }}>
                  <div style={{
                    width: '34px', height: '34px', borderRadius: '50%',
                    background: cfg.bg, border: `2px solid white`,
                    boxShadow: `0 0 0 2px ${cfg.color}30`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: cfg.color,
                  }}>
                    {cfg.icon}
                  </div>
                </div>

                {/* Content */}
                <div style={{ flex: 1, paddingTop: '5px' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a' }}>{cfg.label}</span>
                    <span style={{ fontSize: '11px', color: '#94a3b8' }}>{dateStr} · {timeStr}</span>
                  </div>

                  {/* Who */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: '#64748b', marginBottom: '6px' }}>
                    <User size={11} />
                    {ev.user_name}
                  </div>

                  {/* Details card */}
                  {Object.keys(ev.details).length > 0 && (
                    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 12px', fontSize: '12px' }}>
                      {ev.event_type === 'uploaded' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <DetailRow label="Type" value={ev.details.doc_type ?? '—'} />
                          <DetailRow label="Size" value={ev.details.file_size_kb ? `${ev.details.file_size_kb >= 1024 ? (ev.details.file_size_kb / 1024).toFixed(1) + ' MB' : ev.details.file_size_kb + ' KB'}` : '—'} />
                          {ev.details.file_hash && (
                            <DetailRow label="SHA-256" value={
                              <code style={{ fontSize: '10px', color: '#475569', wordBreak: 'break-all' }}>{ev.details.file_hash}</code>
                            } />
                          )}
                        </div>
                      )}

                      {ev.event_type === 'terms_extracted' && (
                        <div style={{ display: 'flex', gap: '16px' }}>
                          <DetailRow label="Fields" value={String(ev.details.field_count ?? '—')} />
                          <DetailRow label="Flags" value={
                            <span style={{ color: ev.details.flag_count > 0 ? '#b91c1c' : '#15803d', fontWeight: 600 }}>
                              {ev.details.flag_count ?? 0}
                            </span>
                          } />
                          <DetailRow label="Result" value={
                            <span style={{ color: ev.details.doc_status === 'review_required' ? '#b91c1c' : '#15803d', fontWeight: 600 }}>
                              {ev.details.doc_status === 'review_required' ? 'Needs Review' : 'Extracted'}
                            </span>
                          } />
                        </div>
                      )}

                      {ev.event_type === 'field_edited' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <DetailRow label="Field" value={<strong>{formatKey(ev.details.field ?? '')}</strong>} />
                          {ev.details.old_value != null && (
                            <DetailRow label="Was" value={
                              <span style={{ color: '#dc2626', textDecoration: 'line-through' }}>{String(ev.details.old_value)}</span>
                            } />
                          )}
                          <DetailRow label="Now" value={
                            <span style={{ color: '#15803d', fontWeight: 600 }}>{String(ev.details.new_value ?? '—')}</span>
                          } />
                        </div>
                      )}

                      {ev.event_type === 'approved' && (
                        <div style={{ color: '#15803d', fontWeight: 500 }}>All terms reviewed and manually approved.</div>
                      )}

                      {ev.event_type === 'notarized' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {ev.details.file_hash && (
                            <DetailRow label="Hash" value={
                              <code style={{ fontSize: '10px', color: '#475569', wordBreak: 'break-all' }}>{ev.details.file_hash}</code>
                            } />
                          )}
                          {ev.details.iota_block_id && (
                            <DetailRow label="IOTA Block" value={
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <code style={{ fontSize: '10px', color: '#2563eb', wordBreak: 'break-all' }}>{ev.details.iota_block_id}</code>
                                {ev.details.iota_explorer_url && (
                                  <a href={ev.details.iota_explorer_url} target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb', flexShrink: 0 }}>
                                    <ExternalLink size={11} />
                                  </a>
                                )}
                              </div>
                            } />
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
      <span style={{ color: '#94a3b8', fontWeight: 600, minWidth: '60px', flexShrink: 0 }}>{label}</span>
      <span style={{ color: '#334155', flex: 1 }}>{value}</span>
    </div>
  )
}

function btnStyle(bg: string): React.CSSProperties {
  return { display: 'inline-flex', alignItems: 'center', gap: '5px', background: bg, color: 'white', border: 'none', borderRadius: '7px', padding: '7px 14px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }
}
