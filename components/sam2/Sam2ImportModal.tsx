'use client'

import { useState } from 'react'
import { X, AlertTriangle, CheckCircle2, Loader2, ClipboardList } from 'lucide-react'
import Sam2LeaseModule from './Sam2LeaseModule'
import TermsReviewModal from '../sites/TermsReviewModal'

interface Props {
  onClose: () => void
  /** Called after a document has been synced into Supabase (or failed to sync). */
  onSynced?: () => void
}

interface ReviewQueueItem {
  siteId: string
  documentId: string
}

export default function Sam2ImportModal({ onClose, onSynced }: Props) {
  const [syncing, setSyncing] = useState(false)
  const [syncError, setSyncError] = useState('')
  const [warnings, setWarnings] = useState<string[]>([])
  const [syncedCount, setSyncedCount] = useState(0)
  // Documents that came back with needsReview=true — SAM 2.0's own iframe UI
  // never handles approve/edit/ignore, that all happens in our own
  // TermsReviewModal (same component the legacy in-house extraction flow
  // uses). The iframe is drop-and-parse only.
  const [reviewQueue, setReviewQueue] = useState<ReviewQueueItem[]>([])
  const [activeReview, setActiveReview] = useState<{ siteId: string; doc: any } | null>(null)
  const [loadingReview, setLoadingReview] = useState(false)

  // Payload shape confirmed 2026-08-18 — see lib/sam2Types.ts's module comment.
  // This POSTs whatever the event actually contains, untouched; /api/sam2/sync
  // does all the shape validation and mapping.
  async function handleDocumentParsed(data: unknown) {
    setSyncing(true)
    setSyncError('')
    try {
      const res = await fetch('/api/sam2/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const result = await res.json()
      if (!res.ok) {
        setSyncError(result.error ?? 'Sync failed')
      } else {
        setSyncedCount(c => c + 1)
        if (result.warnings?.length) setWarnings(w => [...w, ...result.warnings])
        if (result.needsReview) {
          setReviewQueue(q => [...q, { siteId: result.siteId, documentId: result.documentId }])
        }
        onSynced?.()
      }
    } catch (err: any) {
      setSyncError(err?.message ?? 'Sync failed')
    } finally {
      setSyncing(false)
    }
  }

  async function openNextReview() {
    const next = reviewQueue[0]
    if (!next) return
    setLoadingReview(true)
    try {
      const res = await fetch(`/api/sites/${next.siteId}/documents`)
      const docs = await res.json()
      const doc = Array.isArray(docs) ? docs.find((d: any) => d.id === next.documentId) : null
      if (doc) {
        setActiveReview({ siteId: next.siteId, doc })
        setReviewQueue(q => q.slice(1))
      } else {
        // Document vanished or fetch shape unexpected — drop it rather than block the queue.
        setReviewQueue(q => q.slice(1))
      }
    } finally {
      setLoadingReview(false)
    }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9998, background: 'rgba(15,23,42,0.55)',
        backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '20px',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'white', borderRadius: '14px', width: '100%', maxWidth: '1100px',
          boxShadow: '0 24px 64px rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column',
          maxHeight: '90vh',
        }}
      >
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '20px 24px', borderBottom: '1px solid #f1f5f9',
        }}>
          <div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>
              Batch Import — SAM 2.0 Lease Intelligence
            </div>
            <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>
              Upload leases in any order — SAM 2.0 sequences the timeline and calculates current rent automatically
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
          >
            <X size={20} />
          </button>
        </div>

        <div style={{ padding: '20px 24px 24px', overflow: 'auto' }}>
          {syncError && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '8px', background: '#fef2f2',
              border: '1px solid #fecaca', borderRadius: '8px', padding: '10px 14px',
              marginBottom: '14px', fontSize: '13px', color: '#b91c1c',
            }}>
              <AlertTriangle size={14} /> Sync to SCETV failed: {syncError}
            </div>
          )}
          {syncedCount > 0 && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '8px', background: '#f0fdf4',
              border: '1px solid #bbf7d0', borderRadius: '8px', padding: '10px 14px',
              marginBottom: '14px', fontSize: '13px', color: '#15803d',
            }}>
              {syncing ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <CheckCircle2 size={14} />}
              {syncedCount} document{syncedCount === 1 ? '' : 's'} synced to Site Portfolio
            </div>
          )}
          {warnings.length > 0 && (
            <div style={{
              background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px',
              padding: '10px 14px', marginBottom: '14px', fontSize: '12px', color: '#92400e',
            }}>
              <strong>Needs review:</strong>
              <ul style={{ margin: '6px 0 0', paddingLeft: '18px' }}>
                {warnings.map((w, i) => <li key={i} style={{ marginBottom: '3px' }}>{w}</li>)}
              </ul>
            </div>
          )}
          {reviewQueue.length > 0 && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '10px', background: '#eff6ff',
              border: '1px solid #bfdbfe', borderRadius: '8px', padding: '10px 14px',
              marginBottom: '14px', fontSize: '13px', color: '#1e40af',
            }}>
              <ClipboardList size={14} style={{ flexShrink: 0 }} />
              <span style={{ flex: 1 }}>
                {reviewQueue.length} document{reviewQueue.length === 1 ? '' : 's'} synced and waiting on your review — nothing here affects rent numbers until approved.
              </span>
              <button
                onClick={openNextReview}
                disabled={loadingReview}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#1e40af', color: 'white', border: 'none', borderRadius: '6px', padding: '6px 14px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}
              >
                {loadingReview ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : null}
                Review now
              </button>
            </div>
          )}
          <Sam2LeaseModule height="72vh" onDocumentParsed={handleDocumentParsed} />
        </div>
      </div>

      {activeReview && (
        <TermsReviewModal
          doc={activeReview.doc}
          siteId={activeReview.siteId}
          onClose={() => setActiveReview(null)}
          onSaved={updated => setActiveReview(r => (r ? { ...r, doc: updated } : r))}
        />
      )}
    </div>
  )
}
