'use client'

import { useState, useRef, useCallback } from 'react'
import { FileText, Upload, Shield, Loader2, AlertCircle, XCircle, ExternalLink, Trash2, ChevronRight } from 'lucide-react'
import DocDetailModal from './DocDetailModal'

const DOC_TYPES = [
  { value: 'lease',       label: 'Lease Agreement' },
  { value: 'amendment',  label: 'Amendment' },
  { value: 'addendum',   label: 'Addendum' },
  { value: 'coi',        label: 'Certificate of Insurance' },
  { value: 'fcc_license',label: 'FCC License' },
  { value: 'structural', label: 'Structural Certification' },
  { value: 'title',      label: 'Title / Deed' },
  { value: 'survey',     label: 'Survey' },
  { value: 'other',      label: 'Other' },
]

const DOC_TYPE_LABEL = Object.fromEntries(DOC_TYPES.map(d => [d.value, d.label]))

const STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  uploaded:        { bg: '#f1f5f9', color: '#475569', label: 'Uploaded' },
  extracting:      { bg: '#fef3c7', color: '#d97706', label: 'Extracting…' },
  extracted:       { bg: '#dcfce7', color: '#15803d', label: 'Terms Extracted' },
  review_required: { bg: '#fee2e2', color: '#b91c1c', label: 'Needs Review' },
  approved:        { bg: '#dcfce7', color: '#15803d', label: 'Approved' },
  notarized:       { bg: '#eff6ff', color: '#2563eb', label: 'Notarized' },
}

interface Doc {
  id: string
  name: string
  doc_type: string
  uploaded_by: string
  uploaded_at: string
  file_size_kb: number
  doc_status: string
  file_hash?: string
  iota_block_id?: string
  iota_explorer_url?: string
  parent_document_id?: string
  extracted_terms?: Record<string, any>
}

interface Props {
  siteId: string
  initialDocs: Doc[]
  onDocsChange?: (docs: Doc[]) => void
  canEdit?: boolean
}

// Summarise confidence across extracted_terms
function confSummary(terms: Record<string, any> | undefined) {
  if (!terms) return null
  let green = 0, amber = 0, red = 0
  Object.entries(terms).forEach(([k, v]) => {
    if (k.startsWith('_')) return
    const c = typeof v === 'object' && v !== null
      ? (v.edited_by ? 'human' : v.confidence ?? 'low')
      : (v ? 'high' : 'low')
    if (c === 'high' || c === 'human') green++
    else if (c === 'medium') amber++
    else red++
  })
  return { green, amber, red }
}

function fmtSize(kb: number) {
  return kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`
}

export default function SiteDocuments({ siteId, initialDocs, onDocsChange, canEdit = false }: Props) {
  const [docs, setDocs] = useState<Doc[]>(initialDocs)
  const [openDocId, setOpenDocId] = useState<string | null>(null)

  const [showUpload, setShowUpload] = useState(false)
  const [docType, setDocType] = useState('lease')
  const [parentId, setParentId] = useState('')
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadLabel, setUploadLabel] = useState('Uploading…')
  const fileRef = useRef<HTMLInputElement>(null)
  const cancelledRef = useRef(false)

  function updateDocs(updater: (prev: Doc[]) => Doc[]) {
    setDocs(prev => {
      const next = updater(prev)
      onDocsChange?.(next)
      return next
    })
  }

  function cancelUpload() {
    cancelledRef.current = true
    setUploading(false)
    setUploadProgress(0)
    setUploadLabel('Uploading…')
  }

  const leases = docs.filter(d => d.doc_type === 'lease')

  async function upload(file: File) {
    cancelledRef.current = false
    setUploading(true)
    setUploadProgress(5)
    setUploadLabel('Reading file…')

    const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL  || 'https://vfntpdpneusqgcwxwkix.supabase.co'
    const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZmbnRwZHBuZXVzcWdjd3h3a2l4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5NTg2MzEsImV4cCI6MjA5MzUzNDYzMX0.kFZ6b2WKAl7GVsEQZeO33qcxhyBruQlTfW0eZfkcg1c'
    let storagePath = ''

    try {
      const arrayBuffer = await file.arrayBuffer()
      if (cancelledRef.current) return

      setUploadProgress(15)
      setUploadLabel('Hashing file…')
      const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer)
      const hashArray  = Array.from(new Uint8Array(hashBuffer))
      const fileHash   = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
      if (cancelledRef.current) return

      const sizeLabel = file.size >= 1048576 ? `${(file.size / 1048576).toFixed(1)} MB` : `${Math.round(file.size / 1024)} KB`
      setUploadProgress(25)
      setUploadLabel(`Uploading ${sizeLabel}…`)
      storagePath = `${siteId}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`

      const storageRes = await fetch(
        `${SUPABASE_URL}/storage/v1/object/lease-documents/${storagePath}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${SUPABASE_ANON}`,
            'Content-Type': file.type || 'application/octet-stream',
            'x-upsert': 'false',
          },
          body: new Uint8Array(arrayBuffer),
        }
      )
      if (cancelledRef.current) return
      if (!storageRes.ok) {
        const errText = await storageRes.text().catch(() => '')
        throw new Error(`Storage upload failed (${storageRes.status}): ${errText || 'no details'}`)
      }

      setUploadProgress(90)
      setUploadLabel('Saving record…')
      const res = await fetch(`/api/sites/${siteId}/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: file.name,
          doc_type: docType,
          storage_path: storagePath,
          file_size_kb: Math.round(file.size / 1024),
          file_hash: fileHash,
          parent_document_id: parentId || null,
        }),
      })

      let data: any = {}
      try { data = await res.json() } catch { data = {} }
      if (cancelledRef.current) return
      if (!res.ok) throw new Error(data.error ?? `API error ${res.status}`)

      setUploadProgress(100)
      updateDocs(prev => [data, ...prev])
      setShowUpload(false)
      setParentId('')
      // Auto-open the modal for the new doc
      setOpenDocId(data.id)
    } catch (err: any) {
      if (!cancelledRef.current) alert('Upload failed: ' + err.message)
    } finally {
      if (!cancelledRef.current) {
        setUploading(false)
        setUploadProgress(0)
        setUploadLabel('Uploading…')
      }
    }
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) upload(file)
  }, [docType, parentId])

  const openDoc = docs.find(d => d.id === openDocId)

  return (
    <>
      <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', paddingBottom: '12px', borderBottom: '1px solid #f1f5f9' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileText size={16} color="#2563eb" />
            <span style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a' }}>Documents ({docs.length})</span>
          </div>
          {canEdit && (
            <button
              onClick={() => setShowUpload(v => !v)}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '6px', padding: '7px 12px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
            >
              <Upload size={13} /> Upload
            </button>
          )}
        </div>

        {/* Upload panel */}
        {canEdit && showUpload && (
          <div style={{ marginBottom: '16px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '4px' }}>DOCUMENT TYPE</label>
                <select value={docType} onChange={e => setDocType(e.target.value)}
                  style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '13px', background: 'white' }}>
                  {DOC_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              {(docType === 'amendment' || docType === 'addendum') && leases.length > 0 && (
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '4px' }}>LINKS TO LEASE</label>
                  <select value={parentId} onChange={e => setParentId(e.target.value)}
                    style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '13px', background: 'white' }}>
                    <option value="">— select original —</option>
                    {leases.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
              )}
            </div>

            <div
              onDragOver={e => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => { if (!uploading) fileRef.current?.click() }}
              style={{ border: `2px dashed ${dragging ? '#2563eb' : '#cbd5e1'}`, borderRadius: '8px', padding: '28px', textAlign: 'center', cursor: 'pointer', background: dragging ? '#eff6ff' : 'white', transition: 'all 0.15s' }}
            >
              {uploading ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }} onClick={e => e.stopPropagation()}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#2563eb' }}>
                    <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
                    <span style={{ fontSize: '13px', fontWeight: 500 }}>{uploadLabel}</span>
                    <span style={{ fontSize: '12px', color: '#64748b' }}>{uploadProgress}%</span>
                  </div>
                  <div style={{ width: '100%', maxWidth: '260px', height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${uploadProgress}%`, background: '#2563eb', borderRadius: '3px', transition: 'width 0.3s ease' }} />
                  </div>
                  <button onClick={cancelUpload} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: 'none', border: '1px solid #fca5a5', borderRadius: '6px', padding: '5px 12px', fontSize: '12px', fontWeight: 600, color: '#ef4444', cursor: 'pointer' }}>
                    <XCircle size={13} /> Cancel
                  </button>
                </div>
              ) : (
                <>
                  <Upload size={22} color="#94a3b8" style={{ marginBottom: '8px' }} />
                  <div style={{ fontSize: '13px', color: '#64748b' }}>Drop a file here or <span style={{ color: '#2563eb', fontWeight: 600 }}>browse</span></div>
                  <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>PDF, Word, JPG, PNG, TIFF — max 50 MB</div>
                </>
              )}
            </div>
            <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.tiff" style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f) upload(f) }} />
          </div>
        )}

        {/* Document rows */}
        {docs.length === 0 ? (
          <div style={{ fontSize: '13px', color: '#94a3b8', padding: '12px 0' }}>No documents on file.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {docs.map(doc => {
              const st = STATUS_STYLE[doc.doc_status] ?? STATUS_STYLE.uploaded
              const summary = confSummary(doc.extracted_terms)
              const isAddendum = !!doc.parent_document_id
              return (
                <div
                  key={doc.id}
                  onClick={() => setOpenDocId(doc.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '10px 12px', borderRadius: '8px', cursor: 'pointer',
                    border: '1px solid transparent',
                    transition: 'all 0.12s',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = '#f8fafc'; (e.currentTarget as HTMLDivElement).style.borderColor = '#e2e8f0' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'transparent'; (e.currentTarget as HTMLDivElement).style.borderColor = 'transparent' }}
                >
                  {/* Indent for amendments */}
                  {isAddendum && <div style={{ width: '12px', height: '1px', background: '#e2e8f0', flexShrink: 0 }} />}

                  {/* Icon */}
                  <FileText size={15} color={doc.iota_block_id ? '#2563eb' : '#94a3b8'} style={{ flexShrink: 0 }} />

                  {/* Name + meta */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {doc.name}
                    </div>
                    <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '1px' }}>
                      {DOC_TYPE_LABEL[doc.doc_type] ?? doc.doc_type} · {fmtSize(doc.file_size_kb)} · {new Date(doc.uploaded_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                  </div>

                  {/* Confidence summary dots */}
                  {summary && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0 }}>
                      {summary.green > 0  && <ConfDot color="#16a34a" count={summary.green} />}
                      {summary.amber > 0  && <ConfDot color="#d97706" count={summary.amber} />}
                      {summary.red > 0    && <ConfDot color="#dc2626" count={summary.red}   />}
                    </div>
                  )}

                  {/* Status badge */}
                  <span style={{ fontSize: '11px', fontWeight: 600, padding: '3px 8px', borderRadius: '10px', background: st.bg, color: st.color, whiteSpace: 'nowrap', flexShrink: 0 }}>
                    {st.label}
                  </span>

                  {/* Delete (edit only) — stop propagation so it doesn't open modal */}
                  {canEdit && (
                    <button
                      onClick={async e => {
                        e.stopPropagation()
                        if (!confirm(`Delete "${doc.name}"? This cannot be undone.`)) return
                        const res = await fetch(`/api/sites/${siteId}/documents/${doc.id}`, { method: 'DELETE' })
                        if (res.ok) updateDocs(prev => prev.filter(d => d.id !== doc.id))
                        else alert('Delete failed')
                      }}
                      title="Delete document"
                      style={{ display: 'inline-flex', alignItems: 'center', background: 'none', border: '1px solid #fca5a5', borderRadius: '6px', padding: '5px 7px', cursor: 'pointer', color: '#ef4444', flexShrink: 0 }}
                    >
                      <Trash2 size={12} />
                    </button>
                  )}

                  {/* Chevron */}
                  <ChevronRight size={14} color="#cbd5e1" style={{ flexShrink: 0 }} />
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Detail modal */}
      {openDoc && (
        <DocDetailModal
          doc={openDoc}
          siteId={siteId}
          canEdit={canEdit}
          onClose={() => setOpenDocId(null)}
          onUpdated={updated => updateDocs(prev => prev.map(d => d.id === updated.id ? updated : d))}
        />
      )}
    </>
  )
}

function ConfDot({ color, count }: { color: string; count: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
      <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: color }} />
      <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 500 }}>{count}</span>
    </div>
  )
}
