'use client'

import { createContext, useContext, useState, useRef, useCallback } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UploadedMediaItem {
  id: string; name: string; media_type: string; file_path: string
  mime_type: string | null; file_size_kb: number | null
  description: string | null; uploaded_by: string; uploaded_at: string; site_id: string
}

export interface UploadProgress {
  siteId: string
  fileIndex: number
  fileCount: number
  currentFileName: string
  currentFilePct: number
  currentFileBytes: number
  totalBytes: number
  uploadedBytes: number
}

interface MediaUploadContextValue {
  isUploading: boolean
  progress: UploadProgress | null
  uploadError: string | null
  startUpload: (files: File[], siteId: string, onItemDone?: (item: UploadedMediaItem) => void) => void
  cancelUpload: () => void
  clearError: () => void
}

// ─── Context ──────────────────────────────────────────────────────────────────

const MediaUploadContext = createContext<MediaUploadContextValue>({
  isUploading: false, progress: null, uploadError: null,
  startUpload: () => {}, cancelUpload: () => {}, clearError: () => {},
})

// ─── Provider ─────────────────────────────────────────────────────────────────

export function MediaUploadProvider({ children }: { children: React.ReactNode }) {
  const [isUploading, setIsUploading] = useState(false)
  const [progress, setProgress]       = useState<UploadProgress | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const xhrRef         = useRef<XMLHttpRequest | null>(null)
  const cancelledRef   = useRef(false)
  const isUploadingRef = useRef(false)
  const onItemDoneRef  = useRef<((item: UploadedMediaItem) => void) | undefined>(undefined)

  const cancelUpload = useCallback(() => {
    cancelledRef.current = true
    xhrRef.current?.abort()
    xhrRef.current = null
  }, [])

  const clearError = useCallback(() => setUploadError(null), [])

  const startUpload = useCallback(async (
    files: File[],
    siteId: string,
    onItemDone?: (item: UploadedMediaItem) => void,
  ) => {
    if (isUploadingRef.current) return

    isUploadingRef.current = true
    onItemDoneRef.current  = onItemDone
    cancelledRef.current   = false
    setIsUploading(true)
    setUploadError(null)

    const totalBytes = files.reduce((s, f) => s + f.size, 0)
    let uploadedBytes = 0

    for (let i = 0; i < files.length; i++) {
      if (cancelledRef.current) break
      const file = files[i]

      setProgress({
        siteId, fileIndex: i, fileCount: files.length,
        currentFileName: file.name, currentFilePct: 0,
        currentFileBytes: file.size, totalBytes, uploadedBytes,
      })

      // ── Step 1: get a server-signed upload URL (uses service role → bypasses RLS)
      const signRes = await fetch(
        `/api/sites/${siteId}/media/sign?filename=${encodeURIComponent(file.name)}&mime=${encodeURIComponent(file.type)}`,
      ).catch(() => null)

      if (!signRes?.ok) {
        setUploadError(`Upload failed: ${file.name} — could not generate upload URL`)
        continue
      }

      const { signedUrl, filePath } = await signRes.json().catch(() => ({ signedUrl: null, filePath: null }))

      if (!signedUrl || !filePath) {
        setUploadError(`Upload failed: ${file.name} — invalid server response`)
        continue
      }

      console.log('[upload] filePath:', filePath, 'size:', file.size, 'type:', file.type)

      // ── Step 2: PUT the file directly to Supabase via the signed URL ──────────
      // This bypasses Cloud Run body limits (signed URL goes browser → Supabase directly).
      // Signed URLs respect the bucket's file_size_limit (500 MB) rather than the
      // unauthenticated 50 MB cap, so large videos work correctly.
      const storageResult = await new Promise<{ ok: boolean; body?: string }>(resolve => {
        const xhr = new XMLHttpRequest()
        xhrRef.current = xhr

        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable && !cancelledRef.current) {
            setProgress(prev => prev
              ? { ...prev, currentFilePct: Math.round((e.loaded / e.total) * 100) }
              : null)
          }
        })

        xhr.addEventListener('load', () => {
          xhrRef.current = null
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve({ ok: true })
          } else {
            console.error('[upload] PUT failed:', xhr.status, xhr.responseText)
            resolve({ ok: false, body: `HTTP ${xhr.status}: ${xhr.responseText.slice(0, 200)}` })
          }
        })

        xhr.addEventListener('error', () => {
          xhrRef.current = null
          resolve({ ok: false, body: 'Network error' })
        })

        xhr.addEventListener('abort', () => {
          xhrRef.current = null
          resolve({ ok: false, body: 'Cancelled' })
        })

        xhr.open('PUT', signedUrl)
        xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream')
        xhr.send(file)
      })

      if (cancelledRef.current) break

      if (!storageResult.ok) {
        setUploadError(`Upload failed: ${file.name} — ${storageResult.body ?? 'Unknown error'}`)
        continue
      }

      // ── Step 3: save metadata to DB ────────────────────────────────────────────
      try {
        const metaRes = await fetch(`/api/sites/${siteId}/media`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: file.name, filePath, mimeType: file.type || 'application/octet-stream',
            fileSizeKb: Math.round(file.size / 1024), description: '', uploadedBy: 'Admin',
          }),
        })
        if (metaRes.ok) {
          const item: UploadedMediaItem = await metaRes.json()
          onItemDoneRef.current?.(item)
          uploadedBytes += file.size
          setProgress(prev => prev ? { ...prev, uploadedBytes, currentFilePct: 100 } : null)
        } else {
          const j = await metaRes.json().catch(() => ({}))
          setUploadError(`Saved to storage but metadata failed: ${j.error ?? metaRes.status}`)
        }
      } catch {
        setUploadError('Saved to storage but could not record in database')
      }
    }

    isUploadingRef.current = false
    setIsUploading(false)
    setProgress(null)
    onItemDoneRef.current = undefined
  }, [])

  return (
    <MediaUploadContext.Provider value={{ isUploading, progress, uploadError, startUpload, cancelUpload, clearError }}>
      {children}
    </MediaUploadContext.Provider>
  )
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useMediaUpload() {
  return useContext(MediaUploadContext)
}
