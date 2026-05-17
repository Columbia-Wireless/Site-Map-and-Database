'use client'

import { useState, useEffect, useRef } from 'react'
import { X, CheckCircle, AlertCircle, FileText, Sparkles, Loader2, Upload } from 'lucide-react'
import { SiteTenancy } from '@/lib/types'

interface TenantOption { id: string; name: string }

interface SiteDoc { id: string; name: string; doc_type: string }

interface FormData {
  licensee_id: string
  contract_type: string
  invoice_method: string
  mount_type: string
  antenna_height_ft: string
  annual_rent: string
  escalation_rate: string
  license_start: string
  license_end: string
  status: string
  notes: string
  document_id: string
}

type FormErrors = Partial<Record<keyof FormData, string>>

function emptyForm(): FormData {
  return { licensee_id: '', contract_type: 'Base Agreement', invoice_method: 'None', mount_type: 'Primary', antenna_height_ft: '', annual_rent: '', escalation_rate: '3.0', license_start: '', license_end: '', status: 'active', notes: '', document_id: '' }
}

function validate(data: FormData): FormErrors {
  const errors: FormErrors = {}
  if (!data.licensee_id) errors.licensee_id = 'Please select a licensee'
  if (!data.annual_rent.trim()) errors.annual_rent = 'Annual rent is required'
  else if (isNaN(Number(data.annual_rent))) errors.annual_rent = 'Must be a number'
  if (!data.license_start) errors.license_start = 'License start is required'
  if (!data.license_end) errors.license_end = 'License end is required'
  if (data.license_start && data.license_end && data.license_start >= data.license_end)
    errors.license_end = 'License end must be after license start'
  if (data.antenna_height_ft && isNaN(Number(data.antenna_height_ft)))
    errors.antenna_height_ft = 'Must be a number'
  if (data.escalation_rate && isNaN(Number(data.escalation_rate)))
    errors.escalation_rate = 'Must be a number'
  return errors
}

interface Props {
  open: boolean
  onClose: () => void
  onSaved: () => void
  siteId: string
  tenants: TenantOption[]
  /** Pass existing tenancy to edit; omit for add mode */
  existing?: SiteTenancy & { tenants?: { name: string } }
}

export default function TenancyDrawer({ open, onClose, onSaved, siteId, tenants, existing }: Props) {
  const mode = existing ? 'edit' : 'add'
  const [data, setData] = useState<FormData>(emptyForm())
  const [errors, setErrors] = useState<FormErrors>({})
  const [touched, setTouched] = useState<Partial<Record<keyof FormData, boolean>>>({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [siteDocs, setSiteDocs] = useState<SiteDoc[]>([])
  const [extracting, setExtracting] = useState(false)
  const [extractMsg, setExtractMsg] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadMsg, setUploadMsg] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setSaved(false)
      setSaving(false)
      setErrors({})
      setTouched({})
      setExtractMsg(null)
      if (existing) {
        setData({
          licensee_id: existing.licensee_id,
          contract_type: existing.contract_type ?? 'Base Agreement',
          invoice_method: existing.invoice_method ?? 'None',
          mount_type: existing.mount_type,
          antenna_height_ft: existing.antenna_height_ft != null ? String(existing.antenna_height_ft) : '',
          annual_rent: String(existing.annual_rent),
          escalation_rate: String(existing.escalation_rate),
          license_start: existing.license_start,
          license_end: existing.license_end,
          status: existing.status,
          notes: existing.notes ?? '',
          document_id: existing.document_id ?? '',
        })
      } else {
        setData(emptyForm())
      }
      // Load site documents for the picker
      fetch(`/api/sites/${siteId}/documents`)
        .then(r => r.json())
        .then(docs => setSiteDocs(Array.isArray(docs) ? docs : []))
        .catch(() => setSiteDocs([]))
    }
  }, [open, existing, siteId])

  function set(field: keyof FormData, value: string) {
    const next = { ...data, [field]: value }
    setData(next)
    if (touched[field]) {
      const errs = validate(next)
      setErrors(prev => ({ ...prev, [field]: errs[field] }))
    }
  }

  function touch(field: keyof FormData) {
    setTouched(prev => ({ ...prev, [field]: true }))
    setErrors(prev => ({ ...prev, [field]: validate(data)[field] }))
  }

  async function handleExtract() {
    if (!data.document_id) return
    setExtracting(true)
    setExtractMsg(null)
    try {
      const res = await fetch(`/api/sites/${siteId}/documents/${data.document_id}/extract`, { method: 'POST' })
      const doc = await res.json()
      if (!res.ok) throw new Error(doc.error ?? 'Extraction failed')
      const t = doc.extracted_terms ?? {}

      const val = (field: string) => {
        const v = t[field]
        return v && typeof v === 'object' ? v.value : v
      }

      // Map extracted fields → form, only overwrite blank fields
      const updates: Partial<FormData> = {}
      const commDate = val('commencement_date')
      if (commDate && !data.license_start) updates.license_start = commDate

      const annualRent = val('annual_rent') ?? (val('monthly_rent') ? String(Number(val('monthly_rent')) * 12) : null)
      if (annualRent && !data.annual_rent) updates.annual_rent = String(annualRent)

      const esc = val('escalation_rate')
      if (esc && !data.escalation_rate) updates.escalation_rate = String(esc)

      const notes = val('notes')
      if (notes && !data.notes) updates.notes = String(notes)

      // Auto-set contract type from doc_type if available
      const selectedDoc = siteDocs.find(d => d.id === data.document_id)
      if (selectedDoc && !data.contract_type) {
        if (selectedDoc.doc_type === 'amendment') updates.contract_type = 'Amendment'
        else if (selectedDoc.doc_type === 'lease') updates.contract_type = 'Base Agreement'
      }

      setData(prev => ({ ...prev, ...updates }))
      setExtractMsg(`Extracted ${Object.keys(updates).length} field${Object.keys(updates).length !== 1 ? 's' : ''} from PDF`)
    } catch (err: any) {
      setExtractMsg(`Extraction failed: ${err.message}`)
    } finally {
      setExtracting(false)
    }
  }

  async function handleUploadAndExtract(file: File) {
    if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
      setUploadMsg('Please upload a PDF file')
      return
    }

    setUploading(true)
    setUploadMsg('Uploading PDF…')
    setExtractMsg(null)

    const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL  ?? 'https://vfntpdpneusqgcwxwkix.supabase.co'
    const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZmbnRwZHBuZXVzcWdjd3h3a2l4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5NTg2MzEsImV4cCI6MjA5MzUzNDYzMX0.kFZ6b2WKAl7GVsEQZeO33qcxhyBruQlTfW0eZfkcg1c'

    try {
      // 1. Upload PDF to storage
      const storagePath = `${siteId}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
      const storageRes = await fetch(
        `${SUPABASE_URL}/storage/v1/object/lease-documents/${storagePath}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${SUPABASE_ANON}`,
            'Content-Type': 'application/pdf',
            'x-upsert': 'false',
          },
          body: await file.arrayBuffer(),
        },
      )
      if (!storageRes.ok) {
        const txt = await storageRes.text().catch(() => '')
        throw new Error(`Storage upload failed (${storageRes.status})${txt ? ': ' + txt : ''}`)
      }

      setUploadMsg('Saving document…')

      // 2. Create document record
      const docRes = await fetch(`/api/sites/${siteId}/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file_name:    file.name,
          doc_type:     'lease',
          storage_path: storagePath,
          file_size_kb: Math.round(file.size / 1024),
        }),
      })
      if (!docRes.ok) {
        const j = await docRes.json().catch(() => ({}))
        throw new Error(j.error ?? 'Failed to save document record')
      }
      const doc = await docRes.json()

      // 3. Select this doc in the form and add it to the dropdown list
      setData(prev => ({ ...prev, document_id: doc.id }))
      setSiteDocs(prev => [{ id: doc.id, name: doc.name, doc_type: doc.doc_type }, ...prev])

      setUploadMsg('Extracting fields from PDF…')

      // 4. Auto-run AI extraction
      const extractRes = await fetch(`/api/sites/${siteId}/documents/${doc.id}/extract`, { method: 'POST' })
      const extracted = await extractRes.json()
      if (!extractRes.ok) throw new Error(extracted.error ?? 'Extraction failed')

      const t = extracted.extracted_terms ?? {}
      const val = (field: string) => {
        const v = t[field]
        return v && typeof v === 'object' ? v.value : v
      }

      const updates: Partial<FormData> = {}
      const commDate = val('commencement_date')
      if (commDate) updates.license_start = commDate

      const termDate = val('term_end_date') ?? val('expiration_date')
      if (termDate) updates.license_end = termDate

      const annualRent = val('annual_rent') ?? (val('monthly_rent') ? String(Number(val('monthly_rent')) * 12) : null)
      if (annualRent) updates.annual_rent = String(annualRent)

      const esc = val('escalation_rate')
      if (esc) updates.escalation_rate = String(esc)

      const notes = val('notes')
      if (notes && !data.notes) updates.notes = String(notes)

      setData(prev => ({ ...prev, ...updates }))
      setUploadMsg(null)
      const count = Object.keys(updates).length
      setExtractMsg(`✓ Extracted ${count} field${count !== 1 ? 's' : ''} from PDF`)
    } catch (err: any) {
      setUploadMsg(null)
      setExtractMsg(`Upload/extract failed: ${err.message}`)
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function handleSubmit() {
    const allTouched = Object.keys(data).reduce((a, k) => ({ ...a, [k]: true }), {})
    setTouched(allTouched)
    const errs = validate(data)
    setErrors(errs)
    if (Object.keys(errs).length > 0) return

    setSaving(true)
    try {
      const url = mode === 'add'
        ? `/api/sites/${siteId}/tenancies`
        : `/api/sites/${siteId}/tenancies/${existing!.id}`
      const method = mode === 'add' ? 'POST' : 'PATCH'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          annual_rent: Number(data.annual_rent),
          escalation_rate: Number(data.escalation_rate),
          antenna_height_ft: data.antenna_height_ft ? Number(data.antenna_height_ft) : null,
          document_id: data.document_id || null,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setSaved(true)
      onSaved()
      setTimeout(() => onClose(), 1200)
    } catch (err) {
      alert(`Save failed: ${err}`)
      setSaving(false)
    }
  }

  return (
    <>
      {open && (
        <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 40 }} />
      )}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: '480px',
        background: 'white', zIndex: 50,
        transform: open ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.25s ease',
        display: 'flex', flexDirection: 'column',
        boxShadow: '-4px 0 24px rgba(0,0,0,0.12)',
      }}>
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#1a3a5c' }}>
          <div>
            <div style={{ color: 'white', fontWeight: 700, fontSize: '16px' }}>
              {mode === 'add' ? 'Add License' : 'Edit License'}
            </div>
            <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: '12px', marginTop: '2px' }}>
              {mode === 'add' ? 'Add a licensee to this site' : `Editing ${existing?.licensees?.name ?? 'license'}`}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.7)', padding: '4px' }}>
            <X size={20} />
          </button>
        </div>

        {saved ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', padding: '40px', textAlign: 'center' }}>
            <CheckCircle size={48} color="#16a34a" />
            <div style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>
              {mode === 'add' ? 'License added!' : 'License updated!'}
            </div>
          </div>
        ) : (
          <>
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
              <Section title="Licensee & Mount Type">
                <Field label="Licensee *" error={touched.licensee_id ? errors.licensee_id : undefined} full>
                  <select
                    value={data.licensee_id}
                    onChange={e => set('licensee_id', e.target.value)}
                    onBlur={() => touch('licensee_id')}
                    style={{ width: '100%', padding: '8px 10px', border: `1px solid ${touched.licensee_id && errors.licensee_id ? '#dc2626' : '#e2e8f0'}`, borderRadius: '6px', fontSize: '13px', outline: 'none', background: touched.licensee_id && errors.licensee_id ? '#fff5f5' : 'white', cursor: 'pointer', boxSizing: 'border-box' }}
                  >
                    <option value="">Select licensee…</option>
                    {tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                  {touched.licensee_id && errors.licensee_id && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                      <AlertCircle size={11} color="#dc2626" />
                      <span style={{ fontSize: '11px', color: '#dc2626' }}>{errors.licensee_id}</span>
                    </div>
                  )}
                </Field>
                <Row>
                  <Field label="Mount Type" error={undefined}>
                    <Input value={data.mount_type} onChange={v => set('mount_type', v)} placeholder="Primary / Top / Sector A" />
                  </Field>
                  <Field label="Antenna Height (ft)" error={touched.antenna_height_ft ? errors.antenna_height_ft : undefined}>
                    <Input value={data.antenna_height_ft} onChange={v => set('antenna_height_ft', v)} onBlur={() => touch('antenna_height_ft')} placeholder="150" hasError={!!(touched.antenna_height_ft && errors.antenna_height_ft)} />
                  </Field>
                </Row>
              </Section>

              <Section title="Contract & Billing">
                <Row>
                  <Field label="Contract Type" error={undefined}>
                    <select
                      value={data.contract_type}
                      onChange={e => set('contract_type', e.target.value)}
                      style={{ width: '100%', padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '13px', outline: 'none', background: 'white', cursor: 'pointer', boxSizing: 'border-box' }}
                    >
                      {['Base Agreement','Amendment','Addendum','Renewal','Extension','Termination Notice','Settlement'].map(v => (
                        <option key={v} value={v}>{v}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Invoice Method" error={undefined}>
                    <select
                      value={data.invoice_method}
                      onChange={e => set('invoice_method', e.target.value)}
                      style={{ width: '100%', padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '13px', outline: 'none', background: 'white', cursor: 'pointer', boxSizing: 'border-box' }}
                    >
                      {['None','Email','Snail Mail','Ops Account','Monitored Account'].map(v => (
                        <option key={v} value={v}>{v}</option>
                      ))}
                    </select>
                  </Field>
                </Row>
              </Section>

              <Section title="License Terms">
                <Row>
                  <Field label="License Start *" error={touched.license_start ? errors.license_start : undefined}>
                    <Input type="date" value={data.license_start} onChange={v => set('license_start', v)} onBlur={() => touch('license_start')} hasError={!!(touched.license_start && errors.license_start)} />
                  </Field>
                  <Field label="License End *" error={touched.license_end ? errors.license_end : undefined}>
                    <Input type="date" value={data.license_end} onChange={v => { set('license_end', v); touch('license_end') }} onBlur={() => touch('license_end')} hasError={!!(touched.license_end && errors.license_end)} />
                  </Field>
                </Row>
                <Row>
                  <Field label="Annual Rent ($) *" error={touched.annual_rent ? errors.annual_rent : undefined}>
                    <Input value={data.annual_rent} onChange={v => set('annual_rent', v)} onBlur={() => touch('annual_rent')} placeholder="36000" hasError={!!(touched.annual_rent && errors.annual_rent)} />
                  </Field>
                  <Field label="Escalation Rate (%)" error={touched.escalation_rate ? errors.escalation_rate : undefined}>
                    <Input value={data.escalation_rate} onChange={v => set('escalation_rate', v)} onBlur={() => touch('escalation_rate')} placeholder="3.0" hasError={!!(touched.escalation_rate && errors.escalation_rate)} />
                  </Field>
                </Row>
                <Field label="Status" error={undefined}>
                  <select
                    value={data.status}
                    onChange={e => set('status', e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '13px', outline: 'none', background: 'white', cursor: 'pointer', boxSizing: 'border-box' }}
                  >
                    <option value="active">Active</option>
                    <option value="pending">Pending</option>
                    <option value="expiring_soon">Expiring Soon</option>
                    <option value="expired">Expired</option>
                    <option value="terminated">Terminated</option>
                  </select>
                </Field>
              </Section>

              <Section title="Linked Document">
                {/* Hidden file input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,application/pdf"
                  style={{ display: 'none' }}
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleUploadAndExtract(f) }}
                />

                {/* Primary action: upload & auto-extract */}
                <div
                  onClick={() => !uploading && !extracting && fileInputRef.current?.click()}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                    padding: '14px', border: `2px dashed ${uploading || extracting ? '#cbd5e1' : '#93c5fd'}`,
                    borderRadius: '8px', cursor: uploading || extracting ? 'default' : 'pointer',
                    background: uploading || extracting ? '#f8fafc' : '#eff6ff',
                    transition: 'all 0.15s',
                  }}
                >
                  {uploading ? (
                    <Loader2 size={16} color="#3b82f6" style={{ animation: 'spin 1s linear infinite', flexShrink: 0 }} />
                  ) : (
                    <Upload size={16} color="#2563eb" style={{ flexShrink: 0 }} />
                  )}
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#1d4ed8' }}>
                      {uploading ? (uploadMsg ?? 'Working…') : 'Upload PDF & Auto-extract'}
                    </div>
                    {!uploading && (
                      <div style={{ fontSize: '11px', color: '#64748b', marginTop: '1px' }}>
                        AI reads the contract and fills in the fields below automatically
                      </div>
                    )}
                  </div>
                </div>

                {/* Feedback message */}
                {extractMsg && (
                  <div style={{ fontSize: '12px', fontWeight: 500, color: extractMsg.startsWith('✓') ? '#15803d' : '#dc2626', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    {extractMsg}
                  </div>
                )}

                {/* Fallback: pick from already-uploaded docs */}
                <div>
                  <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '5px' }}>
                    Or link an existing document:
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <select
                      value={data.document_id}
                      onChange={e => { set('document_id', e.target.value); setExtractMsg(null) }}
                      style={{ flex: 1, padding: '7px 10px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '13px', outline: 'none', background: 'white', cursor: 'pointer' }}
                    >
                      <option value="">— none —</option>
                      {siteDocs.map(d => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                    {data.document_id && (
                      <button
                        type="button"
                        onClick={handleExtract}
                        disabled={extracting || uploading}
                        title="Extract fields from the selected document"
                        style={{
                          display: 'flex', alignItems: 'center', gap: '5px',
                          padding: '7px 12px', borderRadius: '6px', border: 'none',
                          cursor: extracting || uploading ? 'default' : 'pointer',
                          background: extracting ? '#f1f5f9' : '#eff6ff',
                          color: extracting ? '#94a3b8' : '#1d4ed8',
                          fontSize: '12px', fontWeight: 600, whiteSpace: 'nowrap',
                        }}
                      >
                        {extracting
                          ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />
                          : <Sparkles size={12} />}
                        {extracting ? 'Extracting…' : 'Extract'}
                      </button>
                    )}
                  </div>
                </div>
              </Section>

              <Section title="Notes" last>
                <Field label="Notes" error={undefined} full>
                  <textarea
                    value={data.notes}
                    onChange={e => set('notes', e.target.value)}
                    rows={3}
                    placeholder="Any notes about this license…"
                    style={{ width: '100%', padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '13px', resize: 'vertical', fontFamily: 'Arial, sans-serif', boxSizing: 'border-box', outline: 'none' }}
                  />
                </Field>
              </Section>
            </div>

            <div style={{ padding: '16px 24px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '10px', background: '#f8fafc' }}>
              <button onClick={onClose} style={{ padding: '9px 18px', background: 'white', color: '#64748b', border: '1px solid #e2e8f0', borderRadius: '7px', fontSize: '14px', cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={handleSubmit} disabled={saving} style={{ padding: '9px 22px', background: saving ? '#94a3b8' : '#1a3a5c', color: 'white', border: 'none', borderRadius: '7px', fontSize: '14px', fontWeight: 600, cursor: saving ? 'default' : 'pointer' }}>
                {saving ? 'Saving…' : mode === 'add' ? 'Add License' : 'Save Changes'}
              </button>
            </div>
          </>
        )}
      </div>
    </>
  )
}

function Section({ title, children, last }: { title: string; children: React.ReactNode; last?: boolean }) {
  return (
    <div style={{ marginBottom: last ? 0 : '24px' }}>
      <div style={{ fontSize: '11px', fontWeight: 700, color: '#1a3a5c', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '12px', paddingBottom: '6px', borderBottom: '1px solid #e2e8f0' }}>
        {title}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>{children}</div>
    </div>
  )
}
function Row({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'flex', gap: '10px' }}>{children}</div>
}
function Field({ label, children, full }: { label: string; error?: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div style={{ flex: full ? '1 1 100%' : '1 1 0', minWidth: 0 }}>
      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '4px' }}>{label}</label>
      {children}
    </div>
  )
}
function Input({ value, onChange, onBlur, placeholder, type = 'text', hasError }: { value: string; onChange: (v: string) => void; onBlur?: () => void; placeholder?: string; type?: string; hasError?: boolean }) {
  return (
    <input type={type} value={value} onChange={e => onChange(e.target.value)} onBlur={onBlur} placeholder={placeholder}
      style={{ width: '100%', padding: '8px 10px', border: `1px solid ${hasError ? '#dc2626' : '#e2e8f0'}`, borderRadius: '6px', fontSize: '13px', outline: 'none', background: hasError ? '#fff5f5' : 'white', boxSizing: 'border-box' }}
    />
  )
}
