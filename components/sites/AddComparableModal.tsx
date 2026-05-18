'use client'

import { useState, useRef, useCallback } from 'react'
import { X, Upload, FileText, CheckCircle2, AlertCircle, Loader2, Plus } from 'lucide-react'

const TOWER_TYPES = ['monopole', 'lattice', 'rooftop', 'water_tower', 'guyed', 'small_cell']
const TOWER_LABELS: Record<string, string> = {
  monopole: 'Monopole', lattice: 'Lattice', rooftop: 'Rooftop',
  water_tower: 'Water Tower', guyed: 'Guyed', small_cell: 'Small Cell',
}

type Confidence = 'high' | 'medium' | 'low' | 'none'

interface FieldState {
  value: string
  confidence: Confidence
}

type Fields = Record<string, FieldState>

const FIELD_DEFS = [
  { key: 'site_name',      label: 'Site Name',      type: 'text',   required: true  },
  { key: 'city',           label: 'City',            type: 'text',   required: true  },
  { key: 'state',          label: 'State',           type: 'text',   required: true  },
  { key: 'tower_type',     label: 'Tower Type',      type: 'select', required: true  },
  { key: 'annual_rent',    label: 'Annual Rent ($)', type: 'number', required: true  },
  { key: 'height_ft',      label: 'Height (ft)',     type: 'number', required: false },
  { key: 'active_tenants', label: 'Active Tenants',  type: 'number', required: false },
  { key: 'tenant_slots',   label: 'Tenant Slots',    type: 'number', required: false },
  { key: 'distance_miles', label: 'Distance (mi)',   type: 'number', required: false },
  { key: 'notes',          label: 'Notes',           type: 'text',   required: false },
]

const KEY_FIELDS = ['site_name', 'city', 'state', 'tower_type', 'annual_rent']

function emptyFields(): Fields {
  return Object.fromEntries(FIELD_DEFS.map(f => [f.key, { value: '', confidence: 'none' as Confidence }]))
}

function calcCompleteness(fields: Fields): number {
  let score = 0
  for (const key of KEY_FIELDS) {
    const { value, confidence } = fields[key]
    if (value.trim()) score += confidence === 'high' ? 20 : confidence === 'medium' ? 12 : 8
  }
  return Math.min(100, score)
}

function TrafficLight({ confidence, value }: { confidence: Confidence; value: string }) {
  const filled = value.trim().length > 0
  if (!filled) return <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#e2e8f0', display: 'inline-block', flexShrink: 0 }} />
  const color = confidence === 'high' ? '#16a34a' : confidence === 'medium' ? '#d97706' : '#dc2626'
  const title = confidence === 'high' ? 'High confidence' : confidence === 'medium' ? 'Medium confidence' : 'Low confidence / verify'
  return <span title={title} style={{ width: '10px', height: '10px', borderRadius: '50%', background: color, display: 'inline-block', flexShrink: 0, boxShadow: `0 0 0 2px ${color}33` }} />
}

function CompletenessBar({ pct }: { pct: number }) {
  const color = pct >= 80 ? '#16a34a' : pct >= 40 ? '#d97706' : '#dc2626'
  const label = pct >= 80 ? 'Good' : pct >= 40 ? 'Partial' : 'Incomplete'
  return (
    <div style={{ marginBottom: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
        <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>Completeness</span>
        <span style={{ fontSize: '12px', fontWeight: 700, color }}>{pct}% — {label}</span>
      </div>
      <div style={{ height: '7px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: '4px', transition: 'width 0.4s, background 0.4s' }} />
      </div>
      <div style={{ display: 'flex', gap: '12px', marginTop: '6px' }}>
        {[{ color: '#16a34a', label: 'High confidence' }, { color: '#d97706', label: 'Medium' }, { color: '#dc2626', label: 'Low / verify' }, { color: '#e2e8f0', label: 'Not provided' }].map(({ color: c, label }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#94a3b8' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: c, display: 'inline-block' }} />
            {label}
          </div>
        ))}
      </div>
    </div>
  )
}

interface Props {
  siteId: string
  onClose: () => void
  onSaved: () => void
}

export default function AddComparableModal({ siteId, onClose, onSaved }: Props) {
  const [tab, setTab]             = useState<'pdf' | 'manual'>('pdf')
  const [fields, setFields]       = useState<Fields>(emptyFields())
  const [dragOver, setDragOver]   = useState(false)
  const [extracting, setExtracting] = useState(false)
  const [extractError, setExtractError] = useState('')
  const [filename, setFilename]   = useState('')
  const [saving, setSaving]       = useState(false)
  const [saveError, setSaveError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const completeness = calcCompleteness(fields)

  function setFieldValue(key: string, value: string) {
    setFields(f => ({
      ...f,
      [key]: { ...f[key], value, confidence: f[key].confidence === 'none' ? 'high' : f[key].confidence },
    }))
  }

  function setFieldConfidence(key: string, confidence: Confidence) {
    setFields(f => ({ ...f, [key]: { ...f[key], confidence } }))
  }

  const extractFromPDF = useCallback(async (file: File) => {
    if (!file.type.includes('pdf')) { setExtractError('Please upload a PDF file'); return }
    setExtracting(true); setExtractError(''); setFilename(file.name)
    const form = new FormData(); form.append('file', file)
    const res = await fetch(`/api/sites/${siteId}/comparables/extract`, { method: 'POST', body: form })
    const data = await res.json()
    setExtracting(false)
    if (!res.ok) { setExtractError(data.error ?? 'Extraction failed'); return }

    const newFields = { ...emptyFields() }
    for (const key of Object.keys(newFields)) {
      const v = data.values?.[key]
      const c = data.confidence?.[key] ?? 'low'
      if (v != null) newFields[key] = { value: String(v), confidence: c }
    }
    setFields(newFields)
    setTab('manual') // switch to review form
  }, [siteId])

  function onFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) extractFromPDF(file)
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault(); setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) extractFromPDF(file)
  }

  async function save(approve: boolean) {
    const missing = FIELD_DEFS.filter(f => f.required && !fields[f.key].value.trim()).map(f => f.label)
    if (missing.length) { setSaveError(`Required: ${missing.join(', ')}`); return }
    setSaving(true); setSaveError('')

    const body: Record<string, any> = {
      source: filename ? 'pdf' : 'manual',
      pdf_filename: filename || null,
      approve,
      completeness_pct: completeness,
      confidence: Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, v.confidence])),
      raw_extracted: filename ? Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, v.value])) : null,
    }
    for (const { key, type } of FIELD_DEFS) {
      const raw = fields[key].value.trim()
      if (!raw) { body[key] = null; continue }
      body[key] = type === 'number' ? Number(raw) : raw
    }
    // Recalculate occupancy_pct
    if (body.active_tenants != null && body.tenant_slots != null && body.tenant_slots > 0) {
      body.occupancy_pct = Math.round((body.active_tenants / body.tenant_slots) * 100)
    }

    const res = await fetch(`/api/sites/${siteId}/comparables/external`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) { setSaveError(data.error ?? 'Failed to save'); return }
    onSaved()
  }

  const inputStyle = {
    width: '100%', padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: '7px',
    fontSize: '13px', outline: 'none', background: 'white', boxSizing: 'border-box' as const,
  }

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 9998, background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: 'white', borderRadius: '14px', width: '100%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,0.3)' }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid #f1f5f9' }}>
          <div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>Add External Comparable</div>
            <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>Upload a PDF lease or enter details manually</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={20} /></button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '4px', padding: '12px 24px 0' }}>
          {([['pdf', 'Upload PDF'], ['manual', 'Manual Entry']] as const).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              style={{
                padding: '8px 16px', borderRadius: '7px', border: 'none', cursor: 'pointer',
                fontSize: '13px', fontWeight: 600,
                background: tab === id ? '#1a3a5c' : 'transparent',
                color: tab === id ? 'white' : '#64748b',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        <div style={{ padding: '20px 24px 24px' }}>
          {/* PDF Upload tab */}
          {tab === 'pdf' && (
            <div>
              <div
                onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
                onClick={() => fileRef.current?.click()}
                style={{
                  border: `2px dashed ${dragOver ? '#2563eb' : '#e2e8f0'}`,
                  borderRadius: '12px', padding: '48px 24px', textAlign: 'center',
                  background: dragOver ? '#eff6ff' : '#fafafa', cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                <input ref={fileRef} type="file" accept=".pdf" onChange={onFileInput} style={{ display: 'none' }} />
                {extracting ? (
                  <div>
                    <Loader2 size={32} color="#2563eb" style={{ margin: '0 auto 12px', animation: 'spin 1s linear infinite' }} />
                    <div style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a' }}>Extracting data…</div>
                    <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>Claude is reading the document</div>
                  </div>
                ) : (
                  <div>
                    <Upload size={32} color="#94a3b8" style={{ margin: '0 auto 12px' }} />
                    <div style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a' }}>Drop a PDF here or click to browse</div>
                    <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>Lease agreements, appraisals, rent schedules</div>
                  </div>
                )}
              </div>
              {extractError && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '7px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '10px 14px', marginTop: '12px', fontSize: '13px', color: '#b91c1c' }}>
                  <AlertCircle size={14} /> {extractError}
                </div>
              )}
              {filename && !extracting && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '8px', padding: '10px 14px', marginTop: '12px', fontSize: '13px', color: '#15803d' }}>
                  <CheckCircle2 size={14} /> Extracted from <strong>{filename}</strong> — review fields in Manual Entry tab
                </div>
              )}
            </div>
          )}

          {/* Manual entry / review tab */}
          {tab === 'manual' && (
            <div>
              {filename && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px', fontSize: '12px', color: '#1d4ed8' }}>
                  <FileText size={13} /> Pre-filled from <strong>{filename}</strong> — review and correct as needed
                </div>
              )}

              <CompletenessBar pct={completeness} />

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                {FIELD_DEFS.map(({ key, label, type, required }) => (
                  <div key={key} style={{ gridColumn: key === 'notes' ? 'span 2' : undefined }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 600, color: '#64748b', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      <TrafficLight confidence={fields[key].confidence} value={fields[key].value} />
                      {label}{required && <span style={{ color: '#dc2626' }}>*</span>}
                    </label>
                    {type === 'select' ? (
                      <select
                        value={fields[key].value}
                        onChange={e => setFieldValue(key, e.target.value)}
                        style={inputStyle}
                      >
                        <option value="">— select —</option>
                        {TOWER_TYPES.map(t => <option key={t} value={t}>{TOWER_LABELS[t]}</option>)}
                      </select>
                    ) : (
                      <input
                        type={type === 'number' ? 'number' : 'text'}
                        value={fields[key].value}
                        onChange={e => setFieldValue(key, e.target.value)}
                        placeholder={key === 'state' ? 'e.g. SC' : key === 'distance_miles' ? 'miles from this site' : ''}
                        style={inputStyle}
                      />
                    )}
                    {/* Confidence override for non-empty fields */}
                    {fields[key].value.trim() && filename && (
                      <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
                        {(['high', 'medium', 'low'] as Confidence[]).map(c => (
                          <button
                            key={c}
                            onClick={() => setFieldConfidence(key, c)}
                            style={{
                              padding: '2px 7px', borderRadius: '10px', border: 'none', cursor: 'pointer', fontSize: '10px', fontWeight: 600,
                              background: fields[key].confidence === c ? (c === 'high' ? '#dcfce7' : c === 'medium' ? '#fef3c7' : '#fee2e2') : '#f1f5f9',
                              color: fields[key].confidence === c ? (c === 'high' ? '#15803d' : c === 'medium' ? '#92400e' : '#b91c1c') : '#94a3b8',
                            }}
                          >
                            {c}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {saveError && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '7px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '10px 14px', marginTop: '16px', fontSize: '13px', color: '#b91c1c' }}>
                  <AlertCircle size={14} /> {saveError}
                </div>
              )}

              <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                <button
                  onClick={() => save(true)}
                  disabled={saving}
                  style={{ display: 'flex', alignItems: 'center', gap: '7px', background: '#16a34a', color: 'white', border: 'none', borderRadius: '8px', padding: '10px 18px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}
                >
                  {saving ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <CheckCircle2 size={14} />}
                  Approve & Save
                </button>
                <button
                  onClick={() => save(false)}
                  disabled={saving}
                  style={{ display: 'flex', alignItems: 'center', gap: '7px', background: 'white', color: '#475569', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 18px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
                >
                  <Plus size={14} /> Save as Draft
                </button>
                <button onClick={onClose} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#94a3b8', fontSize: '13px', cursor: 'pointer' }}>Cancel</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
