'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Upload, Trash2, X, ZoomIn, Play, Image, Film, ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const BUCKET = 'site-media'

function getPublicUrl(filePath: string) {
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${filePath}`
}

interface MediaItem {
  id: string
  site_id: string
  name: string
  media_type: 'photo' | 'video'
  file_path: string
  mime_type: string | null
  file_size_kb: number | null
  description: string | null
  uploaded_by: string
  uploaded_at: string
}

interface Props {
  siteId: string
}

export default function SiteMediaGallery({ siteId }: Props) {
  const [items, setItems] = useState<MediaItem[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const photos = items.filter(i => i.media_type === 'photo')
  const videos = items.filter(i => i.media_type === 'video')

  // All items ordered photo-first for lightbox navigation
  const allForLightbox = [...photos, ...videos]

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/sites/${siteId}/media`)
      const data = await res.json()
      setItems(Array.isArray(data) ? data : [])
    } catch {
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [siteId])

  useEffect(() => { load() }, [load])

  // Keyboard navigation for lightbox
  useEffect(() => {
    if (lightboxIndex === null) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setLightboxIndex(null)
      if (e.key === 'ArrowRight') setLightboxIndex(i => i !== null ? Math.min(i + 1, allForLightbox.length - 1) : null)
      if (e.key === 'ArrowLeft') setLightboxIndex(i => i !== null ? Math.max(i - 1, 0) : null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lightboxIndex, allForLightbox.length])

  async function handleFiles(files: FileList | File[]) {
    const arr = Array.from(files)
    if (arr.length === 0) return
    setUploading(true)
    setUploadError(null)
    let uploaded = 0
    for (const file of arr) {
      setUploadProgress(`Uploading ${file.name} (${uploaded + 1}/${arr.length})…`)
      const fd = new FormData()
      fd.append('file', file)
      try {
        const res = await fetch(`/api/sites/${siteId}/media`, { method: 'POST', body: fd })
        if (!res.ok) {
          const j = await res.json()
          setUploadError(j.error ?? 'Upload failed')
        } else {
          uploaded++
        }
      } catch {
        setUploadError('Upload failed — please try again.')
      }
    }
    setUploading(false)
    setUploadProgress(null)
    await load()
  }

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

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a', margin: 0 }}>
          Media ({items.length})
          {items.length > 0 && (
            <span style={{ fontSize: '13px', fontWeight: 400, color: '#94a3b8', marginLeft: '8px' }}>
              {photos.length} photo{photos.length !== 1 ? 's' : ''} · {videos.length} video{videos.length !== 1 ? 's' : ''}
            </span>
          )}
        </h2>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            background: uploading ? '#f1f5f9' : '#1a3a5c', color: uploading ? '#94a3b8' : 'white',
            border: 'none', borderRadius: '7px', padding: '8px 16px',
            fontSize: '13px', fontWeight: 600, cursor: uploading ? 'default' : 'pointer',
          }}
        >
          <Upload size={14} />
          {uploading ? (uploadProgress ?? 'Uploading…') : 'Upload Files'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          multiple
          style={{ display: 'none' }}
          onChange={e => e.target.files && handleFiles(e.target.files)}
        />
      </div>

      {uploadError && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '7px', padding: '10px 14px', marginBottom: '14px', fontSize: '13px', color: '#dc2626' }}>
          <AlertCircle size={14} />
          {uploadError}
          <button onClick={() => setUploadError(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626' }}>✕</button>
        </div>
      )}

      {/* Drop zone / gallery */}
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        style={{
          background: dragOver ? '#eff6ff' : 'white',
          border: `2px ${dragOver ? 'solid #2563eb' : 'dashed #e2e8f0'}`,
          borderRadius: '10px',
          transition: 'all 0.15s',
          minHeight: '120px',
          padding: items.length === 0 ? '0' : '16px',
        }}
      >
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '120px', color: '#94a3b8', fontSize: '13px' }}>
            Loading media…
          </div>
        ) : items.length === 0 ? (
          <div
            onClick={() => fileInputRef.current?.click()}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '140px', gap: '10px', cursor: 'pointer' }}
          >
            <div style={{ background: '#f1f5f9', borderRadius: '50%', padding: '14px' }}>
              <Image size={24} color="#94a3b8" />
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '14px', fontWeight: 600, color: '#475569' }}>Drop photos & videos here</div>
              <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>or click to browse · JPEG, PNG, WebP, MP4, MOV · max 50 MB each</div>
            </div>
          </div>
        ) : (
          <>
            {/* Photos */}
            {photos.length > 0 && (
              <div style={{ marginBottom: videos.length > 0 ? '20px' : '0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px', fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  <Image size={13} /> Photos ({photos.length})
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '10px' }}>
                  {photos.map((item, idx) => (
                    <PhotoTile
                      key={item.id}
                      item={item}
                      onView={() => setLightboxIndex(idx)}
                      onDelete={() => handleDelete(item)}
                      getUrl={getPublicUrl}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Videos */}
            {videos.length > 0 && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px', fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  <Film size={13} /> Videos ({videos.length})
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {videos.map((item, idx) => (
                    <VideoRow
                      key={item.id}
                      item={item}
                      onView={() => setLightboxIndex(photos.length + idx)}
                      onDelete={() => handleDelete(item)}
                      fmtSize={fmtSize}
                      fmtDate={fmtDate}
                      getUrl={getPublicUrl}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Drag hint at bottom */}
            <div style={{ marginTop: '14px', fontSize: '12px', color: '#cbd5e1', textAlign: 'center' }}>
              Drop more files here to upload
            </div>
          </>
        )}
      </div>

      {/* Lightbox */}
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

// ── Photo tile ────────────────────────────────────────────────────────────────
function PhotoTile({ item, onView, onDelete, getUrl }: {
  item: MediaItem
  onView: () => void
  onDelete: () => void
  getUrl: (p: string) => string
}) {
  const [hovered, setHovered] = useState(false)
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ position: 'relative', aspectRatio: '1', borderRadius: '8px', overflow: 'hidden', background: '#f1f5f9', cursor: 'pointer', border: '1px solid #e2e8f0' }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={getUrl(item.file_path)}
        alt={item.name}
        onClick={onView}
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        loading="lazy"
      />
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
function VideoRow({ item, onView, onDelete, fmtSize, fmtDate, getUrl }: {
  item: MediaItem
  onView: () => void
  onDelete: () => void
  fmtSize: (kb: number | null) => string
  fmtDate: (s: string) => string
  getUrl: (p: string) => string
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

// ── Lightbox ──────────────────────────────────────────────────────────────────
function Lightbox({ items, index, onClose, onPrev, onNext, onDelete, getUrl, fmtSize, fmtDate }: {
  items: MediaItem[]
  index: number
  onClose: () => void
  onPrev: () => void
  onNext: () => void
  onDelete: (item: MediaItem) => void
  getUrl: (p: string) => string
  fmtSize: (kb: number | null) => string
  fmtDate: (s: string) => string
}) {
  const item = items[index]
  const url = getUrl(item.file_path)

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 100, display: 'flex', flexDirection: 'column' }}
    >
      {/* Top bar */}
      <div onClick={e => e.stopPropagation()} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', flexShrink: 0 }}>
        <div>
          <div style={{ color: 'white', fontSize: '14px', fontWeight: 600 }}>{item.name}</div>
          <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', marginTop: '2px' }}>
            {index + 1} / {items.length} · {fmtSize(item.file_size_kb)} · {fmtDate(item.uploaded_at)} · {item.uploaded_by}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => { onDelete(item); onClose() }}
            style={{ background: 'rgba(220,38,38,0.3)', border: '1px solid rgba(220,38,38,0.5)', borderRadius: '6px', padding: '7px 12px', cursor: 'pointer', color: '#fca5a5', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '13px' }}
          >
            <Trash2 size={14} /> Delete
          </button>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '6px', padding: '7px 10px', cursor: 'pointer', color: 'white', display: 'flex' }}>
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Media area */}
      <div onClick={e => e.stopPropagation()} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', minHeight: 0, padding: '0 56px' }}>
        {index > 0 && (
          <button onClick={onPrev} style={{ position: 'absolute', left: '12px', background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '50%', padding: '10px', cursor: 'pointer', color: 'white', display: 'flex', zIndex: 1 }}>
            <ChevronLeft size={22} />
          </button>
        )}

        {item.media_type === 'photo' ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={item.name} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: '4px' }} />
        ) : (
          <video
            src={url}
            controls
            autoPlay
            style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: '4px', background: 'black' }}
          />
        )}

        {index < items.length - 1 && (
          <button onClick={onNext} style={{ position: 'absolute', right: '12px', background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '50%', padding: '10px', cursor: 'pointer', color: 'white', display: 'flex', zIndex: 1 }}>
            <ChevronRight size={22} />
          </button>
        )}
      </div>

      {/* Description / dot indicators */}
      <div onClick={e => e.stopPropagation()} style={{ padding: '14px 20px', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
        {item.description && (
          <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '13px', textAlign: 'center' }}>{item.description}</div>
        )}
        <div style={{ display: 'flex', gap: '6px' }}>
          {items.map((_, i) => (
            <div
              key={i}
              onClick={() => { /* handled by parent lightbox index state */ }}
              style={{ width: i === index ? '20px' : '6px', height: '6px', borderRadius: '3px', background: i === index ? 'white' : 'rgba(255,255,255,0.3)', transition: 'all 0.2s', cursor: 'default' }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
