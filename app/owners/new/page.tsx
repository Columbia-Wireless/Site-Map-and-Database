import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import OwnerForm from '@/components/owners/OwnerForm'
import { getProfile } from '@/lib/profile'

export default async function NewOwnerPage() {
  const profile = await getProfile()
  const singular = profile?.owner_label_singular ?? 'Owner'
  const plural = profile?.owner_label_plural ?? 'Owners'

  return (
    <div style={{ padding: '32px', maxWidth: '800px' }}>
      <Link href="/owners" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#64748b', fontSize: '14px', textDecoration: 'none', marginBottom: '20px' }}>
        <ArrowLeft size={15} /> Back to Site {plural}
      </Link>
      <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#0f172a', margin: '0 0 28px' }}>Add New {singular}</h1>
      <OwnerForm mode="add" />
    </div>
  )
}
