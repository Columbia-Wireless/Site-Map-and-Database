'use client'

import { useState, useEffect } from 'react'
import { X, FileText, Loader2, ExternalLink } from 'lucide-react'

interface Props {
  siteId: string
  docId: string
  docName?: string
  onClose: () => void
}

export default function DocViewerModal({ siteId, docId, docName, onClose }: Props) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null)
  const [name, setName]           = useState(docName ?? 'Document')
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/sites/${siteId}/documents/${docId}`)
      .then(r => r.json())
      .then(d => {
        if (d.signedUrl) { setSignedUrl(d.signedUrl); if (d.name) setName(d.name) }
        else setError(d.error ?? 'Could not load document')
      })
      .catch(() => setError('Network error'))
      .finally(() => setLoading(false))
  }, [siteId, docId])

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 200 }}
      />

      {/* Panel */}
      <div style={{
        position: 'fixed', inset: '5%', zIndex: 201,
        background: 'white', borderRadius: '12px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 20px', borderBottom: '1px solid #e2e8f0',
          background: '#1a3a5c', flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <FileText size={16} color="rgba(255,255,255,0.7)" />
            <span style={{ color: 'white', fontWeight: 600, fontSize: '14px' }}>{name}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {signedUrl && (
              <a
                href={signedUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: 'flex', alignItems: 'center', gap: '5px', color: 'rgba(255,255,255,0.75)', fontSize: '12px', textDecoration: 'none' }}
              >
                <ExternalLink size={13} /> Open in new tab
              </a>
            )}
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.7)', padding: '4px', display: 'flex' }}>
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, minHeight: 0 }}>
          {loading && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '10px', color: '#64748b' }}>
              <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />
              Loading document…
            </div>
          )}
          {error && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: '8px', color: '#dc2626' }}>
              <span style={{ fontSize: '14px' }}>{error}</span>
            </div>
          )}
          {signedUrl && !loading && (
            <iframe
              src={signedUrl}
              style={{ width: '100%', height: '100%', border: 'none' }}
              title={name}
            />
          )}
        </div>
      </div>
    </>
  )
}
