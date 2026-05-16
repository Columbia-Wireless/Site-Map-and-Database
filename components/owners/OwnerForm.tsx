'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, CheckCircle } from 'lucide-react'
import { SiteOwner, OwnerType } from '@/lib/types'

type FormData = Omit<SiteOwner, 'id' | 'created_at' | 'updated_at'>
type FormErrors = Partial<Record<keyof FormData, string>>

const OWNER_TYPES: { value: OwnerType; label: string }[] = [
  { value: 'corporate', label: 'Corporate / Private Equity' },
  { value: 'municipality', label: 'Municipality / Local Government' },
  { value: 'state', label: 'State Government' },
  { value: 'federal', label: 'Federal Government' },
  { value: 'utility', label: 'Utility Company' },
  { value: 'private', label: 'Private Individual' },
  { value: 'nonprofit', label: 'Nonprofit Organization' },
  { value: 'other', label: 'Other' },
]

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','DC','FL','GA','HI','ID','IL','IN',
  'IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH',
  'NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT',
  'VT','VA','WA','WV','WI','WY',
]

const EMPTY: FormData = {
  name: '', type: 'corporate', status: 'active',
  contact_name: '', contact_email: '', contact_phone: '',
  address: '', city: '', state: '', zip: '', notes: '',
}

function validate(data: FormData): FormErrors {
  const errors: FormErrors = {}
  if (!data.name.trim()) errors.name = 'Owner name is required'
  if (data.contact_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.contact_email))
    errors.contact_email = 'Must be a valid email address'
  return errors
}

interface Props {
  initial?: Partial<FormData>
  ownerId?: string
  mode: 'add' | 'edit'
}

export default function OwnerForm({ initial, ownerId, mode }: Props) {
  const router = useRouter()
  const [data, setData] = useState<FormData>({ ...EMPTY, ...initial })
  const [errors, setErrors] = useState<FormErrors>({})
  const [touched, setTouched] = useState<Partial<Record<keyof FormData, boolean>>>({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

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
      const res = await fetch(
        mode === 'add' ? '/api/owners' : `/api/owners/${ownerId}`,
        { method: mode === 'add' ? 'POST' : 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }
      )
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setSaved(true)
      const id = mode === 'add' ? json.id : ownerId
      setTimeout(() => router.push(`/owners/${id}`), 1200)
      router.refresh()
    } catch (err) {
      alert(`Save failed: ${err}`)
      setSaving(false)
    }
  }

  return (
    <div style={{ maxWidth: '720px' }}>
      {saved && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '8px', padding: '12px 16px', marginBottom: '24px' }}>
          <CheckCircle size={18} color="#16a34a" />
          <span style={{ fontSize: '14px', color: '#15803d', fontWeight: 500 }}>Owner saved — redirecting…</span>
        </div>
      )}

      <Section title="Owner Identity">
        <Field label="Owner Name *" error={touched.name ? errors.name : undefined} full>
          <Input value={data.name} onChange={v => set('name', v)} onBlur={() => touch('name')} placeholder="ETV Capital Partners" hasError={!!(touched.name && errors.name)} />
        </Field>
        <Row>
          <Field label="Owner Type" error={undefined}>
            <Select value={data.type} onChange={v => set('type', v)} options={OWNER_TYPES} />
          </Field>
          <Field label="Status" error={undefined}>
            <Select value={data.status} onChange={v => set('status', v)} options={[{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }]} />
          </Field>
        </Row>
      </Section>

      <Section title="Primary Contact">
        <Field label="Contact Name" error={undefined} full>
          <Input value={data.contact_name} onChange={v => set('contact_name', v)} placeholder="John Smith" />
        </Field>
        <Row>
          <Field label="Email" error={touched.contact_email ? errors.contact_email : undefined}>
            <Input value={data.contact_email} onChange={v => set('contact_email', v)} onBlur={() => touch('contact_email')} placeholder="jsmith@etvpartners.com" hasError={!!(touched.contact_email && errors.contact_email)} />
          </Field>
          <Field label="Phone" error={undefined}>
            <Input value={data.contact_phone} onChange={v => set('contact_phone', v)} placeholder="(212) 555-0100" />
          </Field>
        </Row>
      </Section>

      <Section title="Address">
        <Field label="Street Address" error={undefined} full>
          <Input value={data.address} onChange={v => set('address', v)} placeholder="123 Park Ave" />
        </Field>
        <Row>
          <Field label="City" error={undefined}>
            <Input value={data.city} onChange={v => set('city', v)} placeholder="New York" />
          </Field>
          <Field label="State" error={undefined}>
            <Select value={data.state} onChange={v => set('state', v)} options={[{ value: '', label: 'Select…' }, ...US_STATES.map(s => ({ value: s, label: s }))]} />
          </Field>
          <Field label="ZIP" error={undefined}>
            <Input value={data.zip} onChange={v => set('zip', v)} placeholder="10017" />
          </Field>
        </Row>
      </Section>

      <Section title="Notes" last>
        <Field label="Notes" error={undefined} full>
          <textarea value={data.notes ?? ''} onChange={e => set('notes', e.target.value)} rows={4}
            placeholder="Any relevant notes about this owner…"
            style={{ width: '100%', padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '13px', resize: 'vertical', fontFamily: 'Arial, sans-serif', boxSizing: 'border-box', outline: 'none' }}
          />
        </Field>
      </Section>

      <div style={{ display: 'flex', gap: '12px', marginTop: '32px', paddingTop: '24px', borderTop: '1px solid #e2e8f0' }}>
        <button onClick={handleSubmit} disabled={saving || saved} style={{ padding: '10px 24px', background: saving || saved ? '#94a3b8' : '#1a3a5c', color: 'white', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: saving || saved ? 'default' : 'pointer' }}>
          {saving ? 'Saving…' : saved ? 'Saved!' : mode === 'add' ? 'Add Owner' : 'Save Changes'}
        </button>
        <button onClick={() => router.back()} style={{ padding: '10px 20px', background: 'white', color: '#64748b', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '14px', cursor: 'pointer' }}>
          Cancel
        </button>
      </div>
    </div>
  )
}

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
      {error && <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}><AlertCircle size={11} color="#dc2626" /><span style={{ fontSize: '11px', color: '#dc2626' }}>{error}</span></div>}
    </div>
  )
}
function Input({ value, onChange, onBlur, placeholder, hasError }: { value: string; onChange: (v: string) => void; onBlur?: () => void; placeholder?: string; hasError?: boolean }) {
  return <input value={value} onChange={e => onChange(e.target.value)} onBlur={onBlur} placeholder={placeholder} style={{ width: '100%', padding: '8px 10px', border: `1px solid ${hasError ? '#dc2626' : '#e2e8f0'}`, borderRadius: '6px', fontSize: '13px', outline: 'none', background: hasError ? '#fff5f5' : 'white', boxSizing: 'border-box' }} />
}
function Select({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return <select value={value} onChange={e => onChange(e.target.value)} style={{ width: '100%', padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '13px', outline: 'none', background: 'white', cursor: 'pointer', boxSizing: 'border-box' }}>{options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
}
