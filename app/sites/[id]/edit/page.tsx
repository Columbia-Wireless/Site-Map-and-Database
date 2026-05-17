export const dynamic = 'force-dynamic'

import { getSupabase } from '@/lib/supabase'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import SiteEditForm from '@/components/sites/SiteEditForm'

export default async function EditSitePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = getSupabase()

  const [{ data: site }, { data: agencies }] = await Promise.all([
    supabase.from('tower_sites').select('*').eq('id', id).single(),
    supabase.from('state_agencies').select('id, name').eq('status', 'active').order('name'),
  ])

  if (!site) notFound()

  const initial = {
    site_code:      site.site_code      ?? '',
    name:           site.name           ?? '',
    address:        site.address        ?? '',
    city:           site.city           ?? '',
    state:          site.state          ?? '',
    zip:            site.zip            ?? '',
    lat:            site.lat            != null ? String(site.lat) : '',
    lng:            site.lng            != null ? String(site.lng) : '',
    host_agency_id: site.host_agency_id ?? '',
    tower_type:     site.tower_type     ?? '',
    height_ft:      site.height_ft      != null ? String(site.height_ft) : '',
    tenant_slots:   site.tenant_slots   != null ? String(site.tenant_slots) : '',
    status:         site.status         ?? 'operational',
    notes:          site.notes          ?? '',
  }

  return (
    <div style={{ padding: '32px', maxWidth: '860px' }}>
      <Link href={`/sites/${id}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#64748b', fontSize: '14px', textDecoration: 'none', marginBottom: '20px' }}>
        <ArrowLeft size={15} /> Back to {site.name}
      </Link>
      <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#0f172a', margin: '0 0 6px' }}>Edit Site</h1>
      <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 28px' }}>{site.site_code} · {site.city}, {site.state}</p>
      <SiteEditForm siteId={id} initial={initial} agencies={agencies ?? []} />
    </div>
  )
}
