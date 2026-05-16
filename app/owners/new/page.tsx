import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import OwnerForm from '@/components/owners/OwnerForm'

export default function NewOwnerPage() {
  return (
    <div style={{ padding: '32px', maxWidth: '800px' }}>
      <Link href="/owners" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#64748b', fontSize: '14px', textDecoration: 'none', marginBottom: '20px' }}>
        <ArrowLeft size={15} /> Back to Site Owners
      </Link>
      <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#0f172a', margin: '0 0 28px' }}>Add New Owner</h1>
      <OwnerForm mode="add" />
    </div>
  )
}
