'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, CheckCircle } from 'lucide-react'
import { Tenant } from '@/lib/types'

type FormData = Omit<Tenant, 'id' | 'created_at' | 'updated_at'>

type FormErrors = Partial<Record<keyof FormData, string>>

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','DC','FL','GA','HI','ID','IL','IN',
  'IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH',
  'NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT',
  'VT','VA','WA','WV','WI','WY',
]

function validate(data: FormData): FormErrors {
  const errors: FormErrors = {}
  if (!data.name.trim()) errors.name = 'Licensee name is required'
  if (data.account_manager_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.account_manager_email))
    errors.account_manager_email = 'Must be a valid email address'
  return errors
}

interface Props {
  initial?: Partial<FormData>
  tenantId?: string
  mode: 'add' | 'edit'
}

const EMPTY: FormData = {
  name: '', status: 'active', hq_address: '', hq_city: '', hq_state: '',
  hq_zip: '', account_manager_name: '', account_manager_email: '',
  account_manager_phone: '', notes: '',
}

export default function TenantForm({ initial, tenantId, mode }: Props) {
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
    const errs = validate(data)
    setErrors(prev => ({ ...prev, [field]: errs[field] }))
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
        mode === 'add' ? '/api/tenants' : `/api/tenants/${tenantId}`,
        {
          method: mode === 'add' ? 'POST' : 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        }
      )
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)

      setSaved(true)
      const id = mode === 'add' ? json.id : tenantId
      setTimeout(() => router.push(`/tenants/${id}`), 1200)
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
          <span style={{ fontSize: '14px', color: '#15803d', fontWeight: 500 }}>Licensee saved — redirecting…</span>
        </div>
      )}

      <Section title="Licensee Identity">
        <Field label="Company Name *" error={touched.name ? errors.name : undefined} full>
          <Input value={data.name} onChange={v => set('name', v)} onBlur={() => touch('name')} placeholder="AT&T Mobility" hasError={!!(touched.name && errors.name)} />
        </Field>
        <Field label="Status" error={undefined}>
          <Select value={data.status} onChange={v => set('status', v)} options={[
            { value: 'active', label: 'Active' },
            { value: 'inactive', label: 'Inactive' },
          ]} />
        </Field>
      </Section>

      <Section title="Headquarters">
        <Field label="Street Address" error={undefined} full>
          <Input value={data.hq_address} onChange={v => set('hq_address', v)} placeholder="208 S. Akard St" />
        </Field>
        <Row>
          <Field label="City" error={undefined}>
            <Input value={data.hq_city} onChange={v => set('hq_city', v)} placeholder="Dallas" />
          </Field>
          <Field label="State" error={undefined}>
            <Select value={data.hq_state} onChange={v => set('hq_state', v)} options={[{ value: '', label: 'Select…' }, ...US_STATES.map(s => ({ value: s, label: s }))]} />
          </Field>
          <Field label="ZIP" error={undefined}>
            <Input value={data.hq_zip} onChange={v => set('hq_zip', v)} placeholder="75202" />
          </Field>
        </Row>
      </Section>

      <Section title="Primary Account Manager">
        <Field label="Name" error={undefined} full>
          <Input value={data.account_manager_name} onChange={v => set('account_manager_name', v)} placeholder="Jane Smith" />
        </Field>
        <Row>
          <Field label="Email" error={touched.account_manager_email ? errors.account_manager_email : undefined}>
            <Input value={data.account_manager_email} onChange={v => set('account_manager_email', v)} onBlur={() => touch('account_manager_email')} placeholder="jsmith@att.com" hasError={!!(touched.account_manager_email && errors.account_manager_email)} />
          </Field>
          <Field label="Phone" error={undefined}>
            <Input value={data.account_manager_phone} onChange={v => set('account_manager_phone', v)} placeholder="(214) 555-0100" />
          </Field>
        </Row>
      </Section>

      <Section title="Notes" last>
        <Field label="Notes" error={undefined} full>
          <textarea
            value={data.notes ?? ''}
            onChange={e => set('notes', e.target.value)}
            rows={4}
            placeholder="Any relevant notes about this licensee…"
            style={{ width: '100%', padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '13px', resize: 'vertical', fontFamily: 'Arial, sans-serif', boxSizing: 'border-box', outline: 'none' }}
          />
        </Field>
      </Section>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '12px', marginTop: '32px', paddingTop: '24px', borderTop: '1px solid #e2e8f0' }}>
        <button
          onClick={handleSubmit}
          disabled={saving || saved}
          style={{
            padding: '10px 24px', background: saving || saved ? '#94a3b8' : '#1a3a5c',
            color: 'white', border: 'none', borderRadius: '8px',
            fontSize: '14px', fontWeight: 600, cursor: saving || saved ? 'default' : 'pointer',
          }}
        >
          {saving ? 'Saving…' : saved ? 'Saved!' : mode === 'add' ? 'Add Licensee' : 'Save Changes'}
        </button>
        <button
          onClick={() => router.back()}
          style={{ padding: '10px 20px', background: 'white', color: '#64748b', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '14px', cursor: 'pointer' }}
        >
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
      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
          <AlertCircle size={11} color="#dc2626" />
          <span style={{ fontSize: '11px', color: '#dc2626' }}>{error}</span>
        </div>
      )}
    </div>
  )
}

function Input({ value, onChange, onBlur, placeholder, hasError }: { value: string; onChange: (v: string) => void; onBlur?: () => void; placeholder?: string; hasError?: boolean }) {
  return (
    <input
      value={value}
      onChange={e => onChange(e.target.value)}
      onBlur={onBlur}
      placeholder={placeholder}
      style={{ width: '100%', padding: '8px 10px', border: `1px solid ${hasError ? '#dc2626' : '#e2e8f0'}`, borderRadius: '6px', fontSize: '13px', outline: 'none', background: hasError ? '#fff5f5' : 'white', boxSizing: 'border-box' }}
    />
  )
}

function Select({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{ width: '100%', padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '13px', outline: 'none', background: 'white', cursor: 'pointer', boxSizing: 'border-box' }}
    >
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )
}
