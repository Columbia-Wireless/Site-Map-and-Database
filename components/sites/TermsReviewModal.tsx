'use client'

import { useState, useRef, useEffect } from 'react'
import { X, CheckCircle2, AlertCircle, Edit3, Save, ThumbsUp, Loader2 } from 'lucide-react'

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
  doc_status: string
  extracted_terms?: Record<string, any>
}

interface Props {
  doc: Doc
  siteId: string
  onClose: () => void
  onSaved: (updated: Doc) => void
}

const TERM_GROUPS: { label: string; fields: string[] }[] = [
  { label: 'Parties & Location',  fields: ['licensor', 'licensee', 'site_id', 'premises_address', 'premises_description'] },
  { label: 'Financial',           fields: ['monthly_rent', 'annual_rent', 'escalation_rate', 'escalation_type', 'one_time_fee'] },
  { label: 'Term & Renewal',      fields: ['signature_date', 'commencement_date', 'initial_term_years', 'renewal_options', 'holdover_provisions'] },
  { label: 'Legal',               fields: ['governing_law', 'permitted_use', 'assignment_allowed', 'termination_notice', 'termination_notice_days', 'insurance_per_occurrence', 'insurance_aggregate', 'insurance_liability', 'relocation_provisions'] },
  { label: 'Equipment',           fields: ['equipment_description'] },
  { label: 'Notes',               fields: ['notes'] },
]

const CONFIDENCE_DOT: Record<string, { color: string; label: string }> = {
  high:   { color: '#16a34a', label: 'High confidence' },
  medium: { color: '#d97706', label: 'Needs verification' },
  low:    { color: '#dc2626', label: 'Not found / unclear' },
  human:  { color: '#2563eb', label: 'Manually entered' },
}

function getRaw(terms: Record<string, any>, key: string): TermField | null {
  const v = terms[key]
  if (v === undefined) return null
  if (typeof v === 'object' && v !== null && 'confidence' in v) return v as TermField
  // Legacy flat format
  return { value: v, confidence: v ? 'high' : 'low' }
}

function formatKey(key: string) {
  return key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function displayValue(field: TermField | null): string {
  if (!field || field.value === null || field.value === undefined || field.value === '') return ''
  return String(field.value)
}

export default function TermsReviewModal({ doc, siteId, onClose, onSaved }: Props) {
  const terms = doc.extracted_terms ?? {}
  const allKeys = Object.keys(terms).filter(k => !k.startsWith('_'))
  const groupedKeys = new Set(TERM_GROUPS.flatMap(g => g.fields))
  const extraKeys = allKeys.filter(k => !groupedKeys.has(k))

  // Local edits: key → new value string
  const [edits, setEdits] = useState<Record<string, string>>({})
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [saving, setSaving] = useState<string | null>(null) // key being saved
  const [approving, setApproving] = useState(false)
  const [localDoc, setLocalDoc] = useState(doc)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (editingKey && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editingKey])

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const localTerms = localDoc.extracted_terms ?? {}

  function getField(key: string): TermField | null {
    return getRaw(localTerms, key)
  }

  function confidence(key: string): 'high' | 'medium' | 'low' | 'human' {
    const f = getField(key)
    if (!f) return 'low'
    if (f.edited_by) return 'human'
    return f.confidence ?? 'low'
  }

  const unresolvedCount = allKeys.filter(k => {
    const c = confidence(k)
    return c === 'medium' || c === 'low'
  }).length

  async function saveField(key: string, value: string) {
    setSaving(key)
    const field = getField(key) ?? { value: null, confidence: 'low' as const }
    const updated: TermField = {
      ...field,
      value: value,
      confidence: 'high',
      edited_by: 'CWF Admin',
      edited_at: new Date().toISOString(),
      original_value: field.original_value ?? field.value,
    }

    const newTerms = { ...localTerms, [key]: updated }
    const res = await fetch(`/api/sites/${siteId}/documents/${doc.id}/terms`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ field: key, field_data: updated, all_terms: newTerms }),
    })
    const data = await res.json()
    setSaving(null)
    if (res.ok) {
      setLocalDoc(data)
      onSaved(data)
      setEdits(prev => { const n = { ...prev }; delete n[key]; return n })
      setEditingKey(null)
    } else {
      console.error('Save failed: ' + data.error)
    }
  }

  async function approve() {
    setApproving(true)
    const res  = await fetch(`/api/sites/${siteId}/documents/${doc.id}/approve`, { method: 'POST' })
    const data = await res.json()
    setApproving(false)
    if (res.ok) { setLocalDoc(data); onSaved(data) }
    else console.error('Approval failed: ' + data.error)
  }

  const groups = [
    ...TERM_GROUPS,
    ...(extraKeys.length > 0 ? [{ label: 'Other', fields: extraKeys }] : []),
  ]

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, backdropFilter: 'blur(2px)' }}
      />

      {/* Modal */}
      <div style={{
        position: 'fixed', top: '5vh', left: '50%', transform: 'translateX(-50%)',
        width: 'min(860px, 95vw)', maxHeight: '90vh',
        background: 'white', borderRadius: '12px', boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
        zIndex: 1001, display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 24px', borderBottom: '1px solid #f1f5f9', flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>Review &amp; Edit Terms</div>
            <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>{doc.name}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {unresolvedCount > 0 && (
              <span style={{ fontSize: '12px', color: '#b91c1c', background: '#fee2e2', padding: '4px 10px', borderRadius: '10px', fontWeight: 600 }}>
                {unresolvedCount} flag{unresolvedCount !== 1 ? 's' : ''} remaining
              </span>
            )}
            {unresolvedCount === 0 && localDoc.doc_status !== 'approved' && localDoc.doc_status !== 'notarized' && (
              <button
                onClick={approve}
                disabled={approving}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#15803d', color: 'white', border: 'none', borderRadius: '6px', padding: '8px 16px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
              >
                {approving ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <ThumbsUp size={13} />}
                {approving ? 'Approving…' : 'Approve All'}
              </button>
            )}
            {(localDoc.doc_status === 'approved' || localDoc.doc_status === 'notarized') && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '12px', fontWeight: 600, color: '#15803d', background: '#dcfce7', padding: '5px 12px', borderRadius: '10px' }}>
                <CheckCircle2 size={13} /> {localDoc.doc_status === 'notarized' ? 'Notarized' : 'Approved'}
              </span>
            )}
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '4px' }}>
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '8px 24px', background: '#f8fafc', borderBottom: '1px solid #f1f5f9', flexShrink: 0 }}>
          <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600 }}>CONFIDENCE:</span>
          {Object.entries(CONFIDENCE_DOT).map(([k, v]) => (
            <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: '#64748b' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: v.color, display: 'inline-block' }} />
              {v.label}
            </span>
          ))}
          <span style={{ fontSize: '11px', color: '#94a3b8', marginLeft: 'auto' }}>Hover green fields to edit · Click yellow/red to correct</span>
        </div>

        {/* Scrollable body */}
        <div style={{ overflowY: 'auto', padding: '20px 24px', flex: 1 }}>

          {/* Address mismatch banner */}
          {(() => {
            const ac = (localDoc.extracted_terms as any)?._address_check
            if (!ac?.mismatch || ac?.accepted) return null
            return (
              <ModalAddressBanner
                siteAddress={ac.site_address}
                leaseAddress={ac.extracted_address}
                onAccept={async () => {
                  const newTerms = { ...localTerms, _address_check: { ...ac, accepted: true } }
                  const res = await fetch(`/api/sites/${siteId}/documents/${doc.id}/terms`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ field: '_address_check', all_terms: newTerms }),
                  })
                  const data = await res.json()
                  if (res.ok) { setLocalDoc(data); onSaved(data) }
                  else console.error('Failed: ' + data.error)
                }}
              />
            )
          })()}
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
                    const field  = getField(key)
                    const conf   = confidence(key)
                    const dot    = CONFIDENCE_DOT[conf]
                    const val    = displayValue(field)
                    const note   = field?.note ?? null
                    const isEditing = editingKey === key
                    const isSaving  = saving === key
                    const needsAction = conf === 'medium' || conf === 'low'

                    return (
                      <div
                        key={key}
                        style={{
                          display: 'flex', alignItems: 'flex-start', gap: '12px',
                          padding: '10px 12px', borderRadius: '8px',
                          background: isEditing ? '#f0f9ff'
                            : conf === 'medium' ? '#fffbeb'
                            : conf === 'low' ? '#fff5f5'
                            : conf === 'human' ? '#eff6ff'
                            : 'transparent',
                          border: isEditing ? '1px solid #7dd3fc' : '1px solid transparent',
                          cursor: needsAction && !isEditing ? 'pointer' : 'default',
                        }}
                        onClick={() => { if (needsAction && !isEditing) { setEditingKey(key); setEdits(p => ({ ...p, [key]: val })) } }}
                      >
                        {/* Dot */}
                        <span title={dot.label} style={{ width: '9px', height: '9px', borderRadius: '50%', background: dot.color, flexShrink: 0, marginTop: '6px' }} />

                        {/* Label */}
                        <div style={{ width: '170px', flexShrink: 0 }}>
                          <div style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>{formatKey(key)}</div>
                          {field?.edited_by && (
                            <div style={{ fontSize: '10px', color: '#2563eb', marginTop: '2px' }}>
                              Edited by {field.edited_by}
                            </div>
                          )}
                        </div>

                        {/* Value / editor */}
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
                                style={{ width: '100%', fontSize: '13px', padding: '6px 10px', borderRadius: '6px', border: '1px solid #7dd3fc', outline: 'none', resize: 'vertical', fontFamily: 'inherit' }}
                              />
                              <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                                <button
                                  onClick={e => { e.stopPropagation(); saveField(key, edits[key] ?? val) }}
                                  disabled={isSaving}
                                  style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: '#15803d', color: 'white', border: 'none', borderRadius: '5px', padding: '5px 12px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
                                >
                                  {isSaving ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={11} />}
                                  Save
                                </button>
                                <button
                                  onClick={e => { e.stopPropagation(); setEditingKey(null) }}
                                  style={{ background: 'none', border: '1px solid #e2e8f0', borderRadius: '5px', padding: '5px 12px', fontSize: '12px', color: '#64748b', cursor: 'pointer' }}
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: '14px', color: conf === 'low' ? '#94a3b8' : '#0f172a', fontStyle: conf === 'low' ? 'italic' : 'normal', lineHeight: '1.5' }}>
                                  {val || <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Not found — click to enter</span>}
                                </div>
                                {note && (
                                  <div style={{ fontSize: '12px', color: conf === 'medium' ? '#b45309' : '#dc2626', marginTop: '3px', lineHeight: '1.4' }}>
                                    {note}
                                  </div>
                                )}
                                {field?.original_value != null && (
                                  <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                                    Original: {String(field.original_value)}
                                  </div>
                                )}
                              </div>
                              {/* Edit pencil — always for yellow/red, hover only for green */}
                              <button
                                onClick={e => { e.stopPropagation(); setEditingKey(key); setEdits(p => ({ ...p, [key]: val })) }}
                                className={conf === 'high' || conf === 'human' ? 'edit-pencil-hover' : ''}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '2px', flexShrink: 0, opacity: needsAction ? 1 : undefined }}
                                title="Edit"
                              >
                                <Edit3 size={13} />
                              </button>
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
    </>
  )
}

function ModalAddressBanner({ siteAddress, leaseAddress, onAccept }: { siteAddress: string; leaseAddress: string; onAccept: () => Promise<void> }) {
  const [loading, setLoading] = useState(false)
  return (
    <div style={{ background: '#fefce8', border: '1px solid #fde68a', borderRadius: '8px', padding: '14px 16px', marginBottom: '20px', display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
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
        onClick={async () => { setLoading(true); await onAccept(); setLoading(false) }}
        disabled={loading}
        style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: '6px', background: loading ? '#e2e8f0' : '#92400e', color: loading ? '#94a3b8' : 'white', border: 'none', borderRadius: '6px', padding: '7px 14px', fontSize: '12px', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer' }}
      >
        {loading ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : null}
        {loading ? 'Saving…' : 'Accept Discrepancy'}
      </button>
    </div>
  )
}
