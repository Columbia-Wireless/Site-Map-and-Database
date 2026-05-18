export const dynamic = 'force-dynamic'

import { getSupabase } from '@/lib/supabase'
import { getProfile, canEdit } from '@/lib/profile'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, MapPin } from 'lucide-react'
import SiteDetailTabs from '@/components/sites/SiteDetailTabs'

export default async function SiteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = getSupabase()

  const [{ data: site }, { data: changes }, { data: docs }, { data: tenants }, { data: activeLicenses }, profile] = await Promise.all([
    supabase.from('tower_sites').select('*, state_agencies(id, name)').eq('id', id).single(),
    supabase.from('site_change_log').select('*').eq('site_id', id).order('changed_at', { ascending: false }),
    supabase.from('site_documents').select('*').eq('site_id', id).order('uploaded_at', { ascending: false }),
    supabase.from('licensees').select('id, name').order('name'),
    supabase.from('site_licenses').select('id, status, annual_rent, license_start, license_end, licensee_id, licensees(name)').eq('site_id', id).order('license_start', { ascending: true }),
    getProfile(),
  ])

  if (!site) notFound()

  const userCanEdit = canEdit(profile)
  const allLicenses = activeLicenses ?? []
  const occupiedCount = allLicenses.filter(l => ['active', 'pending', 'expiring_soon'].includes(l.status)).length
  const occupiedNames = allLicenses
    .filter(l => ['active', 'pending', 'expiring_soon'].includes(l.status))
    .map(l => (l as any).licensees?.name as string | undefined)
    .filter(Boolean) as string[]
  const slots: number | null = (site as any).tenant_slots ?? null

  return (
    <div style={{ padding: '32px', maxWidth: '1200px' }}>
      <Link href="/sites" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#64748b', fontSize: '14px', textDecoration: 'none', marginBottom: '20px' }}>
        <ArrowLeft size={15} /> Back to Portfolio
      </Link>

      {/* Site header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#2563eb' }}>{site.site_code}</span>
            <span style={{ fontSize: '11px', fontWeight: 600, padding: '3px 8px', borderRadius: '12px', background: site.status === 'operational' ? '#dcfce7' : '#f1f5f9', color: site.status === 'operational' ? '#15803d' : '#475569' }}>
              {site.status === 'under_construction' ? 'Under Construction' : site.status.charAt(0).toUpperCase() + site.status.slice(1)}
            </span>
          </div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#0f172a', margin: '0 0 4px' }}>{site.name}</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#64748b', fontSize: '14px' }}>
            <MapPin size={14} />
            {site.address}, {site.city}, {site.state} {site.zip}
          </div>
        </div>
        {userCanEdit && (
          <Link
            href={`/sites/${id}/edit`}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#1a3a5c', color: 'white', padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, textDecoration: 'none' }}
          >
            Edit Site
          </Link>
        )}
      </div>

      {/* Tabbed content */}
      <SiteDetailTabs
        site={site}
        changes={changes ?? []}
        docs={docs ?? []}
        tenants={tenants ?? []}
        allLicenses={allLicenses}
        userCanEdit={userCanEdit}
        slots={slots}
        occupiedCount={occupiedCount}
        occupiedNames={occupiedNames}
      />
    </div>
  )
}
