'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Building2, Clock, PlusCircle, MinusCircle, Edit3, AlertCircle, RefreshCw } from 'lucide-react'
import SiteDetailTenancies from './SiteDetailTenancies'
import SiteMediaGallery from './SiteMediaGallery'
import SiteDocsAndTerms from './SiteDocsAndTerms'
import SiteRevenueHistory from './SiteRevenueHistory'
import EquipmentPanel from './EquipmentPanel'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Props {
  site: any
  changes: any[]
  docs: any[]
  tenants: { id: string; name: string }[]
  allLicenses: any[]
  userCanEdit: boolean
  slots: number | null
  occupiedCount: number
  occupiedNames: string[]
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'overview',   label: 'Overview',     icon: '📋' },
  { id: 'licenses',   label: 'Licenses',     icon: '📄' },
  { id: 'equipment',  label: 'Equipment',    icon: '📡' },
  { id: 'documents',  label: 'Documents',    icon: '🗂️' },
  { id: 'media',      label: 'Media',        icon: '📷' },
  { id: 'audit',      label: 'Audit Trail',  icon: '🕐' },
]

const TYPE_LABELS: Record<string, string> = {
  monopole: 'Monopole', lattice: 'Lattice', rooftop: 'Rooftop',
  water_tower: 'Water Tower', guyed: 'Guyed', small_cell: 'Small Cell',
}

const FIELD_LABELS: Record<string, string> = {
  annual_rent: 'Annual Rent', status: 'Status', tenant_contact: 'Licensee Contact',
  license_end: 'License End Date', notes: 'Notes', escalation_rate: 'Escalation Rate',
  site_created: 'Site Created',
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function SiteDetailTabs({
  site, changes: initialChanges, docs, tenants, allLicenses, userCanEdit, slots, occupiedCount, occupiedNames,
}: Props) {
  const [activeTab, setActiveTab] = useState('overview')
  const [uploadingMedia, setUploadingMedia] = useState(false)
  const [auditEntries, setAuditEntries] = useState<any[]>(initialChanges)
  const [auditLoading, setAuditLoading] = useState(false)

  const refreshAudit = useCallback(async () => {
    setAuditLoading(true)
    try {
      const res = await fetch(`/api/sites/${site.id}/audit`)
      if (res.ok) setAuditEntries(await res.json())
    } finally {
      setAuditLoading(false)
    }
  }, [site.id])

  // Fetch fresh audit data whenever the audit tab is opened
  useEffect(() => {
    if (activeTab === 'audit') refreshAudit()
  }, [activeTab, refreshAudit])

  const occupancyPct = slots ? Math.min(100, (occupiedCount / slots) * 100) : null
  const barColor = occupancyPct === null ? '#3b82f6'
    : occupancyPct >= 100 ? '#16a34a'
    : occupancyPct >= 60  ? '#3b82f6'
    : '#d97706'

  const licenseOptions = tenants.map(t => ({ id: t.id, name: t.name }))

  return (
    <div>
      {/* ── Tab bar ─────────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', gap: '4px', flexWrap: 'wrap',
        background: 'white', border: '1px solid #e2e8f0', borderRadius: '10px',
        padding: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        marginBottom: '16px',
      }}>
        {TABS.map(tab => {
          const active = activeTab === tab.id
          // Show badge counts on certain tabs
          const badge = tab.id === 'licenses'  ? allLicenses.filter(l => ['active','pending','expiring_soon'].includes(l.status)).length
                      : tab.id === 'documents' ? docs.length
                      : tab.id === 'audit'     ? auditEntries.length
                      : null
          const showUploadDot = tab.id === 'media' && uploadingMedia && !active
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '8px 16px', borderRadius: '7px', border: 'none', cursor: 'pointer',
                fontSize: '13px', fontWeight: 600, transition: 'all 0.15s',
                background: active ? '#1a3a5c' : 'transparent',
                color: active ? 'white' : '#64748b',
              }}
            >
              <span style={{ fontSize: '14px' }}>{tab.icon}</span>
              {tab.label}
              {badge != null && badge > 0 && (
                <span style={{
                  fontSize: '10px', fontWeight: 700, minWidth: '18px', height: '18px',
                  borderRadius: '9px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: active ? 'rgba(255,255,255,0.25)' : '#e2e8f0',
                  color: active ? 'white' : '#475569', padding: '0 4px',
                }}>
                  {badge}
                </span>
              )}
              {showUploadDot && (
                <span style={{
                  width: '7px', height: '7px', borderRadius: '50%', background: '#f59e0b',
                  flexShrink: 0, animation: 'pulse 1.2s ease-in-out infinite',
                }} />
              )}
            </button>
          )
        })}
      </div>

      {/* ── Tab content — all panels stay mounted; only visibility changes ── */}

      {/* OVERVIEW */}
      <div style={{ display: activeTab === 'overview' ? 'flex' : 'none', flexDirection: 'column', gap: '16px' }}>
          {/* Site Details card */}
          <SCard title="Site Details" icon={<Building2 size={16} color="#2563eb" />}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0' }}>
              <InfoRow label="Tower Type" value={TYPE_LABELS[site.tower_type] || site.tower_type || '—'} />
              {site.height_ft && <InfoRow label="Height" value={`${site.height_ft} ft`} />}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f8fafc', fontSize: '13px' }}>
                <span style={{ color: '#64748b' }}>Host Agency</span>
                {site.state_agencies ? (
                  <Link href={`/owners/${site.state_agencies.id}`} style={{ fontWeight: 500, color: '#2563eb', textDecoration: 'none' }}>
                    {site.state_agencies.name}
                  </Link>
                ) : (
                  <span style={{ fontWeight: 500, color: '#0f172a' }}>—</span>
                )}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f8fafc', fontSize: '13px' }}>
                <span style={{ color: '#64748b' }}>Coordinates</span>
                {site.lat != null && site.lng != null ? (
                  <Link
                    href={`/map?lat=${site.lat}&lng=${site.lng}&site=${site.site_code}`}
                    style={{ fontWeight: 500, color: '#2563eb', textDecoration: 'none', fontFamily: 'monospace' }}
                  >
                    {Number(site.lat).toFixed(4)}, {Number(site.lng).toFixed(4)} ↗
                  </Link>
                ) : (
                  <span style={{ fontWeight: 500, color: '#94a3b8' }}>—</span>
                )}
              </div>
            </div>

            {/* Occupancy */}
            <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #f1f5f9' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#475569' }}>Tenant Occupancy</span>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>
                  {occupiedCount} occupied{slots ? ` of ${slots} slots` : ''}
                  {slots && occupiedCount < slots ? (
                    <span style={{ fontWeight: 400, color: '#16a34a', marginLeft: '6px' }}>· {slots - occupiedCount} available</span>
                  ) : slots && occupiedCount >= slots ? (
                    <span style={{ fontWeight: 600, color: '#dc2626', marginLeft: '6px' }}>· Full</span>
                  ) : null}
                </span>
              </div>
              {slots && (
                <div style={{ height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden', marginBottom: '12px' }}>
                  <div style={{ height: '100%', width: `${occupancyPct}%`, background: barColor, borderRadius: '4px', transition: 'width 0.4s ease' }} />
                </div>
              )}
              {occupiedNames.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {allLicenses
                    .filter((l: any) => ['active','pending','expiring_soon'].includes(l.status))
                    .map((l: any) => (
                      <Link
                        key={l.id}
                        href={`/tenants/${l.licensee_id}?from=/sites/${site.id}`}
                        style={{ fontSize: '12px', fontWeight: 500, padding: '3px 10px', borderRadius: '20px', background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', textDecoration: 'none', transition: 'background 0.15s' }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#dbeafe')}
                        onMouseLeave={e => (e.currentTarget.style.background = '#eff6ff')}
                      >
                        {l.licensees?.name ?? l.name ?? 'Unknown'}
                      </Link>
                    ))
                  }
                </div>
              )}
              {occupiedCount === 0 && <p style={{ fontSize: '13px', color: '#94a3b8', margin: 0 }}>No active tenants</p>}
            </div>
          </SCard>

          {/* Site notes */}
          {site.notes && (
            <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: '8px', padding: '14px 16px', fontSize: '14px', color: '#92400e' }}>
              <strong>Note:</strong> {site.notes}
            </div>
          )}

          {/* Revenue history */}
          <SiteRevenueHistory licenses={allLicenses.map((l: any) => ({
            id: l.id,
            licensee_name: l.licensees?.name ?? 'Unknown',
            annual_rent: Number(l.annual_rent ?? 0),
            license_start: l.license_start ?? null,
            license_end: l.license_end ?? null,
            status: l.status,
          }))} />
      </div>

      {/* LICENSES */}
      <div style={{ display: activeTab === 'licenses' ? 'block' : 'none' }}>
        <SiteDetailTenancies siteId={site.id} tenants={tenants} tenantSlots={slots} />
      </div>

      {/* EQUIPMENT */}
      <div style={{ display: activeTab === 'equipment' ? 'block' : 'none' }}>
        <EquipmentPanel siteId={site.id} licenses={licenseOptions} />
      </div>

      {/* DOCUMENTS */}
      <div style={{ display: activeTab === 'documents' ? 'block' : 'none' }}>
        <SiteDocsAndTerms siteId={site.id} initialDocs={docs} canEdit={userCanEdit} />
      </div>

      {/* MEDIA — always mounted so uploads survive tab switches */}
      <div style={{ display: activeTab === 'media' ? 'block' : 'none', background: 'white', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <SiteMediaGallery siteId={site.id} onUploadingChange={setUploadingMedia} />
      </div>

      {/* AUDIT TRAIL */}
      <div style={{ display: activeTab === 'audit' ? 'block' : 'none' }}>
        <SCard
          title={`Audit Trail (${auditEntries.length} entries)`}
          icon={<Clock size={16} color="#2563eb" />}
          action={
            <button
              onClick={refreshAudit}
              disabled={auditLoading}
              style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'none', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '4px 10px', fontSize: '12px', color: '#64748b', cursor: auditLoading ? 'default' : 'pointer' }}
            >
              <RefreshCw size={12} style={{ animation: auditLoading ? 'spin 1s linear infinite' : 'none' }} />
              {auditLoading ? 'Refreshing…' : 'Refresh'}
            </button>
          }
        >
          {auditLoading && auditEntries.length === 0 ? (
            <div style={{ fontSize: '13px', color: '#94a3b8' }}>Loading…</div>
          ) : auditEntries.length > 0 ? auditEntries.map(c => {
            const isFailed = c.field_name === 'media_upload_failed'
            const isAdd    = !isFailed && (c.field_name === 'license_added' || c.field_name === 'site_created' || c.field_name === 'media_uploaded')
            const isRemove = !isFailed && (c.field_name === 'license_removed' || c.field_name === 'media_deleted')
            const isUpdate = !isAdd && !isRemove && !isFailed
            const dotColor   = isFailed ? '#d97706' : isAdd ? '#16a34a' : isRemove ? '#dc2626' : '#2563eb'
            const badgeBg    = isFailed ? '#fffbeb' : isAdd ? '#dcfce7' : isRemove ? '#fee2e2' : '#eff6ff'
            const badgeColor = isFailed ? '#b45309' : isAdd ? '#15803d' : isRemove ? '#b91c1c' : '#1d4ed8'
            const badgeLabel = isFailed ? 'Failed'  : isAdd ? 'Added'   : isRemove ? 'Removed' : 'Updated'
            const BadgeIcon  = isFailed ? AlertCircle : isAdd ? PlusCircle : isRemove ? MinusCircle : Edit3

            let description = ''
            if (c.field_name === 'site_created')          description = `Site created (${c.new_value ?? ''})`
            else if (c.field_name === 'license_added')    description = `License added: ${c.new_value ?? ''}`
            else if (c.field_name === 'license_removed')  description = `License removed: ${c.old_value ?? ''}`
            else if (c.field_name === 'media_uploaded')   description = `File uploaded: ${c.new_value ?? ''}`
            else if (c.field_name === 'media_deleted')    description = `File deleted: ${c.old_value ?? ''}`
            else if (c.field_name === 'media_upload_failed') description = `Upload failed: ${c.new_value ?? ''}`
            else description = FIELD_LABELS[c.field_name] || c.field_name

            return (
              <div key={c.id} style={{ display: 'flex', gap: '12px', padding: '10px 0', borderBottom: '1px solid #f1f5f9', alignItems: 'flex-start' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: dotColor, marginTop: '5px', flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 7px', borderRadius: '10px', background: badgeBg, color: badgeColor, display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                      <BadgeIcon size={10} /> {badgeLabel}
                    </span>
                    <span style={{ fontSize: '13px', color: '#0f172a', fontWeight: 500 }}>{description}</span>
                  </div>
                  {isUpdate && c.old_value != null && c.new_value != null && (
                    <div style={{ marginTop: '3px', fontSize: '12px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ background: '#fee2e2', color: '#b91c1c', padding: '1px 6px', borderRadius: '4px', fontFamily: 'monospace' }}>{c.old_value}</span>
                      <span>→</span>
                      <span style={{ background: '#dcfce7', color: '#15803d', padding: '1px 6px', borderRadius: '4px', fontFamily: 'monospace' }}>{c.new_value}</span>
                    </div>
                  )}
                  <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '3px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ fontWeight: 500, color: '#64748b' }}>{c.changed_by}</span>
                    <span>·</span>
                    <span>{new Date(c.changed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>
              </div>
            )
          }) : <div style={{ fontSize: '13px', color: '#94a3b8' }}>No changes recorded yet.</div>}
        </SCard>
      </div>

    </div>
  )
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function SCard({ title, icon, children, action }: { title: string; icon: React.ReactNode; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', paddingBottom: '12px', borderBottom: '1px solid #f1f5f9' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {icon}
          <span style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a' }}>{title}</span>
        </div>
        {action}
      </div>
      {children}
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f8fafc', fontSize: '13px' }}>
      <span style={{ color: '#64748b' }}>{label}</span>
      <span style={{ fontWeight: 500, color: '#0f172a' }}>{value}</span>
    </div>
  )
}
