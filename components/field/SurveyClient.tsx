'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Site {
  id: string; site_code: string; name: string; address: string
  city: string; state: string; zip: string; lat: number | null; lng: number | null
  tower_type: string | null; height_ft: number | null; status: string | null; county: string | null
  tenant_slots: number | null
}

interface ActiveTenant {
  id: string; status: string; mount_type: string | null; antenna_height_ft: number | null
  licensees: { name: string } | null
}

interface SurveyRow {
  id: string; status: string
  gps_lat: number | null; gps_lng: number | null
  gps_accuracy_meters: number | null; gps_delta_meters: number | null; gps_matched: boolean | null
  tower_data: Record<string, string>
  security_data: Record<string, string>
  infrastructure_data: Record<string, string>
  generator_data: Record<string, string>
  maintenance_data: Record<string, string>
  notes: string | null
}

interface Photo {
  id: string; public_url: string | null; category: string; caption: string | null
  uploaded_by_name: string | null; created_at: string; mime_type: string | null
}

interface EquipmentItem {
  id: string
  equipment_type: string
  manufacturer: string | null
  model: string | null
  quantity: number
  location_description: string | null
  fcc_id: string | null
  site_licenses?: { licensees?: { name: string } | null } | null
}

interface Props {
  site: Site
  existingSurvey: SurveyRow | null
  existingPhotos: Photo[]
  activeTenants: ActiveTenant[]
  equipmentItems?: EquipmentItem[]
  userId: string
  userName: string
  isAdminPreview?: boolean
  userRole?: string | null
}

// ─── Draft shape ─────────────────────────────────────────────────────────────

interface Draft {
  surveyId: string | null
  gps_lat: number | null; gps_lng: number | null
  gps_accuracy_meters: number | null; gps_delta_meters: number | null; gps_matched: boolean | null
  tower: Record<string, string>
  security: Record<string, string>
  infra: Record<string, string>
  generator: Record<string, string>
  maintenance: Record<string, string>
  notes: string
}

const emptyDraft = (): Draft => ({
  surveyId: null,
  gps_lat: null, gps_lng: null,
  gps_accuracy_meters: null, gps_delta_meters: null, gps_matched: null,
  tower: { condition: '', structural_issues: '', lighting_functional: '', climbing_equipment: '', equipment_on_structure: '' },
  security: { fencing_present: '', fencing_type: '', fencing_condition: '', fencing_notes: '', access_control_type: '', access_control_condition: '', access_control_notes: '', gate_functional: '' },
  infra: { cabinet_present: '', cabinet_condition: '', switch_present: '', switch_make: '', switch_model: '', routing_present: '', router_make: '', router_model: '', power_supply: '', cooling: '', notes: '' },
  generator: { present: '', make: '', model: '', fuel_type: '', kw_rating: '', last_service_date: '', condition: '', fuel_level: '', notes: '' },
  maintenance: { issues_found: '', actions_taken: '', follow_up_required: '', priority: '', notes: '' },
  notes: '',
})

function draftFromRow(row: SurveyRow): Draft {
  return {
    surveyId: row.id,
    gps_lat: row.gps_lat, gps_lng: row.gps_lng,
    gps_accuracy_meters: row.gps_accuracy_meters,
    gps_delta_meters: row.gps_delta_meters,
    gps_matched: row.gps_matched,
    tower: row.tower_data ?? {},
    security: row.security_data ?? {},
    infra: row.infrastructure_data ?? {},
    generator: row.generator_data ?? {},
    maintenance: row.maintenance_data ?? {},
    notes: row.notes ?? '',
  }
}

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// ─── Step definitions ────────────────────────────────────────────────────────

const STEPS = ['Location', 'Tower', 'Security', 'Infrastructure', 'Generator', 'Photos', 'Notes']
const STEP_ICONS = ['📍', '🗼', '🔒', '📦', '⚡', '📷', '📝']

// ─── Reusable field components ───────────────────────────────────────────────

function SLabel({ children }: { children: React.ReactNode }) {
  return <label style={{ fontSize: '13px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '6px' }}>{children}</label>
}

function SInput({ value, onChange, placeholder, type = 'text' }: {
  value: string; onChange: (v: string) => void; placeholder?: string; type?: string
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        width: '100%', boxSizing: 'border-box', padding: '11px 14px',
        borderRadius: '10px', border: '1.5px solid #e2e8f0',
        fontSize: '15px', color: '#1e293b', background: '#fff', outline: 'none',
      }}
    />
  )
}

function STextarea({ value, onChange, placeholder, rows = 3 }: {
  value: string; onChange: (v: string) => void; placeholder?: string; rows?: number
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      style={{
        width: '100%', boxSizing: 'border-box', padding: '11px 14px',
        borderRadius: '10px', border: '1.5px solid #e2e8f0',
        fontSize: '15px', color: '#1e293b', background: '#fff', outline: 'none',
        resize: 'vertical',
      }}
    />
  )
}

function SSelect({ value, onChange, options, placeholder }: {
  value: string; onChange: (v: string) => void
  options: { value: string; label: string }[]; placeholder?: string
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        width: '100%', boxSizing: 'border-box', padding: '11px 14px',
        borderRadius: '10px', border: '1.5px solid #e2e8f0',
        fontSize: '15px', color: value ? '#1e293b' : '#94a3b8',
        background: '#fff', outline: 'none', appearance: 'none',
      }}
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )
}

function SGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '18px' }}>
      <SLabel>{label}</SLabel>
      {children}
    </div>
  )
}

function SRow({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>{children}</div>
}

const YN_OPTIONS = [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }, { value: 'unknown', label: 'Unknown' }]
const CONDITION_OPTIONS = [
  { value: 'good', label: '✅ Good' },
  { value: 'fair', label: '⚠️ Fair' },
  { value: 'poor', label: '🔴 Poor' },
  { value: 'critical', label: '🚨 Critical' },
]
const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: '🚨 Urgent' },
]
function tabStyle(active: boolean): React.CSSProperties {
  return {
    padding: '8px 14px', borderRadius: '20px', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
    fontSize: '13px', fontWeight: 600, flexShrink: 0,
    background: active ? '#1e3a5f' : '#e2e8f0',
    color: active ? '#fff' : '#64748b',
  }
}

function matchBadgeStyle(ok: boolean | null): React.CSSProperties {
  return {
    display: 'inline-block', padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 700, marginTop: '8px',
    background: ok === true ? '#dcfce7' : ok === false ? '#fee2e2' : '#f1f5f9',
    color: ok === true ? '#166534' : ok === false ? '#991b1b' : '#64748b',
  }
}

const PHOTO_CATEGORIES = [
  { value: 'tower', label: '🗼 Tower' },
  { value: 'security', label: '🔒 Security' },
  { value: 'access', label: '🚪 Access' },
  { value: 'equipment', label: '📦 Equipment' },
  { value: 'generator', label: '⚡ Generator' },
  { value: 'maintenance', label: '🔧 Maintenance' },
  { value: 'general', label: '📷 General' },
]

// ─── Main component ───────────────────────────────────────────────────────────

const TOWER_TYPE_LABELS: Record<string, string> = {
  monopole: 'Monopole', lattice: 'Lattice', rooftop: 'Rooftop',
  water_tower: 'Water Tower', guyed: 'Guyed', small_cell: 'Small Cell',
}

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin', admin: 'Admin', editor: 'Editor', reporter: 'Reporter', viewer: 'Viewer',
}

export default function SurveyClient({ site, existingSurvey, existingPhotos, activeTenants, equipmentItems = [], userId, userName, isAdminPreview, userRole }: Props) {
  const router = useRouter()
  const storageKey = `field_survey_${site.id}`

  // Draft state — load from existing survey or localStorage
  const [draft, setDraft] = useState<Draft>(() => {
    if (existingSurvey) return draftFromRow(existingSurvey)
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(storageKey)
      if (saved) {
        try { return { ...emptyDraft(), ...JSON.parse(saved) } } catch {}
      }
    }
    return emptyDraft()
  })

  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')
  const [completing, setCompleting] = useState(false)
  const [completed, setCompleted] = useState(existingSurvey?.status === 'completed')

  // GPS state
  const [gpsLoading, setGpsLoading] = useState(false)
  const [gpsError, setGpsError] = useState('')

  // Photos state
  const [photos, setPhotos] = useState<Photo[]>(existingPhotos)
  const [photoCategory, setPhotoCategory] = useState('general')
  const [photoCaption, setPhotoCaption] = useState('')
  const [photoUploading, setPhotoUploading] = useState(false)
  const [photoError, setPhotoError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Autosave to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(storageKey, JSON.stringify(draft))
    }
  }, [draft, storageKey])

  function updateSection(section: keyof Draft, key: string, value: string) {
    setDraft((prev) => ({
      ...prev,
      [section]: { ...(prev[section] as Record<string, string>), [key]: value },
    }))
  }

  // GPS capture
  const captureGPS = useCallback(() => {
    if (!navigator.geolocation) { setGpsError('Geolocation not supported'); return }
    setGpsLoading(true)
    setGpsError('')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords
        const delta = site.lat && site.lng
          ? haversineMeters(latitude, longitude, site.lat, site.lng)
          : null
        const matched = delta !== null ? delta < 200 : null
        setDraft((prev) => ({
          ...prev,
          gps_lat: latitude,
          gps_lng: longitude,
          gps_accuracy_meters: Math.round(accuracy),
          gps_delta_meters: delta !== null ? Math.round(delta) : null,
          gps_matched: matched,
        }))
        setGpsLoading(false)
      },
      () => { setGpsError('Could not get location — check permissions'); setGpsLoading(false) },
      { enableHighAccuracy: true, timeout: 15000 }
    )
  }, [site])

  // Save draft to DB
  const saveDraft = useCallback(async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/field/surveys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          survey_id: draft.surveyId,
          site_id: site.id,
          user_id: userId,
          status: 'in_progress',
          gps_lat: draft.gps_lat,
          gps_lng: draft.gps_lng,
          gps_accuracy_meters: draft.gps_accuracy_meters,
          gps_delta_meters: draft.gps_delta_meters,
          gps_matched: draft.gps_matched,
          tower_data: draft.tower,
          security_data: draft.security,
          infrastructure_data: draft.infra,
          generator_data: draft.generator,
          maintenance_data: draft.maintenance,
          notes: draft.notes,
        }),
      })
      const data = await res.json()
      if (data.id) setDraft((prev) => ({ ...prev, surveyId: data.id }))
      setSaveMsg('Saved')
      setTimeout(() => setSaveMsg(''), 2000)
    } catch {
      setSaveMsg('Save failed')
    } finally {
      setSaving(false)
    }
  }, [draft, site.id, userId])

  // Complete survey
  const completeSurvey = useCallback(async () => {
    setCompleting(true)
    try {
      const res = await fetch('/api/field/surveys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          survey_id: draft.surveyId,
          site_id: site.id,
          user_id: userId,
          status: 'completed',
          gps_lat: draft.gps_lat,
          gps_lng: draft.gps_lng,
          gps_accuracy_meters: draft.gps_accuracy_meters,
          gps_delta_meters: draft.gps_delta_meters,
          gps_matched: draft.gps_matched,
          tower_data: draft.tower,
          security_data: draft.security,
          infrastructure_data: draft.infra,
          generator_data: draft.generator,
          maintenance_data: draft.maintenance,
          notes: draft.notes,
        }),
      })
      const data = await res.json()
      if (data.id) {
        setDraft((prev) => ({ ...prev, surveyId: data.id }))
        if (typeof window !== 'undefined') localStorage.removeItem(storageKey)
        setCompleted(true)
      }
    } finally {
      setCompleting(false)
    }
  }, [draft, site.id, userId, storageKey])

  // Photo upload — routes through server API to use service role key for storage
  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoUploading(true)
    setPhotoError('')
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('site_id', site.id)
      if (draft.surveyId) fd.append('survey_id', draft.surveyId)
      fd.append('user_id', userId)
      fd.append('category', photoCategory)
      if (photoCaption) fd.append('caption', photoCaption)

      const res = await fetch('/api/field/photos', { method: 'POST', body: fd })
      const saved = await res.json()
      if (saved.id) {
        setPhotos((prev) => [saved, ...prev])
        setPhotoCaption('')
      } else {
        throw new Error(saved.error ?? 'Upload failed')
      }
    } catch (err: any) {
      setPhotoError(err.message ?? 'Upload failed')
    } finally {
      setPhotoUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const deletePhoto = async (photoId: string) => {
    await fetch(`/api/field/photos?id=${photoId}`, { method: 'DELETE' })
    setPhotos((prev) => prev.filter((p) => p.id !== photoId))
  }

  // ─── Styles ────────────────────────────────────────────────────────────────

  const S: Record<string, React.CSSProperties> = {
    root: { minHeight: '100vh', background: '#f8fafc', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', paddingBottom: '120px' },
    topBar: { position: 'sticky', top: 0, zIndex: 50, background: '#1e3a5f', color: '#fff', padding: '14px 16px', boxShadow: '0 2px 8px rgba(0,0,0,0.2)' },
    topRow: { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' },
    backBtn: { background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', borderRadius: '8px', padding: '6px 12px', fontSize: '14px', cursor: 'pointer' },
    siteName: { flex: 1, fontSize: '16px', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
    siteCode: { fontSize: '12px', opacity: 0.7 },
    progressBar: { height: '4px', background: 'rgba(255,255,255,0.2)', borderRadius: '2px', overflow: 'hidden' },
    progressFill: { height: '100%', background: '#22c55e', borderRadius: '2px', transition: 'width 0.3s ease', width: `${((step + 1) / STEPS.length) * 100}%` },
    tabs: { display: 'flex', gap: '4px', padding: '12px 12px 0', overflowX: 'auto', scrollbarWidth: 'none' },
    section: { padding: '16px' },
    sectionTitle: { fontSize: '18px', fontWeight: 700, color: '#1e293b', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' },
    sectionSub: { fontSize: '13px', color: '#94a3b8', marginBottom: '20px' },
    card: { background: '#fff', borderRadius: '14px', padding: '18px', border: '1px solid #e2e8f0', marginBottom: '12px' },
    bottomBar: { position: 'fixed', bottom: 0, left: 0, right: 0, background: '#fff', borderTop: '1px solid #e2e8f0', padding: '12px 16px', display: 'flex', gap: '10px', zIndex: 40 },
    saveBtn: { flex: 1, padding: '14px', borderRadius: '12px', border: '1.5px solid #1e3a5f', background: '#fff', color: '#1e3a5f', fontSize: '15px', fontWeight: 600, cursor: 'pointer' },
    completeBtn: { flex: 2, padding: '14px', borderRadius: '12px', border: 'none', background: '#16a34a', color: '#fff', fontSize: '15px', fontWeight: 600, cursor: completing ? 'default' : 'pointer', opacity: completing ? 0.7 : 1 },
    gpsBox: { background: '#f0f9ff', borderRadius: '12px', padding: '16px', border: '1px solid #bae6fd', marginBottom: '16px' },
    gpsBtn: { width: '100%', padding: '14px', borderRadius: '12px', border: 'none', background: '#0284c7', color: '#fff', fontSize: '15px', fontWeight: 600, cursor: gpsLoading ? 'default' : 'pointer', marginBottom: '12px', opacity: gpsLoading ? 0.7 : 1 },
    gpsResult: { fontSize: '13px', color: '#0c4a6e' },
    photoGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginTop: '12px' },
    photoThumb: { aspectRatio: '1', borderRadius: '8px', overflow: 'hidden', position: 'relative' as const, background: '#f1f5f9' },
    photoImg: { width: '100%', height: '100%', objectFit: 'cover' as const },
    photoDelete: { position: 'absolute' as const, top: '4px', right: '4px', background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none', borderRadius: '50%', width: '22px', height: '22px', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
    photoCatBadge: { position: 'absolute' as const, bottom: '4px', left: '4px', background: 'rgba(0,0,0,0.6)', color: '#fff', borderRadius: '4px', padding: '2px 6px', fontSize: '10px' },
    uploadArea: { background: '#f8fafc', borderRadius: '12px', border: '2px dashed #cbd5e1', padding: '20px', textAlign: 'center' as const, marginBottom: '12px' },
    uploadBtn: { padding: '12px 24px', borderRadius: '10px', border: 'none', background: '#1e3a5f', color: '#fff', fontSize: '15px', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px' },
    completedBanner: { margin: '16px', background: '#dcfce7', borderRadius: '14px', padding: '20px', textAlign: 'center' as const, border: '1px solid #86efac' },
    infoRow: { display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f1f5f9', fontSize: '14px' },
  }

  if (completed) {
    return (
      <div style={S.root}>
        {isAdminPreview && (
          <div style={{ background: '#1e293b', color: '#e2e8f0', fontSize: '12px', padding: '7px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
            <span>👁 <strong style={{ color: '#f8fafc' }}>{ROLE_LABELS[userRole ?? ''] ?? userRole}</strong> preview</span>
            <button onClick={() => router.push('/dashboard')} style={{ background: '#3b82f6', border: 'none', color: 'white', borderRadius: '6px', padding: '4px 10px', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>← Admin</button>
          </div>
        )}
        <div style={S.topBar}>
          <div style={S.topRow}>
            <button style={S.backBtn} onClick={() => router.push('/field')}>← Back</button>
            <div>
              <div style={S.siteName}>{site.name}</div>
              <div style={S.siteCode}>{site.site_code}</div>
            </div>
          </div>
        </div>
        <div style={S.completedBanner}>
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>✅</div>
          <div style={{ fontSize: '18px', fontWeight: 700, color: '#166534', marginBottom: '8px' }}>Survey Complete</div>
          <div style={{ fontSize: '14px', color: '#4ade80' }}>Submitted by {userName}</div>
        </div>
        <div style={{ padding: '16px' }}>
          <div style={S.card}>
            <div style={{ fontWeight: 600, marginBottom: '12px', color: '#1e293b' }}>Survey Summary</div>
            {[
              ['Site', site.name],
              ['Code', site.site_code],
              ['Address', `${site.address}, ${site.city}, ${site.state}`],
              ['Tower Type', site.tower_type ?? '—'],
              ['GPS Match', draft.gps_matched === true ? '✅ Matched' : draft.gps_matched === false ? '⚠️ Mismatch' : '—'],
              ['Photos', `${photos.length} captured`],
            ].map(([k, v]) => (
              <div key={k as string} style={S.infoRow}>
                <span style={{ color: '#64748b' }}>{k}</span>
                <span style={{ fontWeight: 500 }}>{v}</span>
              </div>
            ))}
          </div>
          <button
            onClick={() => { setCompleted(false); setStep(0) }}
            style={{ ...S.saveBtn, width: '100%', marginBottom: '10px' }}
          >
            Edit Survey
          </button>
          <button
            onClick={() => router.push('/field')}
            style={{ ...S.completeBtn, width: '100%' }}
          >
            Back to Sites
          </button>
        </div>
      </div>
    )
  }

  // ─── Step content renderers ─────────────────────────────────────────────────

  function renderLocation() {
    return (
      <div style={S.section}>
        <div style={S.sectionTitle}>{STEP_ICONS[0]} Location Verification</div>
        <div style={S.sectionSub}>Capture your GPS position and compare to the site record</div>

        <div style={S.card}>
          <div style={{ fontWeight: 600, marginBottom: '12px', fontSize: '14px', color: '#475569' }}>SITE RECORD</div>
          {[
            ['Address', site.address],
            ['City', `${site.city}, ${site.state} ${site.zip ?? ''}`],
            ['County', site.county ?? '—'],
            ['Lat / Lng', site.lat && site.lng ? `${site.lat.toFixed(5)}, ${site.lng.toFixed(5)}` : 'Not recorded'],
          ].map(([k, v]) => (
            <div key={k as string} style={S.infoRow}>
              <span style={{ color: '#64748b', fontSize: '13px' }}>{k}</span>
              <span style={{ fontWeight: 500, fontSize: '13px' }}>{v}</span>
            </div>
          ))}
        </div>

        <div style={S.gpsBox}>
          <button style={S.gpsBtn} onClick={captureGPS} disabled={gpsLoading}>
            {gpsLoading ? '⏳ Getting location…' : '📍 Capture My GPS Position'}
          </button>
          {gpsError && <p style={{ color: '#ef4444', fontSize: '13px' }}>{gpsError}</p>}
          {draft.gps_lat !== null && (
            <div style={S.gpsResult}>
              <div><strong>Your position:</strong> {draft.gps_lat.toFixed(5)}, {draft.gps_lng?.toFixed(5)}</div>
              <div><strong>Accuracy:</strong> ±{draft.gps_accuracy_meters}m</div>
              {draft.gps_delta_meters !== null && (
                <div><strong>Distance from record:</strong> {draft.gps_delta_meters}m</div>
              )}
              <div style={matchBadgeStyle(draft.gps_matched)}>
                {draft.gps_matched === true ? '✓ GPS matches site record' :
                 draft.gps_matched === false ? '⚠ Position differs from record — flag for review' :
                 'Site has no GPS on record'}
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  function renderTower() {
    const t = draft.tower
    const set = (k: string, v: string) => updateSection('tower', k, v)
    const slots = site.tenant_slots
    const occupied = activeTenants.length
    const occupancyPct = slots ? Math.min(100, (occupied / slots) * 100) : null
    const barColor = occupancyPct === null ? '#3b82f6' : occupancyPct >= 100 ? '#16a34a' : occupancyPct >= 60 ? '#3b82f6' : '#d97706'

    return (
      <div style={S.section}>
        <div style={S.sectionTitle}>{STEP_ICONS[1]} Tower Details</div>
        <div style={S.sectionSub}>Record tower structure and equipment condition</div>

        {/* Read-only context card */}
        <div style={{ ...S.card, background: '#f8fafc', border: '1px solid #e2e8f0', marginBottom: '12px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px' }}>Tower Record</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '14px' }}>
            {[
              ['Type', TOWER_TYPE_LABELS[site.tower_type ?? ''] || site.tower_type || '—'],
              ['Height', site.height_ft ? `${site.height_ft} ft` : '—'],
            ].map(([k, v]) => (
              <div key={k}>
                <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '2px' }}>{k}</div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#1e293b' }}>{v}</div>
              </div>
            ))}
          </div>
          <div style={{ marginBottom: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>Tenant Slots</span>
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b' }}>
                {occupied} occupied{slots ? ` of ${slots}` : ''}
                {slots && occupied < slots && (
                  <span style={{ fontWeight: 500, color: '#16a34a', marginLeft: '6px' }}>· {slots - occupied} free</span>
                )}
                {slots && occupied >= slots && (
                  <span style={{ fontWeight: 600, color: '#dc2626', marginLeft: '6px' }}>· Full</span>
                )}
              </span>
            </div>
            {slots && (
              <div style={{ height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${occupancyPct}%`, background: barColor, borderRadius: '3px' }} />
              </div>
            )}
          </div>
          {activeTenants.length > 0 && (
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>Current Tenants</div>
              {activeTenants.map((t) => (
                <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #f1f5f9', fontSize: '13px' }}>
                  <span style={{ fontWeight: 500, color: '#1e293b' }}>{t.licensees?.name ?? '—'}</span>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    {t.antenna_height_ft && <span style={{ fontSize: '11px', color: '#64748b' }}>{t.antenna_height_ft} ft</span>}
                    {t.mount_type && <span style={{ fontSize: '11px', background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px', color: '#475569' }}>{t.mount_type}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
          {activeTenants.length === 0 && (
            <p style={{ fontSize: '13px', color: '#94a3b8', margin: 0 }}>No active tenants on record</p>
          )}
        </div>

        <div style={S.card}>
          <SGroup label="Overall Condition">
            <SSelect value={t.condition} onChange={(v) => set('condition', v)} options={CONDITION_OPTIONS} placeholder="Select condition…" />
          </SGroup>
          <SGroup label="Structural Issues Observed">
            <STextarea value={t.structural_issues} onChange={(v) => set('structural_issues', v)} placeholder="e.g. visible corrosion on lower section, loose mounting hardware…" />
          </SGroup>
          <SGroup label="Obstruction Lighting">
            <SSelect value={t.lighting_functional} onChange={(v) => set('lighting_functional', v)} options={YN_OPTIONS} placeholder="Is lighting functional?" />
          </SGroup>
          <SGroup label="Climbing Equipment (ladder, pegs, safety cable)">
            <SSelect value={t.climbing_equipment} onChange={(v) => set('climbing_equipment', v)}
              options={[
                { value: 'ladder_good', label: 'Ladder — Good condition' },
                { value: 'ladder_damaged', label: 'Ladder — Damaged' },
                { value: 'pegs_good', label: 'Pegs — Good condition' },
                { value: 'pegs_damaged', label: 'Pegs — Damaged' },
                { value: 'none', label: 'None / Not applicable' },
              ]}
              placeholder="Select type…"
            />
          </SGroup>
          {equipmentItems.length > 0 && (() => {
            const byCarrier = equipmentItems.reduce<Record<string, EquipmentItem[]>>((acc, eq) => {
              const key = eq.site_licenses?.licensees?.name ?? 'Site-wide'
              ;(acc[key] ??= []).push(eq)
              return acc
            }, {})
            return (
              <div style={{ marginBottom: '18px' }}>
                <SLabel>Equipment on Record</SLabel>
                <div style={{ background: '#f0f9ff', borderRadius: '10px', border: '1px solid #bae6fd', overflow: 'hidden' }}>
                  <div style={{ padding: '8px 14px', background: '#0284c7', color: 'white', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    📋 Inventory Reference — verify against what you observe
                  </div>
                  {Object.entries(byCarrier).map(([carrier, items]) => (
                    <div key={carrier} style={{ borderBottom: '1px solid #bae6fd' }}>
                      <div style={{ padding: '6px 14px', background: '#e0f2fe', fontSize: '11px', fontWeight: 700, color: '#0369a1', textTransform: 'uppercase' }}>{carrier}</div>
                      {items.map(eq => (
                        <div key={eq.id} style={{ padding: '8px 14px', borderBottom: '1px solid #e0f2fe', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                          <div>
                            <div style={{ fontSize: '13px', fontWeight: 600, color: '#0c4a6e' }}>
                              {eq.quantity}× {eq.equipment_type}
                              {(eq.manufacturer || eq.model) && (
                                <span style={{ fontWeight: 400, color: '#0369a1' }}> — {[eq.manufacturer, eq.model].filter(Boolean).join(' ')}</span>
                              )}
                            </div>
                            {eq.location_description && (
                              <div style={{ fontSize: '11px', color: '#0369a1', marginTop: '2px' }}>{eq.location_description}</div>
                            )}
                          </div>
                          {eq.fcc_id && (
                            <span style={{ fontSize: '10px', fontFamily: 'monospace', background: '#bae6fd', color: '#0369a1', padding: '2px 6px', borderRadius: '4px', flexShrink: 0 }}>{eq.fcc_id}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            )
          })()}
          <SGroup label="Equipment Observations">
            <STextarea value={t.equipment_on_structure} onChange={(v) => set('equipment_on_structure', v)} placeholder="Note what you observe vs. the inventory above — missing items, new additions, condition issues…" />
          </SGroup>
        </div>
      </div>
    )
  }

  function renderSecurity() {
    const s = draft.security
    const set = (k: string, v: string) => updateSection('security', k, v)
    return (
      <div style={S.section}>
        <div style={S.sectionTitle}>{STEP_ICONS[2]} Security</div>
        <div style={S.sectionSub}>Fencing and access control status</div>
        <div style={S.card}>
          <div style={{ fontWeight: 600, marginBottom: '14px', color: '#64748b', fontSize: '13px', textTransform: 'uppercase' }}>Perimeter Fencing</div>
          <SGroup label="Fencing Present">
            <SSelect value={s.fencing_present} onChange={(v) => set('fencing_present', v)} options={YN_OPTIONS} placeholder="Is fencing present?" />
          </SGroup>
          {s.fencing_present === 'yes' && (
            <>
              <SGroup label="Fencing Type">
                <SSelect value={s.fencing_type} onChange={(v) => set('fencing_type', v)}
                  options={[
                    { value: 'chain_link', label: 'Chain link' },
                    { value: 'wood', label: 'Wood' },
                    { value: 'vinyl', label: 'Vinyl/PVC' },
                    { value: 'concrete', label: 'Concrete wall' },
                    { value: 'metal_paling', label: 'Metal paling' },
                    { value: 'other', label: 'Other' },
                  ]}
                  placeholder="Select type…"
                />
              </SGroup>
              <SGroup label="Fencing Condition">
                <SSelect value={s.fencing_condition} onChange={(v) => set('fencing_condition', v)} options={CONDITION_OPTIONS} placeholder="Select condition…" />
              </SGroup>
              <SGroup label="Fencing Notes">
                <STextarea value={s.fencing_notes} onChange={(v) => set('fencing_notes', v)} placeholder="Gaps, damage, missing sections…" rows={2} />
              </SGroup>
            </>
          )}
        </div>
        <div style={S.card}>
          <div style={{ fontWeight: 600, marginBottom: '14px', color: '#64748b', fontSize: '13px', textTransform: 'uppercase' }}>Access Control</div>
          <SGroup label="Access Control Type">
            <SSelect value={s.access_control_type} onChange={(v) => set('access_control_type', v)}
              options={[
                { value: 'padlock', label: 'Padlock' },
                { value: 'electronic_keypad', label: 'Electronic keypad' },
                { value: 'key_fob', label: 'Key fob / card reader' },
                { value: 'biometric', label: 'Biometric' },
                { value: 'none', label: 'None' },
              ]}
              placeholder="Select type…"
            />
          </SGroup>
          <SGroup label="Access Control Condition">
            <SSelect value={s.access_control_condition} onChange={(v) => set('access_control_condition', v)} options={CONDITION_OPTIONS} placeholder="Select condition…" />
          </SGroup>
          <SGroup label="Gate Functional">
            <SSelect value={s.gate_functional} onChange={(v) => set('gate_functional', v)} options={YN_OPTIONS} placeholder="Is gate operational?" />
          </SGroup>
          <SGroup label="Access Notes">
            <STextarea value={s.access_control_notes} onChange={(v) => set('access_control_notes', v)} placeholder="Any issues with locks, codes, or entry…" rows={2} />
          </SGroup>
        </div>
      </div>
    )
  }

  function renderInfrastructure() {
    const i = draft.infra
    const set = (k: string, v: string) => updateSection('infra', k, v)
    return (
      <div style={S.section}>
        <div style={S.sectionTitle}>{STEP_ICONS[3]} Infrastructure</div>
        <div style={S.sectionSub}>On-site cabinet, networking and power equipment</div>
        <div style={S.card}>
          <div style={{ fontWeight: 600, marginBottom: '14px', color: '#64748b', fontSize: '13px', textTransform: 'uppercase' }}>Cabinet / Shelter</div>
          <SGroup label="Cabinet / Shelter Present">
            <SSelect value={i.cabinet_present} onChange={(v) => set('cabinet_present', v)} options={YN_OPTIONS} placeholder="Present?" />
          </SGroup>
          {i.cabinet_present === 'yes' && (
            <>
              <SGroup label="Cabinet Condition">
                <SSelect value={i.cabinet_condition} onChange={(v) => set('cabinet_condition', v)} options={CONDITION_OPTIONS} placeholder="Select condition…" />
              </SGroup>
              <SGroup label="Cooling / HVAC">
                <SSelect value={i.cooling} onChange={(v) => set('cooling', v)}
                  options={[
                    { value: 'ac_unit', label: 'AC unit' },
                    { value: 'fans', label: 'Fans only' },
                    { value: 'passive', label: 'Passive ventilation' },
                    { value: 'none', label: 'None' },
                  ]}
                  placeholder="Cooling type…"
                />
              </SGroup>
              <SGroup label="Power Supply">
                <SSelect value={i.power_supply} onChange={(v) => set('power_supply', v)}
                  options={[
                    { value: 'grid', label: 'Grid power' },
                    { value: 'grid_solar', label: 'Grid + Solar' },
                    { value: 'generator_only', label: 'Generator only' },
                    { value: 'solar_battery', label: 'Solar + Battery' },
                    { value: 'unknown', label: 'Unknown' },
                  ]}
                  placeholder="Power source…"
                />
              </SGroup>
            </>
          )}
        </div>
        <div style={S.card}>
          <div style={{ fontWeight: 600, marginBottom: '14px', color: '#64748b', fontSize: '13px', textTransform: 'uppercase' }}>Network Equipment</div>
          <SGroup label="Switch Present">
            <SSelect value={i.switch_present} onChange={(v) => set('switch_present', v)} options={YN_OPTIONS} placeholder="Switch present?" />
          </SGroup>
          {i.switch_present === 'yes' && (
            <SRow>
              <SGroup label="Switch Make">
                <SInput value={i.switch_make} onChange={(v) => set('switch_make', v)} placeholder="e.g. Cisco" />
              </SGroup>
              <SGroup label="Switch Model">
                <SInput value={i.switch_model} onChange={(v) => set('switch_model', v)} placeholder="e.g. C9300" />
              </SGroup>
            </SRow>
          )}
          <SGroup label="Router / Routing Gear Present">
            <SSelect value={i.routing_present} onChange={(v) => set('routing_present', v)} options={YN_OPTIONS} placeholder="Routing gear present?" />
          </SGroup>
          {i.routing_present === 'yes' && (
            <SRow>
              <SGroup label="Router Make">
                <SInput value={i.router_make} onChange={(v) => set('router_make', v)} placeholder="e.g. Juniper" />
              </SGroup>
              <SGroup label="Router Model">
                <SInput value={i.router_model} onChange={(v) => set('router_model', v)} placeholder="e.g. MX204" />
              </SGroup>
            </SRow>
          )}
          <SGroup label="Infrastructure Notes">
            <STextarea value={i.notes} onChange={(v) => set('notes', v)} placeholder="Any additional observations…" rows={2} />
          </SGroup>
        </div>
      </div>
    )
  }

  function renderGenerator() {
    const g = draft.generator
    const set = (k: string, v: string) => updateSection('generator', k, v)
    return (
      <div style={S.section}>
        <div style={S.sectionTitle}>{STEP_ICONS[4]} Generator</div>
        <div style={S.sectionSub}>Backup power equipment details</div>
        <div style={S.card}>
          <SGroup label="Generator Present">
            <SSelect value={g.present} onChange={(v) => set('present', v)} options={YN_OPTIONS} placeholder="Is a generator on site?" />
          </SGroup>
          {g.present === 'yes' && (
            <>
              <SRow>
                <SGroup label="Make">
                  <SInput value={g.make} onChange={(v) => set('make', v)} placeholder="e.g. Generac" />
                </SGroup>
                <SGroup label="Model">
                  <SInput value={g.model} onChange={(v) => set('model', v)} placeholder="e.g. XD5000E" />
                </SGroup>
              </SRow>
              <SRow>
                <SGroup label="kW Rating">
                  <SInput value={g.kw_rating} onChange={(v) => set('kw_rating', v)} placeholder="e.g. 50" type="text" />
                </SGroup>
                <SGroup label="Fuel Type">
                  <SSelect value={g.fuel_type} onChange={(v) => set('fuel_type', v)}
                    options={[
                      { value: 'diesel', label: 'Diesel' },
                      { value: 'gasoline', label: 'Gasoline' },
                      { value: 'propane', label: 'Propane' },
                      { value: 'natural_gas', label: 'Natural gas' },
                    ]}
                    placeholder="Fuel type…"
                  />
                </SGroup>
              </SRow>
              <SRow>
                <SGroup label="Condition">
                  <SSelect value={g.condition} onChange={(v) => set('condition', v)} options={CONDITION_OPTIONS} placeholder="Condition…" />
                </SGroup>
                <SGroup label="Fuel Level">
                  <SSelect value={g.fuel_level} onChange={(v) => set('fuel_level', v)}
                    options={[
                      { value: 'full', label: 'Full' },
                      { value: '3/4', label: '¾' },
                      { value: '1/2', label: '½' },
                      { value: '1/4', label: '¼' },
                      { value: 'empty', label: 'Empty' },
                    ]}
                    placeholder="Fuel level…"
                  />
                </SGroup>
              </SRow>
              <SGroup label="Last Service Date">
                <SInput value={g.last_service_date} onChange={(v) => set('last_service_date', v)} type="date" />
              </SGroup>
              <SGroup label="Generator Notes">
                <STextarea value={g.notes} onChange={(v) => set('notes', v)} placeholder="Any issues, servicing notes…" rows={2} />
              </SGroup>
            </>
          )}
        </div>
      </div>
    )
  }

  function renderPhotos() {
    const catPhotos = (cat: string) => photos.filter((p) => p.category === cat)
    return (
      <div style={S.section}>
        <div style={S.sectionTitle}>{STEP_ICONS[5]} Photos & Video</div>
        <div style={S.sectionSub}>Capture site conditions with your camera</div>

        <div style={S.card}>
          <SGroup label="Category">
            <SSelect value={photoCategory} onChange={setPhotoCategory} options={PHOTO_CATEGORIES} />
          </SGroup>
          <SGroup label="Caption (optional)">
            <SInput value={photoCaption} onChange={setPhotoCaption} placeholder="Describe what you're capturing…" />
          </SGroup>
          <div style={S.uploadArea}>
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>📷</div>
            <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '14px' }}>Take a photo or select from gallery</div>
            <button style={S.uploadBtn} onClick={() => fileInputRef.current?.click()} disabled={photoUploading}>
              {photoUploading ? '⏳ Uploading…' : '📸 Take / Select Photo'}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              capture="environment"
              style={{ display: 'none' }}
              onChange={handlePhotoSelect}
            />
          </div>
          {photoError && <p style={{ color: '#ef4444', fontSize: '13px' }}>{photoError}</p>}
        </div>

        {photos.length === 0 && (
          <div style={{ textAlign: 'center', padding: '24px', color: '#94a3b8' }}>No photos yet</div>
        )}

        {PHOTO_CATEGORIES.filter((c) => catPhotos(c.value).length > 0).map((cat) => (
          <div key={cat.value} style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#64748b', marginBottom: '8px', paddingLeft: '4px' }}>
              {cat.label} ({catPhotos(cat.value).length})
            </div>
            <div style={S.photoGrid}>
              {catPhotos(cat.value).map((photo) => (
                <div key={photo.id} style={S.photoThumb}>
                  {photo.public_url && photo.mime_type?.startsWith('video') ? (
                    <video src={photo.public_url} style={S.photoImg} />
                  ) : photo.public_url ? (
                    <img src={photo.public_url} alt={photo.caption ?? ''} style={S.photoImg} />
                  ) : (
                    <div style={{ ...S.photoImg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px' }}>📷</div>
                  )}
                  <button style={S.photoDelete} onClick={() => deletePhoto(photo.id)}>×</button>
                  {photo.caption && <span style={S.photoCatBadge}>{photo.caption.slice(0, 12)}</span>}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    )
  }

  function renderNotes() {
    const m = draft.maintenance
    const set = (k: string, v: string) => updateSection('maintenance', k, v)
    return (
      <div style={S.section}>
        <div style={S.sectionTitle}>{STEP_ICONS[6]} Maintenance & Notes</div>
        <div style={S.sectionSub}>Record any issues found and actions taken</div>
        <div style={S.card}>
          <div style={{ fontWeight: 600, marginBottom: '14px', color: '#64748b', fontSize: '13px', textTransform: 'uppercase' }}>Maintenance Record</div>
          <SGroup label="Issues Found">
            <STextarea value={m.issues_found} onChange={(v) => set('issues_found', v)} placeholder="List any issues identified during this visit…" rows={3} />
          </SGroup>
          <SGroup label="Actions Taken">
            <STextarea value={m.actions_taken} onChange={(v) => set('actions_taken', v)} placeholder="What was done on-site today…" rows={3} />
          </SGroup>
          <SRow>
            <SGroup label="Follow-up Required">
              <SSelect value={m.follow_up_required} onChange={(v) => set('follow_up_required', v)} options={YN_OPTIONS} placeholder="Follow-up needed?" />
            </SGroup>
            <SGroup label="Priority">
              <SSelect value={m.priority} onChange={(v) => set('priority', v)} options={PRIORITY_OPTIONS} placeholder="Priority…" />
            </SGroup>
          </SRow>
          <SGroup label="Additional Notes">
            <STextarea value={m.notes} onChange={(v) => set('notes', v)} placeholder="Any other observations…" rows={2} />
          </SGroup>
        </div>
        <div style={S.card}>
          <div style={{ fontWeight: 600, marginBottom: '14px', color: '#64748b', fontSize: '13px', textTransform: 'uppercase' }}>Overall Survey Notes</div>
          <STextarea
            value={draft.notes}
            onChange={(v) => setDraft((prev) => ({ ...prev, notes: v }))}
            placeholder="General notes about this site visit…"
            rows={4}
          />
        </div>
      </div>
    )
  }

  const stepContent = [renderLocation, renderTower, renderSecurity, renderInfrastructure, renderGenerator, renderPhotos, renderNotes]

  return (
    <div style={S.root}>
      {/* Admin preview banner */}
      {isAdminPreview && (
        <div style={{
          background: '#1e293b', color: '#e2e8f0', fontSize: '12px',
          padding: '7px 14px', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', gap: '8px',
        }}>
          <span>
            👁 <strong style={{ color: '#f8fafc' }}>{ROLE_LABELS[userRole ?? ''] ?? userRole}</strong>
            {' '}preview · Field workers see no financial or admin data
          </span>
          <button
            onClick={() => router.push('/dashboard')}
            style={{ background: '#3b82f6', border: 'none', color: 'white', borderRadius: '6px', padding: '4px 10px', fontSize: '11px', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}
          >
            ← Admin
          </button>
        </div>
      )}
      {/* Top bar */}
      <div style={S.topBar}>
        <div style={S.topRow}>
          <button style={S.backBtn} onClick={() => router.push('/field')}>← Back</button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={S.siteName}>{site.name}</div>
            <div style={S.siteCode}>{site.site_code} · {site.city}, {site.state}</div>
          </div>
          {saveMsg && (
            <span style={{ fontSize: '12px', color: '#86efac', fontWeight: 600 }}>{saveMsg}</span>
          )}
        </div>
        <div style={S.progressBar}><div style={S.progressFill} /></div>
      </div>

      {/* Step tabs */}
      <div style={S.tabs}>
        {STEPS.map((name, i) => (
          <button key={name} style={tabStyle(step === i)} onClick={() => setStep(i)}>
            {STEP_ICONS[i]} {name}
          </button>
        ))}
      </div>

      {/* Step content */}
      {stepContent[step]()}

      {/* Bottom bar */}
      <div style={S.bottomBar}>
        <button style={S.saveBtn} onClick={saveDraft} disabled={saving}>
          {saving ? 'Saving…' : '💾 Save Draft'}
        </button>
        {step < STEPS.length - 1 ? (
          <button style={{ ...S.completeBtn, background: '#1e3a5f' }} onClick={() => setStep((s) => s + 1)}>
            Next: {STEPS[step + 1]} →
          </button>
        ) : (
          <button style={S.completeBtn} onClick={completeSurvey} disabled={completing}>
            {completing ? 'Submitting…' : '✅ Complete Survey'}
          </button>
        )}
      </div>
    </div>
  )
}
