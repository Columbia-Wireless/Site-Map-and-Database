'use client'

import { useState, useEffect, useCallback } from 'react'
import { X, AlertTriangle, CheckCircle2, Loader2, ClipboardList, History, FileWarning, FileCheck2, FileQuestion } from 'lucide-react'
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

interface ImportLogEntry {
  id: string
  occurred_at: string
  file_name: string
  outcome: 'synced' | 'needs_review' | 'non_instrument' | 'error'
  warnings: string[]
  error_message: string | null
  actor_name: string
  tower_sites: { name: string } | null
}

const OUTCOME_STYLE: Record<ImportLogEntry['outcome'], { color: string; bg: string; label: string; icon: typeof FileCheck2 }> = {
  synced:        { color: '#15803d', bg: '#dcfce7', label: 'Synced',          icon: FileCheck2 },
  needs_review:  { color: '#b45309', bg: '#fffbeb', label: 'Needs review',    icon: FileWarning },
  non_instrument:{ color: '#475569', bg: '#f1f5f9', label: 'Filed (no lease)', icon: FileQuestion },
  error:         { color: '#b91c1c', bg: '#fef2f2', label: 'Failed',          icon: FileWarning },
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
  // Persistent history — every sync attempt is logged server-side (see
  // supabase/sam2_import_log.sql), so this survives closing the modal, unlike
  // syncedCount/warnings above which are just this session's tally.
  const [recentImports, setRecentImports] = useState<ImportLogEntry[]>([])
  const [showHistory, setShowHistory] = useState(false)

  const refreshHistory = useCallback(async () => {
    try {
      const res = await fetch('/api/sam2/import-log?limit=25')
      const data = await res.json()
      setRecentImports(data.entries ?? [])
    } catch {
      // Best-effort — history panel just stays empty/stale, not worth surfacing an error for.
    }
  }, [])

  useEffect(() => { refreshHistory() }, [refreshHistory])

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
      refreshHistory() // every attempt (success or failure) is logged server-side — pick it up
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
      style={{
        position: 'fixed', inset: 0, zIndex: 9998, background: 'rgba(15,23,42,0.55)',
        backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 0,
      }}
    >
      <div
        style={{
          background: 'white', borderRadius: '14px', width: '100%', maxWidth: '100vw',
          height: '100%', maxHeight: '100vh',
          boxShadow: '0 24px 64px rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column',
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <button
              onClick={() => setShowHistory(v => !v)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px', background: showHistory ? '#eff6ff' : 'none',
                border: '1px solid ' + (showHistory ? '#bfdbfe' : '#e2e8f0'), borderRadius: '6px', padding: '6px 12px',
                fontSize: '12px', fontWeight: 600, color: showHistory ? '#1e40af' : '#64748b', cursor: 'pointer',
              }}
            >
              <History size={13} /> Recent Imports {recentImports.length > 0 ? `(${recentImports.length})` : ''}
            </button>
            <button
              onClick={onClose}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div style={{ flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden' }}>
        {showHistory && (
          <div style={{ width: '340px', flexShrink: 0, borderRight: '1px solid #f1f5f9', overflow: 'auto', padding: '16px' }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', marginBottom: '10px', letterSpacing: '0.03em' }}>
              RECENT SAM 2.0 IMPORTS
            </div>
            {recentImports.length === 0 && (
              <div style={{ fontSize: '12px', color: '#94a3b8' }}>No import history yet.</div>
            )}
            {recentImports.map(entry => {
              const style = OUTCOME_STYLE[entry.outcome]
              const Icon = style.icon
              return (
                <div key={entry.id} style={{ padding: '10px 0', borderBottom: '1px solid #f8fafc' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                    <Icon size={14} color={style.color} style={{ flexShrink: 0, marginTop: '2px' }} />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: '#0f172a', wordBreak: 'break-word' }}>
                        {entry.file_name}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '3px' }}>
                        <span style={{ fontSize: '10px', fontWeight: 700, color: style.color, background: style.bg, borderRadius: '8px', padding: '1px 7px' }}>
                          {style.label}
                        </span>
                        {entry.tower_sites?.name && (
                          <span style={{ fontSize: '11px', color: '#94a3b8' }}>{entry.tower_sites.name}</span>
                        )}
                      </div>
                      {entry.error_message && (
                        <div style={{ fontSize: '11px', color: '#b91c1c', marginTop: '3px' }}>{entry.error_message}</div>
                      )}
                      <div style={{ fontSize: '10px', color: '#cbd5e1', marginTop: '3px' }}>
                        {new Date(entry.occurred_at).toLocaleString()} · {entry.actor_name}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
        <div style={{ padding: '20px 24px 24px', overflow: 'auto', flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
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
          <div style={{ flex: 1, minHeight: 0 }}>
            <Sam2LeaseModule height="100%" onDocumentParsed={handleDocumentParsed} />
          </div>
        </div>
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
