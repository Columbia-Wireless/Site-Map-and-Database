export const dynamic = 'force-dynamic'

import { getSupabase } from '@/lib/supabase'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Landmark, MapPin, User, Phone, Mail, DollarSign,
  AlertTriangle, TrendingUp, Building2, Pencil, Download,
} from 'lucide-react'
import { getProfile, canExport } from '@/lib/profile'
import OwnerDeleteButton from '@/components/owners/OwnerDeleteButton'
import ContactsPanel from '@/components/contacts/ContactsPanel'
import AuditDrawer from '@/components/shared/AuditDrawer'

const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)

const TYPE_LABELS: Record<string, string> = {
  corporate: 'Corporate / Private Equity',
  municipality: 'Municipality / Local Government',
  state: 'State Government',
  federal: 'Federal Government',
  utility: 'Utility Company',
  private: 'Private Individual',
  nonprofit: 'Nonprofit Organization',
  other: 'Other',
}

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  operational:       { bg: '#dcfce7', color: '#15803d' },
  offline:           { bg: '#fee2e2', color: '#b91c1c' },
  under_construction:{ bg: '#fffbeb', color: '#b45309' },
  decommissioned:    { bg: '#f1f5f9', color: '#475569' },
}

export default async function OwnerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = getSupabase()

  const profile = await getProfile()
  const userCanExport = canExport(profile)

  const [{ data: owner }, { data: sites }, { data: contactRows }] = await Promise.all([
    supabase.from('state_agencies').select('*').eq('id', id).single(),
    supabase
      .from('tower_sites')
      .select('id, site_code, name, city, state, tower_type, status, site_licenses(id, annual_rent, license_end, status, licensees(name))')
      .eq('host_agency_id', id)
      .order('site_code'),
    supabase.from('contacts').select('*').eq('entity_type', 'owner').eq('entity_id', id).order('contact_type'),
  ])

  if (!owner) notFound()

  const allSites = sites ?? []

  // ── KPI calculations ──────────────────────────────────────────────────────
  const now = new Date()
  let totalRevenue = 0
  let occupiedCount = 0
  let expiringCount = 0

  const enrichedSites = allSites.map((site: any) => {
    const tenancies: any[] = site.site_licenses ?? []
    const activeTs = tenancies.filter((t: any) =>
      ['active', 'pending', 'expiring_soon'].includes(t.status)
    )
    const revenue = activeTs.reduce((s: number, t: any) => s + Number(t.annual_rent), 0)
    totalRevenue += revenue
    if (activeTs.length > 0) occupiedCount++
    const expiring = tenancies.filter((t: any) => {
      if (!['active', 'pending', 'expiring_soon'].includes(t.status)) return false
      const days = (new Date(t.license_end).getTime() - now.getTime()) / 86400000
      return days >= 0 && days <= 90
    }).length
    expiringCount += expiring
    return { ...site, revenue, tenancy_count: tenancies.length, active_count: activeTs.length }
  })

  const vacantCount = allSites.length - occupiedCount

  return (
    <div style={{ padding: '32px', maxWidth: '1300px' }}>
      <Link href="/owners" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#64748b', fontSize: '14px', textDecoration: 'none', marginBottom: '20px' }}>
        <ArrowLeft size={15} /> Back to Host Agencies
      </Link>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ background: '#eff6ff', borderRadius: '10px', padding: '12px' }}>
            <Landmark size={24} color="#2563eb" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
              <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#0f172a', margin: 0 }}>{owner.name}</h1>
              <span style={{
                fontSize: '11px', fontWeight: 600, padding: '3px 8px', borderRadius: '12px',
                background: owner.status === 'active' ? '#dcfce7' : '#f1f5f9',
                color: owner.status === 'active' ? '#15803d' : '#475569',
              }}>
                {owner.status === 'active' ? 'Active' : 'Inactive'}
              </span>
            </div>
            <div style={{ fontSize: '13px', color: '#64748b' }}>
              {TYPE_LABELS[owner.type] ?? owner.type} · {allSites.length} site{allSites.length !== 1 ? 's' : ''}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {userCanExport && (
            <a
              href={`/api/export/agency/${id}`}
              download
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0', borderRadius: '7px', padding: '9px 16px', fontSize: '13px', fontWeight: 600, textDecoration: 'none' }}
            >
              <Download size={14} /> Export CSV
            </a>
          )}
          <AuditDrawer entityId={id} entityType="owner" />
          <Link href={`/owners/${id}/edit`} style={{ textDecoration: 'none' }}>
            <button style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'white', color: '#1a3a5c', border: '1px solid #e2e8f0', borderRadius: '7px', padding: '9px 16px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
              <Pencil size={14} /> Edit Agency
            </button>
          </Link>
          <OwnerDeleteButton ownerId={id} ownerName={owner.name} siteCount={allSites.length} />
        </div>
      </div>

      {/* KPI mini-dashboard */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', marginBottom: '24px' }}>
        <KpiCard
          label="Annual Revenue"
          value={fmt(totalRevenue)}
          sub="from active licenses"
          icon={<DollarSign size={18} color="#2563eb" />}
          bg="#eff6ff"
        />
        <KpiCard
          label="Occupied / Total"
          value={`${occupiedCount} / ${allSites.length}`}
          sub={`${vacantCount} vacant`}
          icon={<MapPin size={18} color="#16a34a" />}
          bg="#f0fdf4"
        />
        <KpiCard
          label="Expiring ≤ 90 Days"
          value={String(expiringCount)}
          sub="licenses needing action"
          icon={<AlertTriangle size={18} color="#d97706" />}
          bg="#fffbeb"
          alert={expiringCount > 0}
        />
        <KpiCard
          label="Avg. Revenue / Site"
          value={allSites.length > 0 ? fmt(totalRevenue / allSites.length) : '—'}
          sub="across all sites"
          icon={<TrendingUp size={18} color="#7c3aed" />}
          bg="#f5f3ff"
        />
      </div>

      {/* Info cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '28px' }}>
        <Card title="Contact Information" icon={<User size={15} color="#2563eb" />}>
          {owner.contact_name && <InfoRow label="Contact" value={owner.contact_name} />}
          {owner.contact_email && <InfoRow label="Email" value={owner.contact_email} />}
          {owner.contact_phone && <InfoRow label="Phone" value={owner.contact_phone} />}
          {!owner.contact_name && !owner.contact_email && !owner.contact_phone && (
            <div style={{ fontSize: '13px', color: '#94a3b8' }}>No contact information on file.</div>
          )}
        </Card>
        <Card title="Address" icon={<MapPin size={15} color="#2563eb" />}>
          {owner.address && <InfoRow label="Street" value={owner.address} />}
          {owner.city && <InfoRow label="City" value={owner.city} />}
          {owner.state && <InfoRow label="State" value={owner.state} />}
          {owner.zip && <InfoRow label="ZIP" value={owner.zip} />}
          {!owner.address && !owner.city && !owner.state && (
            <div style={{ fontSize: '13px', color: '#94a3b8' }}>No address on file.</div>
          )}
        </Card>
      </div>

      {owner.notes && (
        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', padding: '14px 16px', marginBottom: '24px', fontSize: '13px', color: '#78350f' }}>
          <strong>Notes: </strong>{owner.notes}
        </div>
      )}

      {/* Contacts */}
      {(contactRows ?? []).length > 0 && (
        <div style={{ marginBottom: '28px' }}>
          <ContactsPanel contacts={contactRows ?? []} />
        </div>
      )}

      {/* Sites table */}
      <div>
        <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a', marginBottom: '16px' }}>
          Sites ({allSites.length})
        </h2>
        {enrichedSites.length > 0 ? (
          <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                  {['Site Code', 'Name', 'Location', 'Type', 'Licensees', 'Annual Revenue', 'Status'].map(h => (
                    <th key={h} style={{ padding: '9px 14px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {enrichedSites.map((site: any, i: number) => {
                  const st = STATUS_COLORS[site.status] ?? STATUS_COLORS.offline
                  return (
                    <tr key={site.id} style={{ background: i % 2 === 0 ? 'white' : '#fafafa', borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '11px 14px' }}>
                        <Link href={`/sites/${site.id}`} style={{ fontWeight: 600, color: '#2563eb', textDecoration: 'none', fontSize: '13px' }}>
                          {site.site_code}
                        </Link>
                      </td>
                      <td style={{ padding: '11px 14px', fontSize: '13px', color: '#334155', fontWeight: 500 }}>{site.name}</td>
                      <td style={{ padding: '11px 14px', fontSize: '13px', color: '#64748b' }}>
                        {[site.city, site.state].filter(Boolean).join(', ') || '—'}
                      </td>
                      <td style={{ padding: '11px 14px', fontSize: '13px', color: '#64748b', textTransform: 'capitalize' }}>
                        {site.tower_type?.replace('_', ' ') ?? '—'}
                      </td>
                      <td style={{ padding: '11px 14px', fontSize: '13px', color: '#334155' }}>
                        {site.active_count > 0 ? (
                          <span style={{ fontWeight: 600 }}>{site.active_count}</span>
                        ) : (
                          <span style={{ color: '#f59e0b', fontWeight: 600 }}>Vacant</span>
                        )}
                        {site.tenancy_count > site.active_count && (
                          <span style={{ color: '#94a3b8', fontSize: '12px' }}> / {site.tenancy_count}</span>
                        )}
                      </td>
                      <td style={{ padding: '11px 14px', fontSize: '13px', fontWeight: 600, color: site.revenue > 0 ? '#0f172a' : '#94a3b8' }}>
                        {site.revenue > 0 ? fmt(site.revenue) : '—'}
                      </td>
                      <td style={{ padding: '11px 14px' }}>
                        <span style={{ fontSize: '11px', fontWeight: 600, padding: '3px 8px', borderRadius: '12px', background: st.bg, color: st.color, whiteSpace: 'nowrap' }}>
                          {site.status === 'under_construction' ? 'Under Construction' : site.status.charAt(0).toUpperCase() + site.status.slice(1)}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '48px', textAlign: 'center', color: '#94a3b8', fontSize: '14px' }}>
            No sites assigned to this agency yet.
          </div>
        )}
      </div>
    </div>
  )
}

function KpiCard({ label, value, sub, icon, bg, alert }: {
  label: string; value: string; sub: string; icon: React.ReactNode; bg: string; alert?: boolean
}) {
  return (
    <div style={{ background: 'white', border: `1px solid ${alert ? '#fbbf24' : '#e2e8f0'}`, borderRadius: '10px', padding: '18px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 500, marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
          <div style={{ fontSize: '22px', fontWeight: 700, color: '#0f172a' }}>{value}</div>
          <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '3px' }}>{sub}</div>
        </div>
        <div style={{ background: bg, borderRadius: '8px', padding: '7px' }}>{icon}</div>
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

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f8fafc', fontSize: '13px' }}>
      <span style={{ color: '#64748b' }}>{label}</span>
      <span style={{ fontWeight: 500, color: '#0f172a' }}>{value}</span>
    </div>
  )
}
