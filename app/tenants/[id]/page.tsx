export const dynamic = 'force-dynamic'

import { getSupabase } from '@/lib/supabase'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Building2, User, MapPin, Pencil, Trash2 } from 'lucide-react'
import SiteTable from '@/components/sites/SiteTable'
import TenantDeleteButton from '@/components/tenants/TenantDeleteButton'

const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)

export default async function TenantDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = getSupabase()

  const [{ data: tenant }, { data: sites }] = await Promise.all([
    supabase.from('tenants').select('*').eq('id', id).single(),
    supabase.from('tower_sites').select('*').eq('tenant_id', id).order('site_code'),
  ])

  if (!tenant) notFound()

  const activeSites = (sites ?? []).filter(s => ['active','pending','expiring_soon'].includes(s.status))
  const totalRevenue = (sites ?? []).reduce((sum, s) => sum + Number(s.annual_rent), 0)

  return (
    <div style={{ padding: '32px', maxWidth: '1400px' }}>
      <Link href="/tenants" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#64748b', fontSize: '14px', textDecoration: 'none', marginBottom: '20px' }}>
        <ArrowLeft size={15} /> Back to Tenants
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
              {activeSites.length} active site{activeSites.length !== 1 ? 's' : ''} · {fmt(totalRevenue)} annual revenue
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <Link href={`/tenants/${id}/edit`} style={{ textDecoration: 'none' }}>
            <button style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              background: 'white', color: '#1a3a5c', border: '1px solid #e2e8f0',
              borderRadius: '7px', padding: '9px 16px', fontSize: '13px',
              fontWeight: 600, cursor: 'pointer',
            }}>
              <Pencil size={14} /> Edit Tenant
            </button>
          </Link>
          <TenantDeleteButton tenantId={id} tenantName={tenant.name} activeSiteCount={activeSites.length} />
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

      {/* Sites */}
      <div>
        <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a', marginBottom: '16px' }}>
          Contracted Sites ({sites?.length ?? 0})
        </h2>
        {sites && sites.length > 0
          ? <SiteTable sites={sites} />
          : (
            <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '48px', textAlign: 'center', color: '#94a3b8', fontSize: '14px' }}>
              No sites currently assigned to this tenant.
            </div>
          )
        }
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
