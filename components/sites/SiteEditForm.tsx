'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, CheckCircle } from 'lucide-react'

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','DC','FL','GA','HI','ID','IL','IN',
  'IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH',
  'NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT',
  'VT','VA','WA','WV','WI','WY',
]

const TOWER_TYPES = [
  { value: 'monopole',    label: 'Monopole' },
  { value: 'lattice',     label: 'Lattice' },
  { value: 'guyed',       label: 'Guyed' },
  { value: 'rooftop',     label: 'Rooftop' },
  { value: 'stealth',     label: 'Stealth' },
  { value: 'small_cell',  label: 'Small Cell' },
  { value: 'water_tower', label: 'Water Tower' },
  { value: 'other',       label: 'Other' },
]

const STATUSES = [
  { value: 'operational',        label: 'Operational' },
  { value: 'offline',            label: 'Offline' },
  { value: 'under_construction', label: 'Under Construction' },
  { value: 'decommissioned',     label: 'Decommissioned' },
]

interface Agency { id: string; name: string }

interface FormData {
  site_code: string; name: string; address: string; city: string
  state: string; zip: string; lat: string; lng: string
  host_agency_id: string; tower_type: string; height_ft: string
  tenant_slots: string; status: string; notes: string
}

interface Props {
  siteId: string
  initial: Partial<FormData>
  agencies: Agency[]
}

export default function SiteEditForm({ siteId, initial, agencies }: Props) {
  const router = useRouter()
  const [data, setData] = useState<FormData>({
    site_code:      initial.site_code      ?? '',
    name:           initial.name           ?? '',
    address:        initial.address        ?? '',
    city:           initial.city           ?? '',
    state:          initial.state          ?? '',
    zip:            initial.zip            ?? '',
    lat:            initial.lat            ?? '',
    lng:            initial.lng            ?? '',
    host_agency_id: initial.host_agency_id ?? '',
    tower_type:     initial.tower_type     ?? '',
    height_ft:      initial.height_ft      ?? '',
    tenant_slots:   initial.tenant_slots   ?? '',
    status:         initial.status         ?? 'operational',
    notes:          initial.notes          ?? '',
  })
  const [errors, setErrors]   = useState<Partial<Record<keyof FormData, string>>>({})
  const [touched, setTouched] = useState<Partial<Record<keyof FormData, boolean>>>({})
  const [saving, setSaving]   = useState(false)
  const [saved, setSaved]     = useState(false)

  function set(field: keyof FormData, value: string) {
    setData(prev => ({ ...prev, [field]: value }))
    if (touched[field]) validate({ ...data, [field]: value }, field)
  }

  function touch(field: keyof FormData) {
    setTouched(prev => ({ ...prev, [field]: true }))
    validate(data, field)
  }

  function validate(d: FormData, field?: keyof FormData) {
    const errs: Partial<Record<keyof FormData, string>> = {}
    if (!d.site_code.trim()) errs.site_code = 'Site code is required'
    if (!d.name.trim())      errs.name      = 'Site name is required'
    if (d.lat && isNaN(Number(d.lat))) errs.lat = 'Must be a number'
    if (d.lng && isNaN(Number(d.lng))) errs.lng = 'Must be a number'
    if (field) {
      setErrors(prev => ({ ...prev, [field]: errs[field] }))
    } else {
      setErrors(errs)
    }
    return errs
  }

  async function handleSubmit() {
    setTouched(Object.keys(data).reduce((a, k) => ({ ...a, [k]: true }), {}))
    const errs = validate(data)
    if (Object.keys(errs).length > 0) return

    setSaving(true)
    try {
      const res = await fetch(`/api/sites/${siteId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setSaved(true)
      router.refresh()
      setTimeout(() => router.push(`/sites/${siteId}`), 1200)
    } catch (err) {
      alert(`Save failed: ${err}`)
      setSaving(false)
    }
  }

  return (
    <div style={{ maxWidth: '760px' }}>
      {saved && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '8px', padding: '12px 16px', marginBottom: '24px' }}>
          <CheckCircle size={18} color="#16a34a" />
          <span style={{ fontSize: '14px', color: '#15803d', fontWeight: 500 }}>Site saved — redirecting…</span>
        </div>
      )}

      <Section title="Site Identity">
        <Row>
          <Field label="Site Code *" error={touched.site_code ? errors.site_code : undefined}>
            <Input value={data.site_code} onChange={v => set('site_code', v)} onBlur={() => touch('site_code')} placeholder="SC0001" hasError={!!(touched.site_code && errors.site_code)} />
          </Field>
          <Field label="Status">
            <Select value={data.status} onChange={v => set('status', v)} options={STATUSES} />
          </Field>
        </Row>
        <Field label="Site Name *" error={touched.name ? errors.name : undefined} full>
          <Input value={data.name} onChange={v => set('name', v)} onBlur={() => touch('name')} placeholder="SCETV Columbia Tower" hasError={!!(touched.name && errors.name)} />
        </Field>
        <Row>
          <Field label="Tower Type">
            <Select value={data.tower_type} onChange={v => set('tower_type', v)} options={[{ value: '', label: 'Select…' }, ...TOWER_TYPES]} />
          </Field>
          <Field label="Height (ft)">
            <Input value={data.height_ft} onChange={v => set('height_ft', v)} placeholder="200" />
          </Field>
          <Field label="Tenant Slots (capacity)">
            <Input value={data.tenant_slots} onChange={v => set('tenant_slots', v)} placeholder="4" />
          </Field>
        </Row>
        <Field label="Host Agency" full>
          <Select value={data.host_agency_id} onChange={v => set('host_agency_id', v)}
            options={[{ value: '', label: 'None' }, ...agencies.map(a => ({ value: a.id, label: a.name }))]} />
        </Field>
      </Section>

      <Section title="Location">
        <Field label="Street Address" full>
          <Input value={data.address} onChange={v => set('address', v)} placeholder="123 Main St" />
        </Field>
        <Row>
          <Field label="City">
            <Input value={data.city} onChange={v => set('city', v)} placeholder="Columbia" />
          </Field>
          <Field label="State">
            <Select value={data.state} onChange={v => set('state', v)}
              options={[{ value: '', label: 'Select…' }, ...US_STATES.map(s => ({ value: s, label: s }))]} />
          </Field>
          <Field label="ZIP">
            <Input value={data.zip} onChange={v => set('zip', v)} placeholder="29201" />
          </Field>
        </Row>
        <Row>
          <Field label="Latitude" error={touched.lat ? errors.lat : undefined}>
            <Input value={data.lat} onChange={v => set('lat', v)} onBlur={() => touch('lat')} placeholder="33.9969" hasError={!!(touched.lat && errors.lat)} />
          </Field>
          <Field label="Longitude" error={touched.lng ? errors.lng : undefined}>
            <Input value={data.lng} onChange={v => set('lng', v)} onBlur={() => touch('lng')} placeholder="-81.0314" hasError={!!(touched.lng && errors.lng)} />
          </Field>
        </Row>
      </Section>

      <Section title="Notes" last>
        <textarea value={data.notes} onChange={e => set('notes', e.target.value)} rows={4}
          placeholder="Any relevant notes about this site…"
          style={{ width: '100%', padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '13px', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none' }}
        />
      </Section>

      <div style={{ display: 'flex', gap: '12px', marginTop: '32px', paddingTop: '24px', borderTop: '1px solid #e2e8f0' }}>
        <button onClick={handleSubmit} disabled={saving || saved}
          style={{ padding: '10px 24px', background: saving || saved ? '#94a3b8' : '#1a3a5c', color: 'white', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: saving || saved ? 'default' : 'pointer' }}>
          {saving ? 'Saving…' : saved ? 'Saved!' : 'Save Changes'}
        </button>
        <button onClick={() => router.back()}
          style={{ padding: '10px 20px', background: 'white', color: '#64748b', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '14px', cursor: 'pointer' }}>
          Cancel
        </button>
      </div>
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Section({ title, children, last }: { title: string; children: React.ReactNode; last?: boolean }) {
  return (
    <div style={{ marginBottom: last ? 0 : '28px' }}>
      <div style={{ fontSize: '11px', fontWeight: 700, color: '#1a3a5c', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '14px', paddingBottom: '8px', borderBottom: '1px solid #e2e8f0' }}>
        {title}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>{children}</div>
    </div>
  )
}

function Row({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'flex', gap: '12px' }}>{children}</div>
}

function Field({ label, error, children, full }: { label: string; error?: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div style={{ flex: full ? '1 1 100%' : '1 1 0', minWidth: 0 }}>
      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '5px' }}>{label}</label>
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

function Input({ value, onChange, onBlur, placeholder, hasError }: {
  value: string; onChange: (v: string) => void; onBlur?: () => void; placeholder?: string; hasError?: boolean
}) {
  return (
    <input value={value} onChange={e => onChange(e.target.value)} onBlur={onBlur} placeholder={placeholder}
      style={{ width: '100%', padding: '8px 10px', border: `1px solid ${hasError ? '#dc2626' : '#e2e8f0'}`, borderRadius: '6px', fontSize: '13px', outline: 'none', background: hasError ? '#fff5f5' : 'white', boxSizing: 'border-box' }}
    />
  )
}

function Select({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      style={{ width: '100%', padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '13px', outline: 'none', background: 'white', cursor: 'pointer', boxSizing: 'border-box' }}>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )
}
