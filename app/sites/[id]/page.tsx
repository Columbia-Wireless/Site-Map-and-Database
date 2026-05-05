export const dynamic = 'force-dynamic'

import { getSupabase } from '@/lib/supabase'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, MapPin, Building2, Calendar, DollarSign, User, FileText, Clock } from 'lucide-react'

const STATUS_LABELS: Record<string, string> = {
  active: 'Active', expiring_soon: 'Expiring Soon', expired: 'Expired', disputed: 'Disputed', pending: 'Pending',
}
const TYPE_LABELS: Record<string, string> = {
  monopole: 'Monopole', lattice: 'Lattice', rooftop: 'Rooftop',
  water_tower: 'Water Tower', guyed: 'Guyed', small_cell: 'Small Cell',
}
const DOC_LABELS: Record<string, string> = {
  lease: 'Lease Agreement', amendment: 'Amendment', survey: 'Survey',
  permit: 'Permit', correspondence: 'Correspondence', other: 'Other',
}
const FIELD_LABELS: Record<string, string> = {
  annual_rent: 'Annual Rent', status: 'Status', tenant_contact: 'Tenant Contact',
  lease_end: 'Lease End Date', notes: 'Notes', escalation_rate: 'Escalation Rate',
}

const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)

export default async function SiteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = getSupabase()

  const [{ data: site }, { data: changes }, { data: docs }] = await Promise.all([
    supabase.from('tower_sites').select('*').eq('id', id).single(),
    supabase.from('site_change_log').select('*').eq('site_id', id).order('changed_at', { ascending: false }),
    supabase.from('site_documents').select('*').eq('site_id', id).order('uploaded_at', { ascending: false }),
  ])

  if (!site) notFound()

  const leaseYears = ((new Date(site.lease_end).getTime() - new Date(site.lease_start).getTime()) / (365.25 * 86400000)).toFixed(1)
  const daysToExpiry = Math.round((new Date(site.lease_end).getTime() - Date.now()) / 86400000)

  return (
    <div style={{ padding: '32px', maxWidth: '1200px' }}>
      {/* Back */}
      <Link href="/sites" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#64748b', fontSize: '14px', textDecoration: 'none', marginBottom: '20px' }}>
        <ArrowLeft size={15} /> Back to Portfolio
      </Link>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#2563eb' }}>{site.site_code}</span>
            <span className={`status-${site.status}`} style={{ fontSize: '11px', fontWeight: 600, padding: '3px 8px', borderRadius: '12px' }}>
              {STATUS_LABELS[site.status]}
            </span>
          </div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#0f172a', margin: '0 0 4px' }}>{site.name}</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#64748b', fontSize: '14px' }}>
            <MapPin size={14} />
            {site.address}, {site.city}, {site.state} {site.zip}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '28px', fontWeight: 700, color: '#0f172a' }}>{fmt(Number(site.annual_rent))}</div>
          <div style={{ fontSize: '12px', color: '#94a3b8' }}>per year · {site.escalation_rate}% escalation</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
        {/* Lease Details */}
        <Card title="Lease Details" icon={<Calendar size={16} color="#2563eb" />}>
          <InfoRow label="Lease Start" value={new Date(site.lease_start).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} />
          <InfoRow label="Lease End" value={new Date(site.lease_end).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} />
          <InfoRow label="Term" value={`${leaseYears} years`} />
          <InfoRow
            label="Days to Expiry"
            value={daysToExpiry < 0 ? 'Expired' : `${daysToExpiry} days`}
            highlight={daysToExpiry < 180 && daysToExpiry >= 0 ? 'warning' : daysToExpiry < 0 ? 'danger' : undefined}
          />
          <InfoRow label="Annual Rent" value={fmt(Number(site.annual_rent))} />
          <InfoRow label="Escalation Rate" value={`${site.escalation_rate}%`} />
        </Card>

        {/* Site & Tenant */}
        <Card title="Site & Tenant" icon={<Building2 size={16} color="#2563eb" />}>
          <InfoRow label="Tower Type" value={TYPE_LABELS[site.tower_type] || site.tower_type} />
          {site.height_ft && <InfoRow label="Height" value={`${site.height_ft} ft`} />}
          <InfoRow label="Tenant" value={site.tenant_name} />
          <InfoRow label="Contact" value={site.tenant_contact || '—'} />
          <InfoRow label="Email" value={site.tenant_email || '—'} />
          <InfoRow label="Property Owner" value={site.owner_name || '—'} />
        </Card>
      </div>

      {site.notes && (
        <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: '8px', padding: '14px 16px', marginBottom: '16px', fontSize: '14px', color: '#92400e' }}>
          <strong>Note:</strong> {site.notes}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        {/* Documents */}
        <Card title={`Documents (${docs?.length ?? 0})`} icon={<FileText size={16} color="#2563eb" />}>
          {docs && docs.length > 0 ? docs.map(doc => (
            <div key={doc.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 500, color: '#0f172a' }}>{doc.name}</div>
                <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                  {DOC_LABELS[doc.doc_type]} · {doc.uploaded_by} · {new Date(doc.uploaded_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                </div>
              </div>
              <div style={{ fontSize: '11px', color: '#94a3b8', flexShrink: 0 }}>{(doc.file_size_kb / 1024).toFixed(1)} MB</div>
            </div>
          )) : <div style={{ fontSize: '13px', color: '#94a3b8' }}>No documents on file.</div>}
        </Card>

        {/* Change Log */}
        <Card title={`Change Log (${changes?.length ?? 0} entries)`} icon={<Clock size={16} color="#2563eb" />}>
          {changes && changes.length > 0 ? changes.map(c => (
            <div key={c.id} style={{ display: 'flex', gap: '10px', padding: '8px 0', borderBottom: '1px solid #f1f5f9', alignItems: 'flex-start' }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#2563eb', marginTop: '6px', flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '13px', color: '#0f172a' }}>
                  <strong>{FIELD_LABELS[c.field_name] || c.field_name}</strong> changed
                  {c.old_value && c.new_value && (
                    <span style={{ color: '#64748b' }}>: {c.old_value} → {c.new_value}</span>
                  )}
                </div>
                <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                  {c.changed_by} · {new Date(c.changed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
          )) : <div style={{ fontSize: '13px', color: '#94a3b8' }}>No changes recorded.</div>}
        </Card>
      </div>
    </div>
  )
}

function Card({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px', paddingBottom: '12px', borderBottom: '1px solid #f1f5f9' }}>
        {icon}
        <span style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a' }}>{title}</span>
      </div>
      {children}
    </div>
  )
}

function InfoRow({ label, value, highlight }: { label: string; value: string; highlight?: 'warning' | 'danger' }) {
  const color = highlight === 'danger' ? '#dc2626' : highlight === 'warning' ? '#d97706' : '#0f172a'
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f8fafc', fontSize: '13px' }}>
      <span style={{ color: '#64748b' }}>{label}</span>
      <span style={{ fontWeight: 500, color }}>{value}</span>
    </div>
  )
}
