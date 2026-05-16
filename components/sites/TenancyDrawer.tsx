'use client'

import { useState, useEffect } from 'react'
import { X, CheckCircle, AlertCircle } from 'lucide-react'
import { SiteTenancy } from '@/lib/types'

interface TenantOption { id: string; name: string }

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
}

type FormErrors = Partial<Record<keyof FormData, string>>

function emptyForm(): FormData {
  return { licensee_id: '', contract_type: 'Base Agreement', invoice_method: 'None', mount_type: 'Primary', antenna_height_ft: '', annual_rent: '', escalation_rate: '3.0', license_start: '', license_end: '', status: 'active', notes: '' }
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

  useEffect(() => {
    if (open) {
      setSaved(false)
      setSaving(false)
      setErrors({})
      setTouched({})
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
        })
      } else {
        setData(emptyForm())
      }
    }
  }, [open, existing])

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
