'use client'

import { useEffect } from 'react'

/**
 * Catches errors thrown in the root layout itself (app/error.tsx only
 * catches errors below the layout). Must render its own <html>/<body>.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    fetch('/api/log-error', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: error.message,
        stack: error.stack,
        digest: error.digest,
        url: typeof window !== 'undefined' ? window.location.href : '',
      }),
    }).catch(() => {})
  }, [error])

  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
        <div style={{
          minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%)',
        }}>
          <div style={{
            background: 'white', borderRadius: '16px', padding: '40px', textAlign: 'center',
            maxWidth: '380px', boxShadow: '0 24px 64px rgba(0,0,0,0.35)',
          }}>
            <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a', margin: '0 0 8px' }}>
              Application error
            </h1>
            <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 20px', lineHeight: 1.5 }}>
              We've been notified and are looking into it.
            </p>
            <button
              onClick={() => reset()}
              style={{
                padding: '10px 20px', borderRadius: '8px', background: '#2563eb',
                color: 'white', border: 'none', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
              }}
            >
              Reload
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}
