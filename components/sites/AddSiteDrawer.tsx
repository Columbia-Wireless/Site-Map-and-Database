'use client'

import { useState, useEffect, useCallback } from 'react'
import { X, CheckCircle, AlertCircle } from 'lucide-react'

interface OwnerOption { id: string; name: string }

interface FormData {
  site_code: string
  name: string
  address: string
  city: string
  state: string
  zip: string
  lat: string
  lng: string
  host_agency_id: string
  tower_type: string
  height_ft: string
  status: string
  notes: string
}

type FormErrors = Partial<Record<keyof FormData, string>>

const EMPTY: FormData = {
  site_code: '', name: '', address: '', city: '', state: '', zip: '',
  lat: '', lng: '', host_agency_id: '', tower_type: 'monopole',
  height_ft: '', status: 'operational', notes: '',
}

const REQUIRED: (keyof FormData)[] = ['site_code', 'name', 'address', 'city', 'state', 'zip', 'lat', 'lng']

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','DC','FL','GA','HI','ID','IL','IN',
  'IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH',
  'NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT',
  'VT','VA','WA','WV','WI','WY',
]

function validate(data: FormData): FormErrors {
  const errors: FormErrors = {}
  REQUIRED.forEach(field => {
    if (!data[field].trim()) errors[field] = 'This field is required'
  })
  if (data.lat && (isNaN(Number(data.lat)) || Number(data.lat) < -90 || Number(data.lat) > 90))
    errors.lat = 'Must be a valid latitude (−90 to 90)'
  if (data.lng && (isNaN(Number(data.lng)) || Number(data.lng) < -180 || Number(data.lng) > 180))
    errors.lng = 'Must be a valid longitude (−180 to 180)'
  if (data.height_ft && isNaN(Number(data.height_ft)))
    errors.height_ft = 'Must be a number'
  return errors
}

type SubmitState = 'idle' | 'saving' | 'success'

interface Props { open: boolean; onClose: () => void; onSaved: () => void; owners: OwnerOption[] }

export default function AddSiteDrawer({ open, onClose, onSaved, owners }: Props) {
  const [data, setData] = useState<FormData>(EMPTY)
  const [errors, setErrors] = useState<FormErrors>({})
  const [touched, setTouched] = useState<Partial<Record<keyof FormData, boolean>>>({})
  const [submitState, setSubmitState] = useState<SubmitState>('idle')
  const [savedCode, setSavedCode] = useState('')
  const [savedName, setSavedName] = useState('')

  useEffect(() => {
    if (open) { setData(EMPTY); setErrors({}); setTouched({}); setSubmitState('idle') }
  }, [open])

  const isDirty = useCallback(() =>
    Object.keys(data).some(k => data[k as keyof FormData] !== EMPTY[k as keyof FormData]), [data])

  function handleClose() {
    if (isDirty() && submitState !== 'success') {
      if (!window.confirm('You have unsaved changes. Are you sure you want to close?')) return
    }
    onClose()
  }

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
    const errs = validate(data)
    setErrors(prev => ({ ...prev, [field]: errs[field] }))
  }

  async function handleSubmit() {
    const allTouched = Object.keys(data).reduce((acc, k) => ({ ...acc, [k]: true }), {})
    setTouched(allTouched)
    const errs = validate(data)
    setErrors(errs)
    if (Object.keys(errs).length > 0) return

    setSubmitState('saving')
    try {
      const res = await fetch('/api/sites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          lat: Number(data.lat),
          lng: Number(data.lng),
          height_ft: data.height_ft ? Number(data.height_ft) : null,
          host_agency_id: data.host_agency_id || null,
        }),
      })
      if (!res.ok) throw new Error(await res.text())
      setSavedCode(data.site_code)
      setSavedName(data.name)
      setSubmitState('success')
      onSaved()
    } catch {
      setSubmitState('idle')
      alert('Save failed — please try again.')
    }
  }

  function handleAddAnother() {
    setData(EMPTY); setErrors({}); setTouched({}); setSubmitState('idle')
  }

  return (
    <>
      {open && (
        <div onClick={handleClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 40 }} />
      )}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: '520px',
        background: 'white', zIndex: 50,
        transform: open ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.25s ease',
        display: 'flex', flexDirection: 'column',
        boxShadow: '-4px 0 24px rgba(0,0,0,0.12)',
      }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#1a3a5c' }}>
          <div>
            <div style={{ color: 'white', fontWeight: 700, fontSize: '16px' }}>Add New Site</div>
            <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: '12px', marginTop: '2px' }}>
              Licenses are added from the site detail page after saving
            </div>
          </div>
          <button onClick={handleClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.7)', padding: '4px' }}>
            <X size={20} />
          </button>
        </div>

        {submitState === 'success' ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px', gap: '20px', textAlign: 'center' }}>
            <CheckCircle size={52} color="#16a34a" />
            <div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a', marginBottom: '6px' }}>Site saved successfully</div>
              <div style={{ fontSize: '14px', color: '#64748b' }}>{savedCode} — {savedName} has been added to the portfolio.</div>
              <div style={{ fontSize: '13px', color: '#94a3b8', marginTop: '8px' }}>Open the site to add licensee records.</div>
            </div>
            <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
              <button onClick={handleAddAnother} style={{ padding: '10px 20px', background: '#1a3a5c', color: 'white', border: 'none', borderRadius: '7px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>
                Add Another Site
              </button>
              <button onClick={onClose} style={{ padding: '10px 20px', background: 'white', color: '#1a3a5c', border: '1px solid #e2e8f0', borderRadius: '7px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>
                Back to Portfolio
              </button>
            </div>
          </div>
        ) : (
          <>
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
              <Section title="Site Identity">
                <Row>
                  <Field label="Site Code *" error={touched.site_code ? errors.site_code : undefined}>
                    <Input value={data.site_code} onChange={v => set('site_code', v)} onBlur={() => touch('site_code')} placeholder="CWF-0061" hasError={!!(touched.site_code && errors.site_code)} />
                  </Field>
                  <Field label="Status" error={undefined}>
                    <Select value={data.status} onChange={v => set('status', v)} options={[
                      { value: 'operational', label: 'Operational' },
                      { value: 'under_construction', label: 'Under Construction' },
                      { value: 'offline', label: 'Offline' },
                      { value: 'decommissioned', label: 'Decommissioned' },
                    ]} />
                  </Field>
                </Row>
                <Field label="Site Name *" error={touched.name ? errors.name : undefined} full>
                  <Input value={data.name} onChange={v => set('name', v)} onBlur={() => touch('name')} placeholder="e.g. Rockville Tower A" hasError={!!(touched.name && errors.name)} />
                </Field>
              </Section>

              <Section title="Location">
                <Field label="Street Address *" error={touched.address ? errors.address : undefined} full>
                  <Input value={data.address} onChange={v => set('address', v)} onBlur={() => touch('address')} placeholder="123 Tower Rd" hasError={!!(touched.address && errors.address)} />
                </Field>
                <Row>
                  <Field label="City *" error={touched.city ? errors.city : undefined}>
                    <Input value={data.city} onChange={v => set('city', v)} onBlur={() => touch('city')} placeholder="Rockville" hasError={!!(touched.city && errors.city)} />
                  </Field>
                  <Field label="State *" error={touched.state ? errors.state : undefined}>
                    <Select value={data.state} onChange={v => set('state', v)} options={[{ value: '', label: 'Select…' }, ...US_STATES.map(s => ({ value: s, label: s }))]} hasError={!!(touched.state && errors.state)} />
                  </Field>
                  <Field label="ZIP *" error={touched.zip ? errors.zip : undefined}>
                    <Input value={data.zip} onChange={v => set('zip', v)} onBlur={() => touch('zip')} placeholder="20850" hasError={!!(touched.zip && errors.zip)} />
                  </Field>
                </Row>
                <Row>
                  <Field label="Latitude *" error={touched.lat ? errors.lat : undefined}>
                    <Input value={data.lat} onChange={v => set('lat', v)} onBlur={() => touch('lat')} placeholder="39.0840" hasError={!!(touched.lat && errors.lat)} />
                  </Field>
                  <Field label="Longitude *" error={touched.lng ? errors.lng : undefined}>
                    <Input value={data.lng} onChange={v => set('lng', v)} onBlur={() => touch('lng')} placeholder="-77.1528" hasError={!!(touched.lng && errors.lng)} />
                  </Field>
                </Row>
              </Section>

              <Section title="Tower Details">
                <Row>
                  <Field label="Tower Type" error={undefined}>
                    <Select value={data.tower_type} onChange={v => set('tower_type', v)} options={[
                      { value: 'monopole', label: 'Monopole' },
                      { value: 'lattice', label: 'Lattice' },
                      { value: 'rooftop', label: 'Rooftop' },
                      { value: 'water_tower', label: 'Water Tower' },
                      { value: 'guyed', label: 'Guyed' },
                      { value: 'small_cell', label: 'Small Cell' },
                    ]} />
                  </Field>
                  <Field label="Height (ft)" error={touched.height_ft ? errors.height_ft : undefined}>
                    <Input value={data.height_ft} onChange={v => set('height_ft', v)} onBlur={() => touch('height_ft')} placeholder="180" hasError={!!(touched.height_ft && errors.height_ft)} />
                  </Field>
                </Row>
                <Field label="Host Agency" error={undefined} full>
                  <Select value={data.host_agency_id} onChange={v => set('host_agency_id', v)} options={[{ value: '', label: 'Select agency…' }, ...owners.map(o => ({ value: o.id, label: o.name }))]} />
                </Field>
              </Section>

              <Section title="Notes" last>
                <Field label="Notes" error={undefined} full>
                  <textarea
                    value={data.notes}
                    onChange={e => set('notes', e.target.value)}
                    rows={3}
                    placeholder="Any relevant notes about this site…"
                    style={{ width: '100%', padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '13px', resize: 'vertical', fontFamily: 'Arial, sans-serif', boxSizing: 'border-box', outline: 'none' }}
                  />
                </Field>
              </Section>
            </div>

            <div style={{ padding: '16px 24px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '10px', background: '#f8fafc' }}>
              <button onClick={handleClose} style={{ padding: '9px 18px', background: 'white', color: '#64748b', border: '1px solid #e2e8f0', borderRadius: '7px', fontSize: '14px', cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={handleSubmit} disabled={submitState === 'saving'} style={{ padding: '9px 22px', background: submitState === 'saving' ? '#94a3b8' : '#1a3a5c', color: 'white', border: 'none', borderRadius: '7px', fontSize: '14px', fontWeight: 600, cursor: submitState === 'saving' ? 'default' : 'pointer' }}>
                {submitState === 'saving' ? 'Saving…' : 'Save Site'}
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
function Field({ label, error, children, full }: { label: string; error?: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div style={{ flex: full ? '1 1 100%' : '1 1 0', minWidth: 0 }}>
      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '4px' }}>{label}</label>
      {children}
      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
          <AlertCircle size={11} color="#dc2626" />
          <span style={{ fontSize: '11px', color: '#dc2626' }}>{error}</span>
        </div>
      )}
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
function Select({ value, onChange, options, hasError }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; hasError?: boolean }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      style={{ width: '100%', padding: '8px 10px', border: `1px solid ${hasError ? '#dc2626' : '#e2e8f0'}`, borderRadius: '6px', fontSize: '13px', outline: 'none', background: hasError ? '#fff5f5' : 'white', cursor: 'pointer', boxSizing: 'border-box' }}
    >
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )
}
