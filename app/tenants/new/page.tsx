import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import TenantForm from '@/components/tenants/TenantForm'

export default function NewTenantPage() {
  return (
    <div style={{ padding: '32px', maxWidth: '800px' }}>
      <Link href="/tenants" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#64748b', fontSize: '14px', textDecoration: 'none', marginBottom: '20px' }}>
        <ArrowLeft size={15} /> Back to Licensees
      </Link>
      <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#0f172a', margin: '0 0 28px' }}>Add New Licensee</h1>
      <TenantForm mode="add" />
    </div>
  )
}
