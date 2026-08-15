export const dynamic = 'force-dynamic'

import { getSupabase } from '@/lib/supabase'
import { getProfile } from '@/lib/profile'
import { scopeFromProfile, getVisibleSiteIds } from '@/lib/orgScope'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import TenantTable from '@/components/tenants/TenantTable'

export default async function TenantsPage() {
  const supabase = getSupabase()
  const scope = scopeFromProfile(await getProfile())
  const { data: rawTenants } = await supabase
    .from('licensees')
    .select('*, site_licenses(id, annual_rent, status, site_id)')
    .order('name')

  // Licensees are a shared reference table — only show licensees with at
  // least one license on a site visible to this org, and trim their
  // embedded site_licenses to that same visible set.
  const visibleSiteIds = await getVisibleSiteIds(scope)
  const visibleSet = visibleSiteIds ? new Set(visibleSiteIds) : null
  const tenants = (rawTenants ?? [])
    .map((t: any) => ({
      ...t,
      site_licenses: visibleSet ? (t.site_licenses ?? []).filter((sl: any) => visibleSet.has(sl.site_id)) : t.site_licenses,
    }))
    .filter((t: any) => !visibleSet || t.site_licenses.length > 0)

  return (
    <div style={{ padding: '32px', maxWidth: '1200px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '28px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#0f172a', margin: 0 }}>Licensees</h1>
          <p style={{ color: '#64748b', marginTop: '4px', fontSize: '14px' }}>
            {tenants?.length ?? 0} licensees on record
          </p>
        </div>
        <Link href="/tenants/new" style={{ textDecoration: 'none' }}>
          <button style={{
            display: 'flex', alignItems: 'center', gap: '7px',
            background: '#1a3a5c', color: 'white', border: 'none',
            borderRadius: '8px', padding: '10px 18px',
            fontSize: '14px', fontWeight: 600, cursor: 'pointer',
          }}>
            <Plus size={16} /> Add Licensee
          </button>
        </Link>
      </div>
      <TenantTable tenants={(tenants ?? []) as any} />
    </div>
  )
}
