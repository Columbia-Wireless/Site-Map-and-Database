'use client'

import { useEffect, useMemo, useState } from 'react'
import { FileWarning, Loader2 } from 'lucide-react'
import DocDetailModal from '@/components/sites/DocDetailModal'

interface QueueDoc {
  id: string
  name: string
  doc_type: string
  doc_status: string
  uploaded_by: string
  uploaded_at: string
  file_size_kb: number
  file_hash?: string
  iota_block_id?: string
  iota_explorer_url?: string
  extracted_terms?: Record<string, any>
  site_id: string
  tower_sites: { id: string; site_code: string; name: string } | null
}

const DOC_TYPE_LABELS: Record<string, string> = {
  lease: 'Lease Agreement', amendment: 'Amendment', addendum: 'Addendum',
  coi: 'Certificate of Insurance', fcc_license: 'FCC License',
  structural: 'Structural Certification', title: 'Title / Deed',
  survey: 'Survey', other: 'Other',
}

/**
 * Portfolio-wide (default) or single-site (siteId prop) Needs-Review queue.
 * Reads live from /api/sam2/review-queue (doc_status = 'review_required'),
 * not from sam2_import_log — that log is a point-in-time record of what
 * happened at sync, this needs to reflect current state.
 *
 * The whole point of this component: every approve/edit happens inside the
 * SAME DocDetailModal instance, which just gets handed the next document —
 * no closing and reopening per document, no hunting through a per-site
 * Documents tab one at a time.
 */
export default function ReviewQueueClient({ siteId, canEdit }: { siteId?: string; canEdit: boolean }) {
  const [docs, setDocs] = useState<QueueDoc[]>([])
  const [loading, setLoading] = useState(true)
  const [siteFilter, setSiteFilter] = useState<string>(siteId ?? 'all')
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  useEffect(() => {
    const url = siteId ? `/api/sam2/review-queue?siteId=${siteId}` : '/api/sam2/review-queue'
    fetch(url)
      .then(r => r.json())
      .then(data => { setDocs(Array.isArray(data) ? data : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [siteId])

  const siteOptions = useMemo(() => {
    const seen = new Map<string, { id: string; label: string }>()
    for (const d of docs) {
      if (d.tower_sites && !seen.has(d.tower_sites.id)) {
        seen.set(d.tower_sites.id, { id: d.tower_sites.id, label: `${d.tower_sites.site_code} · ${d.tower_sites.name}` })
      }
    }
    return Array.from(seen.values()).sort((a, b) => a.label.localeCompare(b.label))
  }, [docs])

  const visibleDocs = siteFilter === 'all' ? docs : docs.filter(d => d.site_id === siteFilter)
  const openDoc = openIndex != null ? visibleDocs[openIndex] : null

  function handleUpdated(updated: QueueDoc) {
    // No longer needing review — remove it. The item that follows shifts
    // into this same index automatically, which is the actual "Next" in
    // "Approve & Next" (see DocDetailModal's approve()).
    if (updated.doc_status !== 'review_required') {
      setDocs(prev => prev.filter(d => d.id !== updated.id))
      setOpenIndex(prev => {
        if (prev == null) return prev
        const remaining = visibleDocs.length - 1
        if (remaining <= 0) return null
        return Math.min(prev, remaining - 1)
      })
    } else {
      // Field edit, still needs review — keep it in the list, just update its data in place.
      setDocs(prev => prev.map(d => d.id === updated.id ? { ...d, ...updated } : d))
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px', color: '#94a3b8', gap: '10px' }}>
        <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Loading review queue…
      </div>
    )
  }

  return (
    <div>
      {!siteId && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
          <label style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>Site</label>
          <select
            value={siteFilter}
            onChange={e => setSiteFilter(e.target.value)}
            style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '13px', background: 'white' }}
          >
            <option value="all">All sites ({docs.length})</option>
            {siteOptions.map(s => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
        </div>
      )}

      {visibleDocs.length === 0 ? (
        <div style={{ padding: '32px', textAlign: 'center', color: '#94a3b8', fontSize: '13px', background: 'white', border: '1px solid #e2e8f0', borderRadius: '10px' }}>
          Nothing needs review right now.
        </div>
      ) : (
        <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #f1f5f9', background: '#f8fafc' }}>
                {(siteId ? ['Document', 'Type', 'Uploaded'] : ['Site', 'Document', 'Type', 'Uploaded']).map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleDocs.map((d, i) => (
                <tr
                  key={d.id}
                  onClick={() => setOpenIndex(i)}
                  style={{ borderBottom: '1px solid #f8fafc', cursor: 'pointer' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.background = '#f8fafc' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = 'transparent' }}
                >
                  {!siteId && (
                    <td style={{ padding: '10px 16px', fontSize: '13px', color: '#334155' }}>
                      {d.tower_sites ? `${d.tower_sites.site_code} · ${d.tower_sites.name}` : '—'}
                    </td>
                  )}
                  <td style={{ padding: '10px 16px', fontSize: '13px', fontWeight: 600, color: '#0f172a' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <FileWarning size={14} color="#b91c1c" style={{ flexShrink: 0 }} />
                      {d.name}
                    </div>
                  </td>
                  <td style={{ padding: '10px 16px', fontSize: '12px', color: '#64748b' }}>{DOC_TYPE_LABELS[d.doc_type] ?? d.doc_type}</td>
                  <td style={{ padding: '10px 16px', fontSize: '12px', color: '#94a3b8' }}>
                    {new Date(d.uploaded_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {openDoc && (
        <DocDetailModal
          doc={openDoc as any}
          siteId={openDoc.site_id}
          canEdit={canEdit}
          onClose={() => setOpenIndex(null)}
          onUpdated={handleUpdated as any}
          queuePosition={{ index: openIndex!, total: visibleDocs.length }}
          onNext={() => setOpenIndex(i => (i != null ? Math.min(i + 1, visibleDocs.length - 1) : i))}
          onPrev={() => setOpenIndex(i => (i != null ? Math.max(i - 1, 0) : i))}
        />
      )}
    </div>
  )
}
