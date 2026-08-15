'use client'

import { useState, useRef } from 'react'
import { X, Upload, AlertCircle, Loader2 } from 'lucide-react'

interface ExtractedSite {
  values: Record<string, any>
  confidence: Record<string, 'high' | 'medium' | 'low'>
  filename: string
}

interface Props {
  onClose: () => void
  onExtracted: (result: ExtractedSite) => void
}

export default function AddSiteFromLeaseModal({ onClose, onExtracted }: Props) {
  const [dragOver, setDragOver] = useState(false)
  const [extracting, setExtracting] = useState(false)
  const [extractError, setExtractError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  async function extractFromPDF(file: File) {
    if (!file.type.includes('pdf')) { setExtractError('Please upload a PDF file'); return }
    setExtracting(true); setExtractError('')
    const form = new FormData(); form.append('file', file)
    const res = await fetch('/api/sites/extract-from-lease', { method: 'POST', body: form })
    const data = await res.json()
    setExtracting(false)
    if (!res.ok) { setExtractError(data.error ?? 'Extraction failed'); return }
    onExtracted({ values: data.values, confidence: data.confidence, filename: data.filename })
  }

  function onFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) extractFromPDF(file)
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault(); setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) extractFromPDF(file)
  }

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 9998, background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: 'white', borderRadius: '14px', width: '100%', maxWidth: '560px', boxShadow: '0 24px 64px rgba(0,0,0,0.3)' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid #f1f5f9' }}>
          <div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>Create Site from Lease Document</div>
            <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>Upload the lease PDF — site details will be pre-filled for your review</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={20} /></button>
        </div>

        <div style={{ padding: '20px 24px 24px' }}>
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => fileRef.current?.click()}
            style={{
              border: `2px dashed ${dragOver ? '#2563eb' : '#e2e8f0'}`,
              borderRadius: '12px', padding: '48px 24px', textAlign: 'center',
              background: dragOver ? '#eff6ff' : '#fafafa', cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            <input ref={fileRef} type="file" accept=".pdf" onChange={onFileInput} style={{ display: 'none' }} />
            {extracting ? (
              <div>
                <Loader2 size={32} color="#2563eb" style={{ margin: '0 auto 12px', animation: 'spin 1s linear infinite' }} />
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a' }}>Reading lease document…</div>
                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>Claude is extracting site details</div>
              </div>
            ) : (
              <div>
                <Upload size={32} color="#94a3b8" style={{ margin: '0 auto 12px' }} />
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a' }}>Drop a lease PDF here or click to browse</div>
                <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>Original lease or amendment for a new site</div>
              </div>
            )}
          </div>
          {extractError && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '7px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '10px 14px', marginTop: '12px', fontSize: '13px', color: '#b91c1c' }}>
              <AlertCircle size={14} /> {extractError}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
