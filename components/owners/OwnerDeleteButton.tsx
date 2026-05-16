'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'

interface Props {
  ownerId: string
  ownerName: string
  siteCount: number
}

export default function OwnerDeleteButton({ ownerId, ownerName, siteCount }: Props) {
  const [deleting, setDeleting] = useState(false)
  const router = useRouter()

  async function handleDelete() {
    if (siteCount > 0) {
      alert(`Cannot delete "${ownerName}" — they own ${siteCount} site${siteCount > 1 ? 's' : ''}. Reassign all sites first.`)
      return
    }

    if (!window.confirm(`Are you sure you want to permanently delete "${ownerName}"? This cannot be undone.`)) return

    setDeleting(true)
    const res = await fetch(`/api/owners/${ownerId}`, { method: 'DELETE' })
    const json = await res.json()

    if (!res.ok) {
      alert(json.error || 'Delete failed.')
      setDeleting(false)
      return
    }

    router.push('/owners')
    router.refresh()
  }

  return (
    <button
      onClick={handleDelete}
      disabled={deleting}
      style={{
        display: 'flex', alignItems: 'center', gap: '6px',
        background: 'white', color: '#dc2626',
        border: '1px solid #fca5a5', borderRadius: '7px',
        padding: '9px 16px', fontSize: '13px',
        fontWeight: 600, cursor: deleting ? 'default' : 'pointer',
        opacity: deleting ? 0.6 : 1,
      }}
    >
      <Trash2 size={14} />
      {deleting ? 'Deleting…' : 'Delete'}
    </button>
  )
}
