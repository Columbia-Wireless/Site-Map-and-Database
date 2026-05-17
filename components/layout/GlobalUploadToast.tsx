'use client'

import { X, Upload } from 'lucide-react'
import { useMediaUpload } from '@/contexts/MediaUploadContext'

function fmtBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function GlobalUploadToast() {
  const { isUploading, progress, uploadError, cancelUpload, clearError } = useMediaUpload()

  if (!isUploading && !uploadError) return null

  const overallPct = progress
    ? Math.min(100, Math.round(
        ((progress.uploadedBytes + progress.currentFileBytes * progress.currentFilePct / 100) / progress.totalBytes) * 100
      ))
    : 0

  return (
    <div style={{
      position: 'fixed', bottom: '24px', right: '24px', zIndex: 9999,
      background: '#0f2744', borderRadius: '12px', padding: '14px 16px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.4)', width: '300px',
      border: '1px solid rgba(255,255,255,0.08)',
    }}>
      {isUploading && progress ? (
        <>
          {/* Header row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
              <Upload size={13} color="#60a5fa" />
              <span style={{ color: 'white', fontSize: '13px', fontWeight: 600 }}>
                {progress.fileCount === 1
                  ? 'Uploading…'
                  : `File ${progress.fileIndex + 1} of ${progress.fileCount}`}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: '#93c5fd', fontSize: '12px', fontWeight: 700 }}>{overallPct}%</span>
              <button
                onClick={cancelUpload}
                style={{
                  background: 'rgba(220,38,38,0.35)', border: '1px solid rgba(220,38,38,0.5)',
                  borderRadius: '5px', padding: '3px 8px', cursor: 'pointer',
                  color: '#fca5a5', fontSize: '11px', fontWeight: 600,
                  display: 'flex', alignItems: 'center', gap: '3px',
                }}
              >
                <X size={10} /> Cancel
              </button>
            </div>
          </div>

          {/* Overall progress bar */}
          <div style={{ height: '5px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden', marginBottom: '8px' }}>
            <div style={{
              height: '100%', width: `${overallPct}%`,
              background: 'linear-gradient(90deg, #3b82f6, #60a5fa)',
              borderRadius: '3px', transition: 'width 0.2s ease',
            }} />
          </div>

          {/* File name + byte count */}
          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.45)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {progress.currentFileName}
          </div>
          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', marginTop: '2px' }}>
            {fmtBytes(progress.uploadedBytes + progress.currentFileBytes * progress.currentFilePct / 100)} of {fmtBytes(progress.totalBytes)}
          </div>
        </>
      ) : uploadError ? (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
          <span style={{ color: '#fca5a5', fontSize: '13px', flex: 1 }}>{uploadError}</span>
          <button onClick={clearError} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', padding: '0', fontSize: '16px', lineHeight: 1 }}>✕</button>
        </div>
      ) : null}
    </div>
  )
}
