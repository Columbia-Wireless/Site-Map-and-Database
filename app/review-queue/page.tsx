export const dynamic = 'force-dynamic'

import { getProfile, canEdit as canEditFn } from '@/lib/profile'
import { FileWarning } from 'lucide-react'
import ReviewQueueClient from '@/components/reviewQueue/ReviewQueueClient'

export default async function ReviewQueuePage({ searchParams }: { searchParams: Promise<{ siteId?: string }> }) {
  const profile = await getProfile()
  const editAllowed = canEditFn(profile)
  const { siteId } = await searchParams

  return (
    <div style={{ padding: '32px', maxWidth: '1100px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
          <FileWarning size={22} color="#b91c1c" /> Needs Review
        </h1>
        <p style={{ color: '#64748b', marginTop: '4px', fontSize: '14px' }}>
          {siteId
            ? 'Documents waiting on approval, edit, or rejection for this site.'
            : "Every document across the portfolio waiting on approval, edit, or rejection."} Opens the same
          review screen used from a site's Documents tab, moves to the next document automatically.
        </p>
      </div>
      <ReviewQueueClient canEdit={editAllowed} siteId={siteId} />
    </div>
  )
}
