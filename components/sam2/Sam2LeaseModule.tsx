'use client'

import { useEffect, useRef, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { Loader2 } from 'lucide-react'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://vfntpdpneusqgcwxwkix.supabase.co'
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZmbnRwZHBuZXVzcWdjd3h3a2l4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5NTg2MzEsImV4cCI6MjA5MzUzNDYzMX0.kFZ6b2WKAl7GVsEQZeO33qcxhyBruQlTfW0eZfkcg1c'

/**
 * Payload shape is not fully confirmed yet — SAM 2.0 today only sends
 * {docId, siteId, agreementId, fileName, docType}; the full extracted record
 * requested in docs/scetv-integration-requirements.md hasn't landed. Typed as
 * unknown here deliberately rather than asserting a shape we haven't verified
 * — see lib/sam2Types.ts for the shape /api/sam2/sync expects once it has.
 */
export type Sam2DocumentParsedPayload = unknown

interface Sam2ModuleProps {
  /**
   * Base URL of the deployed SAM 2.0 module. Falls back to NEXT_PUBLIC_SAM2_URL,
   * then to the real production SAM 2.0 URL — Dockerfile doesn't pass this var
   * as a build arg, so without this fallback a Cloud Run build would bake in
   * whatever NEXT_PUBLIC_SAM2_URL happens to be unset to (never localhost in
   * prod). Mirrors the same pattern lib/supabase.ts uses for Supabase creds.
   */
  sam2Url?: string
  /** Scopes SAM 2.0's view to a single site. Omit for batch/import mode across all sites. */
  siteId?: string
  onDocumentParsed?: (data: Sam2DocumentParsedPayload) => void
  onReconciliationUpdated?: (data: unknown) => void
  height?: string
}

export default function Sam2LeaseModule({
  sam2Url = process.env.NEXT_PUBLIC_SAM2_URL || 'https://sam2-74901225976.us-central1.run.app',
  siteId,
  onDocumentParsed,
  onReconciliationUpdated,
  height = '800px',
}: Sam2ModuleProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [isReady, setIsReady] = useState(false)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    let expectedOrigin: string
    try {
      expectedOrigin = new URL(sam2Url).origin
    } catch {
      setLoadError('SAM 2.0 module URL is not configured (NEXT_PUBLIC_SAM2_URL).')
      return
    }

    const handleMessage = (event: MessageEvent) => {
      // Security check: only accept messages from the SAM 2.0 module's own origin.
      if (event.origin !== expectedOrigin) return

      const { type, payload } = event.data || {}

      if (type === 'SAM2_READY') {
        setIsReady(true)
        sendHandshake(expectedOrigin)
      } else if (type === 'SAM2_DOCUMENT_PARSED') {
        onDocumentParsed?.(payload)
      } else if (type === 'SAM2_RECONCILIATION_UPDATED') {
        onReconciliationUpdated?.(payload)
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sam2Url, siteId])

  async function sendHandshake(targetOrigin: string) {
    if (!iframeRef.current?.contentWindow) return

    const supabase = createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token || null

    iframeRef.current.contentWindow.postMessage(
      {
        type: 'SAM2_INIT',
        payload: {
          token,
          siteId,
          user: session?.user ? { id: session.user.id, email: session.user.email } : null,
        },
      },
      targetOrigin
    )
  }

  if (loadError) {
    return (
      <div style={{
        padding: '24px', borderRadius: '10px', background: '#fef2f2', border: '1px solid #fecaca',
        color: '#b91c1c', fontSize: '13px',
      }}>
        {loadError}
      </div>
    )
  }

  return (
    <div style={{
      width: '100%', height, border: '1px solid #e2e8f0', borderRadius: '10px',
      overflow: 'hidden', position: 'relative', boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
    }}>
      {!isReady && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: '10px',
          background: '#f8fafc', color: '#64748b', fontSize: '13px', fontWeight: 500,
        }}>
          <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />
          Connecting to SAM 2.0…
        </div>
      )}
      <iframe
        ref={iframeRef}
        src={sam2Url}
        style={{ width: '100%', height: '100%', border: 0 }}
        allow="clipboard-write"
        title="SAM 2.0 Lease Ingestion & Document Parse"
      />
    </div>
  )
}
