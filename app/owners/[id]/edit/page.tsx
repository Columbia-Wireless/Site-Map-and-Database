export const dynamic = 'force-dynamic'

import { getSupabase } from '@/lib/supabase'
import { getProfile } from '@/lib/profile'
import { assertAgencyVisible } from '@/lib/orgScope'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import OwnerForm from '@/components/owners/OwnerForm'

export default async function EditOwnerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!(await assertAgencyVisible(id))) notFound()
  const supabase = getSupabase()
  const profile = await getProfile()
  const singular = profile?.owner_label_singular ?? 'Owner'

  const { data: owner } = await supabase.from('state_agencies').select('*').eq('id', id).single()
  if (!owner) notFound()

  return (
    <div style={{ padding: '32px', maxWidth: '800px' }}>
      <Link href={`/owners/${id}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#64748b', fontSize: '14px', textDecoration: 'none', marginBottom: '20px' }}>
        <ArrowLeft size={15} /> Back to {owner.name}
      </Link>
      <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#0f172a', margin: '0 0 28px' }}>Edit {singular}</h1>
      <OwnerForm mode="edit" ownerId={id} initial={owner} />
    </div>
  )
}
