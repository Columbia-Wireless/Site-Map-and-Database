export const dynamic = 'force-dynamic'

import { getSupabase } from '@/lib/supabase'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import TenantTable from '@/components/tenants/TenantTable'

export default async function TenantsPage() {
  const supabase = getSupabase()
  const { data: tenants } = await supabase
    .from('tenants')
    .select('*, tower_sites(id, annual_rent, status)')
    .order('name')

  return (
    <div style={{ padding: '32px', maxWidth: '1200px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '28px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#0f172a', margin: 0 }}>Tenants</h1>
          <p style={{ color: '#64748b', marginTop: '4px', fontSize: '14px' }}>
            {tenants?.length ?? 0} tenants on record
          </p>
        </div>
        <Link href="/tenants/new" style={{ textDecoration: 'none' }}>
          <button style={{
            display: 'flex', alignItems: 'center', gap: '7px',
            background: '#1a3a5c', color: 'white', border: 'none',
            borderRadius: '8px', padding: '10px 18px',
            fontSize: '14px', fontWeight: 600, cursor: 'pointer',
          }}>
            <Plus size={16} /> Add Tenant
          </button>
        </Link>
      </div>
      <TenantTable tenants={(tenants ?? []) as any} />
    </div>
  )
}
