export const dynamic = 'force-dynamic'

import { getSupabase } from '@/lib/supabase'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Building2, User, MapPin, Pencil, Map } from 'lucide-react'
import TenantDeleteButton from '@/components/tenants/TenantDeleteButton'
import ContactsPanel from '@/components/contacts/ContactsPanel'
import LicenseeDocsPanel from '@/components/tenants/LicenseeDocsPanel'

const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)

const TENANCY_STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  active:        { bg: '#dcfce7', color: '#15803d' },
  pending:       { bg: '#e0f2fe', color: '#0369a1' },
  expiring_soon: { bg: '#fffbeb', color: '#b45309' },
  expired:       { bg: '#fee2e2', color: '#b91c1c' },
  terminated:    { bg: '#f1f5f9', color: '#475569' },
}

export default async function TenantDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ from?: string }>
}) {
  const { id } = await params
  const { from } = await searchParams
  const supabase = getSupabase()

  const [{ data: tenant }, { data: tenancies }, { data: contactRows }] = await Promise.all([
    supabase.from('licensees').select('*').eq('id', id).single(),
    supabase.from('site_licenses')
      .select('*, tower_sites(id, site_code, name, state, address, city, tower_type, height_ft)')
      .eq('licensee_id', id),
    supabase.from('contacts').select('*').eq('entity_type', 'licensee').eq('entity_id', id).order('contact_type'),
  ])

  // Collect unique sites this carrier has licenses on
  const siteMap: Record<string, { id: string; site_code: string; name: string; city: string; state: string }> = {}
  for (const t of tenancies ?? []) {
    const s = (t as any).tower_sites
    if (s?.id) siteMap[s.id] = { id: s.id, site_code: s.site_code, name: s.name, city: s.city, state: s.state }
  }
  const carrierSites = Object.values(siteMap)

  // Fetch ALL documents from every site this carrier has a license on
  let carrierDocs: any[] = []
  if (carrierSites.length > 0) {
    const { data: docsData } = await supabase
      .from('site_documents')
      .select('id, name, doc_type, file_size_kb, uploaded_at, doc_status, site_id')
      .in('site_id', carrierSites.map(s => s.id))
      .order('uploaded_at', { ascending: false })
    carrierDocs = docsData ?? []
  }

  if (!tenant) notFound()

  const all = tenancies ?? []
  const activeTenancies = all.filter(t => ['active', 'pending', 'expiring_soon'].includes(t.status))
  const totalRevenue = all.reduce((sum, t) => sum + Number(t.annual_rent), 0)

  return (
    <div style={{ padding: '32px', maxWidth: '1400px' }}>
      <Link
        href={from ?? '/tenants'}
        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#64748b', fontSize: '14px', textDecoration: 'none', marginBottom: '20px' }}
      >
        <ArrowLeft size={15} />
        {from?.startsWith('/sites/') ? 'Back to Site' : 'Back to Licensees'}
      </Link>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ background: '#eff6ff', borderRadius: '10px', padding: '12px' }}>
            <Building2 size={24} color="#2563eb" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
              <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#0f172a', margin: 0 }}>{tenant.name}</h1>
              <span style={{
                fontSize: '11px', fontWeight: 600, padding: '3px 8px', borderRadius: '12px',
                background: tenant.status === 'active' ? '#dcfce7' : '#f1f5f9',
                color: tenant.status === 'active' ? '#15803d' : '#475569',
              }}>
                {tenant.status === 'active' ? 'Active' : 'Inactive'}
              </span>
            </div>
            <div style={{ fontSize: '13px', color: '#64748b' }}>
              {activeTenancies.length} active license{activeTenancies.length !== 1 ? 's' : ''} · {fmt(totalRevenue)} annual revenue
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <Link href={`/map?licensee=${encodeURIComponent(tenant.name)}`} style={{ textDecoration: 'none' }}>
            <button style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'white', color: '#1a3a5c', border: '1px solid #e2e8f0', borderRadius: '7px', padding: '9px 16px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
              <Map size={14} /> View on Map
            </button>
          </Link>
          <Link href={`/tenants/${id}/edit`} style={{ textDecoration: 'none' }}>
            <button style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'white', color: '#1a3a5c', border: '1px solid #e2e8f0', borderRadius: '7px', padding: '9px 16px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
              <Pencil size={14} /> Edit Licensee
            </button>
          </Link>
          <TenantDeleteButton tenantId={id} tenantName={tenant.name} activeSiteCount={activeTenancies.length} />
        </div>
      </div>

      {/* Info cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '28px' }}>
        <Card title="Headquarters" icon={<MapPin size={15} color="#2563eb" />}>
          <InfoRow label="Address" value={tenant.hq_address || '—'} />
          <InfoRow label="City" value={tenant.hq_city || '—'} />
          <InfoRow label="State" value={tenant.hq_state || '—'} />
          <InfoRow label="ZIP" value={tenant.hq_zip || '—'} />
        </Card>
        <Card title="Primary Account Manager" icon={<User size={15} color="#2563eb" />}>
          <InfoRow label="Name" value={tenant.account_manager_name || '—'} />
          <InfoRow label="Email" value={tenant.account_manager_email || '—'} />
          <InfoRow label="Phone" value={tenant.account_manager_phone || '—'} />
          {tenant.notes && <InfoRow label="Notes" value={tenant.notes} />}
        </Card>
      </div>

      {/* Contacts */}
      {(contactRows ?? []).length > 0 && (
        <div style={{ marginBottom: '28px' }}>
          <ContactsPanel contacts={contactRows ?? []} />
        </div>
      )}

      {/* Documents Panel */}
      <LicenseeDocsPanel sites={carrierSites} documents={carrierDocs} />

      {/* Tenancies Table */}
      <div style={{ marginTop: '32px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a', marginBottom: '16px' }}>
          Tower Licenses ({all.length})
        </h2>
        {all.length > 0 ? (
          <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                  {['Site', 'Location', 'Mount Type', 'Annual Rent', 'Escalation', 'License Start', 'License End', 'Status'].map(h => (
                    <th key={h} style={{ padding: '9px 14px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {all.map((tenancy, i) => {
                  const site = (tenancy.tower_sites as any)
                  const statusStyle = TENANCY_STATUS_COLORS[tenancy.status] ?? { bg: '#f1f5f9', color: '#475569' }
                  const now = new Date()
                  const daysToExpiry = Math.round((new Date(tenancy.license_end).getTime() - now.getTime()) / 86400000)
                  return (
                    <tr key={tenancy.id} style={{ background: i % 2 === 0 ? 'white' : '#fafafa', borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '11px 14px' }}>
                        {site ? (
                          <Link href={`/sites/${site.id}`} style={{ fontWeight: 600, color: '#2563eb', textDecoration: 'none', fontSize: '13px' }}>
                            {site.site_code}
                          </Link>
                        ) : '—'}
                      </td>
                      <td style={{ padding: '11px 14px', fontSize: '13px', color: '#334155' }}>
                        {site ? `${site.city}, ${site.state}` : '—'}
                      </td>
                      <td style={{ padding: '11px 14px', fontSize: '13px', color: '#64748b' }}>{tenancy.mount_type}</td>
                      <td style={{ padding: '11px 14px', fontSize: '13px', fontWeight: 600, color: '#0f172a' }}>
                        {fmt(Number(tenancy.annual_rent))}
                      </td>
                      <td style={{ padding: '11px 14px', fontSize: '13px', color: '#64748b' }}>{tenancy.escalation_rate}%</td>
                      <td style={{ padding: '11px 14px', fontSize: '13px', color: '#64748b', whiteSpace: 'nowrap' }}>
                        {new Date(tenancy.license_start).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </td>
                      <td style={{ padding: '11px 14px', fontSize: '13px', whiteSpace: 'nowrap', color: daysToExpiry < 0 ? '#dc2626' : daysToExpiry <= 180 ? '#d97706' : '#334155', fontWeight: daysToExpiry <= 180 ? 600 : 400 }}>
                        {new Date(tenancy.license_end).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </td>
                      <td style={{ padding: '11px 14px' }}>
                        <span style={{ fontSize: '11px', fontWeight: 600, padding: '3px 8px', borderRadius: '12px', background: statusStyle.bg, color: statusStyle.color, whiteSpace: 'nowrap' }}>
                          {tenancy.status === 'expiring_soon' ? 'Expiring Soon' : tenancy.status.charAt(0).toUpperCase() + tenancy.status.slice(1)}
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
            No tower licenses for this licensee.
          </div>
        )}
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
