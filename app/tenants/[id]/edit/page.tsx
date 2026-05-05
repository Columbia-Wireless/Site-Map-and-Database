export const dynamic = 'force-dynamic'

import { getSupabase } from '@/lib/supabase'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import TenantForm from '@/components/tenants/TenantForm'

export default async function EditTenantPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = getSupabase()

  const { data: tenant } = await supabase.from('tenants').select('*').eq('id', id).single()
  if (!tenant) notFound()

  return (
    <div style={{ padding: '32px', maxWidth: '800px' }}>
      <Link href={`/tenants/${id}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#64748b', fontSize: '14px', textDecoration: 'none', marginBottom: '20px' }}>
        <ArrowLeft size={15} /> Back to {tenant.name}
      </Link>
      <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#0f172a', margin: '0 0 28px' }}>Edit Tenant</h1>
      <TenantForm mode="edit" tenantId={id} initial={tenant} />
    </div>
  )
}
