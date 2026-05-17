'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Upload, Trash2, X, ZoomIn, Play, Image, Film, ChevronLeft, ChevronRight, AlertCircle, FileText, ExternalLink, File } from 'lucide-react'
import { useMediaUpload } from '@/contexts/MediaUploadContext'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://vfntpdpneusqgcwxwkix.supabase.co'
const BUCKET = 'site-media'

function getPublicUrl(filePath: string) {
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${filePath}`
}

function fmtBytes(b: number) {
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`
  return `${(b / (1024 * 1024)).toFixed(1)} MB`
}

interface MediaItem {
  id: string
  site_id: string
  name: string
  media_type: 'photo' | 'video' | 'document'
  file_path: string
  mime_type: string | null
  file_size_kb: number | null
  description: string | null
  uploaded_by: string
  uploaded_at: string
}

interface Props {
  siteId: string
  onUploadingChange?: (uploading: boolean) => void
}

export default function SiteMediaGallery({ siteId, onUploadingChange }: Props) {
  const [items, setItems]                 = useState<MediaItem[]>([])
  const [loading, setLoading]             = useState(true)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const [dragOver, setDragOver]           = useState(false)

  const { isUploading, progress, uploadError, startUpload, cancelUpload, clearError } = useMediaUpload()

  // Only show upload state for this particular site
  const myUploading = isUploading && progress?.siteId === siteId
  const myProgress  = myUploading ? progress : null
  const myError     = uploadError   // global — always show

  const fileInputRef = useRef<HTMLInputElement>(null)

  const photos    = items.filter(i => i.media_type === 'photo')
  const videos    = items.filter(i => i.media_type === 'video')
  const documents = items.filter(i => i.media_type === 'document')
  const allForLightbox = [...photos, ...videos]

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await fetch(`/api/sites/${siteId}/media`)
      const data = await res.json()
      setItems(Array.isArray(data) ? data : [])
    } catch {
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [siteId])

  useEffect(() => { load() }, [load])

  // Notify parent tab bar whether this site's upload is active
  useEffect(() => { onUploadingChange?.(myUploading) }, [myUploading, onUploadingChange])

  // When an upload for this site finishes, refresh the list (catches files uploaded while tab was hidden)
  const prevUploadingRef = useRef(false)
  useEffect(() => {
    if (prevUploadingRef.current && !myUploading) load()
    prevUploadingRef.current = myUploading
  }, [myUploading, load])

  useEffect(() => {
    if (lightboxIndex === null) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape')      setLightboxIndex(null)
      if (e.key === 'ArrowRight')  setLightboxIndex(i => i !== null ? Math.min(i + 1, allForLightbox.length - 1) : null)
      if (e.key === 'ArrowLeft')   setLightboxIndex(i => i !== null ? Math.max(i - 1, 0) : null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lightboxIndex, allForLightbox.length])

  // ── Delegate all upload logic to the global context ──────────────────────
  function handleFiles(files: FileList | File[]) {
    const arr = Array.from(files)
    if (arr.length === 0) return
    if (isUploading) return  // global upload already running

    startUpload(arr, siteId, item => {
      // Called for each file that finishes — add thumbnail immediately
      setItems(prev => [item as unknown as MediaItem, ...prev])
    })
  }

  function handleCancel() { cancelUpload() }

  async function handleDelete(item: MediaItem) {
    if (!window.confirm(`Delete "${item.name}"? This cannot be undone.`)) return
    const res = await fetch(`/api/sites/${siteId}/media/${item.id}`, { method: 'DELETE' })
    if (res.ok) {
      setItems(prev => prev.filter(i => i.id !== item.id))
      if (lightboxIndex !== null) setLightboxIndex(null)
    } else {
      alert('Delete failed.')
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    if (e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files)
  }

  const fmtSize = (kb: number | null) => {
    if (!kb) return ''
    return kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`
  }
  const fmtDate = (s: string) =>
    new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

  const hasContent = items.length > 0

  // Overall progress — weighted by bytes, for this site's upload only
  const overallPct = myProgress
    ? Math.min(100, Math.round(
        ((myProgress.uploadedBytes + (myProgress.currentFileBytes * myProgress.currentFilePct / 100)) / myProgress.totalBytes) * 100
      ))
    : 0

  return (
    <div>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a', margin: 0 }}>
          Media &amp; Documents ({items.length})
          {hasContent && (
            <span style={{ fontSize: '13px', fontWeight: 400, color: '#94a3b8', marginLeft: '8px' }}>
              {photos.length > 0    && `${photos.length} photo${photos.length !== 1 ? 's' : ''}`}
              {photos.length > 0    && (videos.length > 0 || documents.length > 0) && ' · '}
              {videos.length > 0    && `${videos.length} video${videos.length !== 1 ? 's' : ''}`}
              {videos.length > 0    && documents.length > 0 && ' · '}
              {documents.length > 0 && `${documents.length} doc${documents.length !== 1 ? 's' : ''}`}
            </span>
          )}
        </h2>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            background: isUploading ? '#f1f5f9' : '#1a3a5c',
            color: isUploading ? '#94a3b8' : 'white',
            border: 'none', borderRadius: '7px', padding: '8px 16px',
            fontSize: '13px', fontWeight: 600, cursor: isUploading ? 'default' : 'pointer',
          }}
        >
          <Upload size={14} />
          Upload Files
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv"
          multiple
          style={{ display: 'none' }}
          onChange={e => e.target.files && handleFiles(e.target.files)}
        />
      </div>

      {/* ── Upload progress panel (only shown when this site is uploading) ─── */}
      {myUploading && myProgress && (
        <div style={{
          background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px',
          padding: '14px 16px', marginBottom: '14px',
        }}>
          {/* Overall row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a' }}>
              {myProgress!.fileCount === 1
                ? `Uploading ${myProgress!.currentFileName}`
                : `File ${myProgress!.fileIndex + 1} of ${myProgress!.fileCount} · ${fmtBytes(myProgress!.uploadedBytes + myProgress!.currentFileBytes * myProgress!.currentFilePct / 100)} of ${fmtBytes(myProgress!.totalBytes)}`
              }
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#1a3a5c' }}>{overallPct}%</span>
              <button
                onClick={handleCancel}
                title="Cancel upload"
                style={{
                  display: 'flex', alignItems: 'center', gap: '4px',
                  background: 'white', border: '1px solid #fca5a5', borderRadius: '6px',
                  padding: '4px 10px', cursor: 'pointer', color: '#dc2626', fontSize: '12px', fontWeight: 600,
                }}
              >
                <X size={12} /> Cancel
              </button>
            </div>
          </div>

          {/* Overall bar */}
          <div style={{ height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden', marginBottom: myProgress!.fileCount > 1 ? '10px' : '0' }}>
            <div style={{
              height: '100%', width: `${overallPct}%`,
              background: 'linear-gradient(90deg, #1a3a5c, #2563eb)',
              borderRadius: '3px', transition: 'width 0.2s ease',
            }} />
          </div>

          {/* Per-file row (only shown for multi-file batches) */}
          {myProgress!.fileCount > 1 && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px', marginTop: '2px' }}>
                <span style={{ fontSize: '12px', color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '80%' }}>
                  Currently: <strong style={{ color: '#0f172a' }}>{myProgress!.currentFileName}</strong>
                </span>
                <span style={{ fontSize: '11px', color: '#94a3b8', flexShrink: 0, marginLeft: '8px' }}>
                  {myProgress!.currentFilePct}%
                </span>
              </div>
              <div style={{ height: '4px', background: '#e2e8f0', borderRadius: '2px', overflow: 'hidden' }}>
                <div style={{
                  height: '100%', width: `${myProgress!.currentFilePct}%`,
                  background: '#60a5fa', borderRadius: '2px', transition: 'width 0.15s ease',
                }} />
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Error banner ────────────────────────────────────────────────────── */}
      {myError && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '7px', padding: '10px 14px', marginBottom: '14px', fontSize: '13px', color: '#dc2626' }}>
          <AlertCircle size={14} />
          {myError}
          <button onClick={clearError} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626' }}>✕</button>
        </div>
      )}

      {/* ── Drop zone / gallery ─────────────────────────────────────────────── */}
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        style={{
          background: dragOver ? '#eff6ff' : 'white',
          border: `2px ${dragOver ? 'solid #2563eb' : 'dashed #e2e8f0'}`,
          borderRadius: '10px', transition: 'all 0.15s',
          minHeight: '120px', padding: hasContent ? '16px' : '0',
        }}
      >
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '120px', color: '#94a3b8', fontSize: '13px' }}>
            Loading…
          </div>
        ) : !hasContent ? (
          <div
            onClick={() => fileInputRef.current?.click()}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '140px', gap: '10px', cursor: 'pointer' }}
          >
            <div style={{ background: '#f1f5f9', borderRadius: '50%', padding: '14px' }}>
              <Image size={24} color="#94a3b8" />
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '14px', fontWeight: 600, color: '#475569' }}>Drop files here to upload</div>
              <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>Photos · Videos · PDF · Word · Excel · PowerPoint</div>
            </div>
          </div>
        ) : (
          <>
            {photos.length > 0 && (
              <div style={{ marginBottom: '20px' }}>
                <SectionLabel icon={<Image size={13} />} label={`Photos (${photos.length})`} />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '10px' }}>
                  {photos.map((item, idx) => (
                    <PhotoTile key={item.id} item={item} onView={() => setLightboxIndex(idx)} onDelete={() => handleDelete(item)} getUrl={getPublicUrl} />
                  ))}
                </div>
              </div>
            )}

            {videos.length > 0 && (
              <div style={{ marginBottom: documents.length > 0 ? '20px' : '0' }}>
                <SectionLabel icon={<Film size={13} />} label={`Videos (${videos.length})`} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {videos.map((item, idx) => (
                    <VideoRow key={item.id} item={item} onView={() => setLightboxIndex(photos.length + idx)} onDelete={() => handleDelete(item)} fmtSize={fmtSize} fmtDate={fmtDate} />
                  ))}
                </div>
              </div>
            )}

            {documents.length > 0 && (
              <div>
                <SectionLabel icon={<FileText size={13} />} label={`Documents (${documents.length})`} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {documents.map(item => (
                    <DocumentRow key={item.id} item={item} onDelete={() => handleDelete(item)} fmtSize={fmtSize} fmtDate={fmtDate} getUrl={getPublicUrl} />
                  ))}
                </div>
              </div>
            )}

            <div style={{ marginTop: '14px', fontSize: '12px', color: '#cbd5e1', textAlign: 'center' }}>
              Drop more files here to upload
            </div>
          </>
        )}
      </div>

      {/* ── Lightbox ────────────────────────────────────────────────────────── */}
      {lightboxIndex !== null && allForLightbox[lightboxIndex] && (
        <Lightbox
          items={allForLightbox}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onPrev={() => setLightboxIndex(i => i !== null ? Math.max(i - 1, 0) : null)}
          onNext={() => setLightboxIndex(i => i !== null ? Math.min(i + 1, allForLightbox.length - 1) : null)}
          onDelete={handleDelete}
          getUrl={getPublicUrl}
          fmtSize={fmtSize}
          fmtDate={fmtDate}
        />
      )}
    </div>
  )
}

// ── Section label ─────────────────────────────────────────────────────────────
function SectionLabel({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px', fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
      {icon} {label}
    </div>
  )
}

// ── Doc type badge ────────────────────────────────────────────────────────────
function docBadge(mime: string | null, name: string): { label: string; bg: string; color: string } {
  const m = mime ?? ''
  const n = name.toLowerCase()
  if (m === 'application/pdf' || n.endsWith('.pdf'))
    return { label: 'PDF', bg: '#fee2e2', color: '#dc2626' }
  if (m.includes('word') || n.endsWith('.doc') || n.endsWith('.docx'))
    return { label: 'DOC', bg: '#dbeafe', color: '#2563eb' }
  if (m.includes('excel') || m.includes('spreadsheet') || n.endsWith('.xls') || n.endsWith('.xlsx'))
    return { label: 'XLS', bg: '#dcfce7', color: '#16a34a' }
  if (m.includes('powerpoint') || m.includes('presentation') || n.endsWith('.ppt') || n.endsWith('.pptx'))
    return { label: 'PPT', bg: '#ffedd5', color: '#ea580c' }
  if (m === 'text/csv' || n.endsWith('.csv'))
    return { label: 'CSV', bg: '#f0fdf4', color: '#15803d' }
  return { label: 'FILE', bg: '#f1f5f9', color: '#64748b' }
}

// ── Photo tile ────────────────────────────────────────────────────────────────
function PhotoTile({ item, onView, onDelete, getUrl }: {
  item: MediaItem; onView: () => void; onDelete: () => void; getUrl: (p: string) => string
}) {
  const [hovered, setHovered] = useState(false)
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ position: 'relative', aspectRatio: '1', borderRadius: '8px', overflow: 'hidden', background: '#f1f5f9', cursor: 'pointer', border: '1px solid #e2e8f0' }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={getUrl(item.file_path)} alt={item.name} onClick={onView} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} loading="lazy" />
      {hovered && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
          <button onClick={onView} style={{ background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.4)', borderRadius: '6px', padding: '6px', cursor: 'pointer', color: 'white', display: 'flex' }}>
            <ZoomIn size={16} />
          </button>
          <button onClick={e => { e.stopPropagation(); onDelete() }} style={{ background: 'rgba(220,38,38,0.7)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '6px', padding: '6px', cursor: 'pointer', color: 'white', display: 'flex' }}>
            <Trash2 size={16} />
          </button>
        </div>
      )}
    </div>
  )
}

// ── Video row ─────────────────────────────────────────────────────────────────
function VideoRow({ item, onView, onDelete, fmtSize, fmtDate }: {
  item: MediaItem; onView: () => void; onDelete: () => void
  fmtSize: (kb: number | null) => string; fmtDate: (s: string) => string
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 14px' }}>
      <button onClick={onView} style={{ background: '#1a3a5c', border: 'none', borderRadius: '6px', padding: '8px', cursor: 'pointer', color: 'white', display: 'flex', flexShrink: 0 }}>
        <Play size={16} />
      </button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</div>
        <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>
          {fmtSize(item.file_size_kb)} · {fmtDate(item.uploaded_at)} · {item.uploaded_by}
        </div>
        {item.description && <div style={{ fontSize: '12px', color: '#64748b', marginTop: '3px' }}>{item.description}</div>}
      </div>
      <button onClick={onDelete} style={{ background: 'white', border: '1px solid #fca5a5', borderRadius: '6px', padding: '6px', cursor: 'pointer', color: '#dc2626', display: 'flex', flexShrink: 0 }}>
        <Trash2 size={14} />
      </button>
    </div>
  )
}

// ── Document row ──────────────────────────────────────────────────────────────
function DocumentRow({ item, onDelete, fmtSize, fmtDate, getUrl }: {
  item: MediaItem; onDelete: () => void
  fmtSize: (kb: number | null) => string; fmtDate: (s: string) => string; getUrl: (p: string) => string
}) {
  const badge = docBadge(item.mime_type, item.name)
  function open() { window.open(getUrl(item.file_path), '_blank', 'noopener,noreferrer') }
  return (
    <div
      onClick={open}
      style={{ display: 'flex', alignItems: 'center', gap: '12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 14px', cursor: 'pointer' }}
      onMouseEnter={e => (e.currentTarget.style.background = '#f1f5f9')}
      onMouseLeave={e => (e.currentTarget.style.background = '#f8fafc')}
    >
      <div style={{ background: badge.bg, borderRadius: '8px', padding: '9px', display: 'flex', flexShrink: 0 }}>
        <File size={18} color={badge.color} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</span>
          <span style={{ fontSize: '11px', fontWeight: 700, color: badge.color, background: badge.bg, borderRadius: '4px', padding: '1px 6px', flexShrink: 0 }}>{badge.label}</span>
        </div>
        <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>
          {[fmtSize(item.file_size_kb), fmtDate(item.uploaded_at), item.uploaded_by].filter(Boolean).join(' · ')}
        </div>
        {item.description && <div style={{ fontSize: '12px', color: '#64748b', marginTop: '3px' }}>{item.description}</div>}
      </div>
      <ExternalLink size={13} color="#94a3b8" style={{ flexShrink: 0 }} />
      <button onClick={e => { e.stopPropagation(); onDelete() }} style={{ background: 'white', border: '1px solid #fca5a5', borderRadius: '6px', padding: '6px', cursor: 'pointer', color: '#dc2626', display: 'flex', flexShrink: 0 }}>
        <Trash2 size={14} />
      </button>
    </div>
  )
}

// ── Lightbox ──────────────────────────────────────────────────────────────────
function Lightbox({ items, index, onClose, onPrev, onNext, onDelete, getUrl, fmtSize, fmtDate }: {
  items: MediaItem[]; index: number; onClose: () => void; onPrev: () => void; onNext: () => void
  onDelete: (item: MediaItem) => void; getUrl: (p: string) => string
  fmtSize: (kb: number | null) => string; fmtDate: (s: string) => string
}) {
  const item = items[index]
  const url  = getUrl(item.file_path)
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 100, display: 'flex', flexDirection: 'column' }}>
      <div onClick={e => e.stopPropagation()} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', flexShrink: 0 }}>
        <div>
          <div style={{ color: 'white', fontSize: '14px', fontWeight: 600 }}>{item.name}</div>
          <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', marginTop: '2px' }}>
            {index + 1} / {items.length} · {fmtSize(item.file_size_kb)} · {fmtDate(item.uploaded_at)} · {item.uploaded_by}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => { onDelete(item); onClose() }} style={{ background: 'rgba(220,38,38,0.3)', border: '1px solid rgba(220,38,38,0.5)', borderRadius: '6px', padding: '7px 12px', cursor: 'pointer', color: '#fca5a5', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '13px' }}>
            <Trash2 size={14} /> Delete
          </button>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '6px', padding: '7px 10px', cursor: 'pointer', color: 'white', display: 'flex' }}>
            <X size={18} />
          </button>
        </div>
      </div>

      <div onClick={e => e.stopPropagation()} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', minHeight: 0, padding: '0 56px' }}>
        {index > 0 && (
          <button onClick={onPrev} style={{ position: 'absolute', left: '12px', background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '50%', padding: '10px', cursor: 'pointer', color: 'white', display: 'flex', zIndex: 1 }}>
            <ChevronLeft size={22} />
          </button>
        )}
        {item.media_type === 'photo'
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={url} alt={item.name} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: '4px' }} />
          : <video src={url} controls autoPlay style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: '4px', background: 'black' }} />
        }
        {index < items.length - 1 && (
          <button onClick={onNext} style={{ position: 'absolute', right: '12px', background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '50%', padding: '10px', cursor: 'pointer', color: 'white', display: 'flex', zIndex: 1 }}>
            <ChevronRight size={22} />
          </button>
        )}
      </div>

      <div onClick={e => e.stopPropagation()} style={{ padding: '14px 20px', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
        {item.description && <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '13px', textAlign: 'center' }}>{item.description}</div>}
        <div style={{ display: 'flex', gap: '6px' }}>
          {items.map((_, i) => (
            <div key={i} style={{ width: i === index ? '20px' : '6px', height: '6px', borderRadius: '3px', background: i === index ? 'white' : 'rgba(255,255,255,0.3)', transition: 'all 0.2s' }} />
          ))}
        </div>
      </div>
    </div>
  )
}
