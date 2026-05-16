'use client'

import { useState, useEffect } from 'react'
import { X, CheckCircle, AlertCircle } from 'lucide-react'

export const EQUIPMENT_TYPES = [
  'Antenna (Panel)', 'Antenna (Omni)', 'Antenna (Sector)', 'Antenna (Directional)',
  'Remote Radio Head (RRH)', 'Equipment Cabinet', 'GPS Unit',
  'Power Amplifier', 'Backhaul Equipment', 'Coaxial Cable Run', 'Other',
]

interface LicenseOption { id: string; name: string }

interface FormData {
  license_id: string
  equipment_type: string
  manufacturer: string
  model: string
  quantity: string
  install_date: string
  location_description: string
  fcc_id: string
  notes: string
}

function emptyForm(): FormData {
  return { license_id: '', equipment_type: 'Antenna (Panel)', manufacturer: '', model: '', quantity: '1', install_date: '', location_description: '', fcc_id: '', notes: '' }
}

interface Props {
  open: boolean
  onClose: () => void
  onSaved: () => void
  siteId: string
  licenses: LicenseOption[]
  existing?: Record<string, any>
}

export default function EquipmentDrawer({ open, onClose, onSaved, siteId, licenses, existing }: Props) {
  const mode = existing ? 'edit' : 'add'
  const [data, setData] = useState<FormData>(emptyForm())
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setSaved(false)
      setSaving(false)
      setError(null)
      if (existing) {
        setData({
          license_id: existing.license_id ?? '',
          equipment_type: existing.equipment_type ?? 'Antenna (Panel)',
          manufacturer: existing.manufacturer ?? '',
          model: existing.model ?? '',
          quantity: String(existing.quantity ?? 1),
          install_date: existing.install_date ?? '',
          location_description: existing.location_description ?? '',
          fcc_id: existing.fcc_id ?? '',
          notes: existing.notes ?? '',
        })
      } else {
        setData(emptyForm())
      }
    }
  }, [open, existing])

  function set(field: keyof FormData, value: string) {
    setData(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmit() {
    if (!data.equipment_type.trim()) { setError('Equipment type is required'); return }
    setSaving(true)
    setError(null)
    try {
      const url = mode === 'add'
        ? `/api/sites/${siteId}/equipment`
        : `/api/sites/${siteId}/equipment/${existing!.id}`
      const method = mode === 'add' ? 'POST' : 'PATCH'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, quantity: Number(data.quantity) || 1 }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setSaved(true)
      onSaved()
      setTimeout(() => onClose(), 1200)
    } catch (err: any) {
      setError(err.message ?? 'Save failed')
      setSaving(false)
    }
  }

  const inputStyle = (full?: boolean): React.CSSProperties => ({
    width: '100%', padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: '6px',
    fontSize: '13px', outline: 'none', background: 'white', boxSizing: 'border-box',
  })

  return (
    <>
      {open && <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 40 }} />}
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
              {mode === 'add' ? 'Add Equipment' : 'Edit Equipment'}
            </div>
            <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: '12px', marginTop: '2px' }}>
              Structured equipment record for this site
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
              {mode === 'add' ? 'Equipment added!' : 'Equipment updated!'}
            </div>
          </div>
        ) : (
          <>
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {error && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', color: '#b91c1c', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <AlertCircle size={14} /> {error}
                </div>
              )}

              {/* Carrier */}
              <Section title="Carrier / License">
                <Label>Carrier</Label>
                <select value={data.license_id} onChange={e => set('license_id', e.target.value)} style={{ ...inputStyle(), cursor: 'pointer' }}>
                  <option value="">— Site-wide (no specific carrier) —</option>
                  {licenses.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </Section>

              {/* Equipment details */}
              <Section title="Equipment Details">
                <Label>Type *</Label>
                <select value={data.equipment_type} onChange={e => set('equipment_type', e.target.value)} style={{ ...inputStyle(), cursor: 'pointer', marginBottom: '10px' }}>
                  {EQUIPMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                  <div style={{ flex: 1 }}>
                    <Label>Manufacturer</Label>
                    <input value={data.manufacturer} onChange={e => set('manufacturer', e.target.value)} placeholder="e.g. Commscope" style={inputStyle()} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <Label>Model</Label>
                    <input value={data.model} onChange={e => set('model', e.target.value)} placeholder="e.g. HBXX-6516DS" style={inputStyle()} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <div style={{ flex: '0 0 80px' }}>
                    <Label>Qty</Label>
                    <input type="number" min="1" value={data.quantity} onChange={e => set('quantity', e.target.value)} style={inputStyle()} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <Label>FCC ID</Label>
                    <input value={data.fcc_id} onChange={e => set('fcc_id', e.target.value)} placeholder="e.g. MFXCL01006" style={inputStyle()} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <Label>Install Date</Label>
                    <input type="date" value={data.install_date} onChange={e => set('install_date', e.target.value)} style={inputStyle()} />
                  </div>
                </div>
              </Section>

              {/* Location */}
              <Section title="Location on Structure">
                <Label>Location Description</Label>
                <input value={data.location_description} onChange={e => set('location_description', e.target.value)} placeholder="e.g. Rooftop parapet — Sectors A/B/C, 185 ft AGL" style={{ ...inputStyle(), marginBottom: '10px' }} />
                <Label>Notes</Label>
                <textarea value={data.notes} onChange={e => set('notes', e.target.value)} rows={3} placeholder="Install notes, amendments referenced, decommission info…" style={{ ...inputStyle(), resize: 'vertical', fontFamily: 'inherit' }} />
              </Section>
            </div>

            <div style={{ padding: '16px 24px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '10px', background: '#f8fafc' }}>
              <button onClick={onClose} style={{ padding: '9px 18px', background: 'white', color: '#64748b', border: '1px solid #e2e8f0', borderRadius: '7px', fontSize: '14px', cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={handleSubmit} disabled={saving} style={{ padding: '9px 22px', background: saving ? '#94a3b8' : '#1a3a5c', color: 'white', border: 'none', borderRadius: '7px', fontSize: '14px', fontWeight: 600, cursor: saving ? 'default' : 'pointer' }}>
                {saving ? 'Saving…' : mode === 'add' ? 'Add Equipment' : 'Save Changes'}
              </button>
            </div>
          </>
        )}
      </div>
    </>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: '11px', fontWeight: 700, color: '#1a3a5c', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '10px', paddingBottom: '6px', borderBottom: '1px solid #e2e8f0' }}>
        {title}
      </div>
      {children}
    </div>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '4px' }}>{children}</label>
}
