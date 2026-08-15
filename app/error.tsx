'use client'

import { useEffect } from 'react'
import { AlertTriangle } from 'lucide-react'

export default function ErrorBoundary({
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
        url: window.location.href,
      }),
    }).catch(() => {})
  }, [error])

  return (
    <div style={{
      minHeight: '60vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', padding: '40px', textAlign: 'center',
    }}>
      <div style={{
        width: '52px', height: '52px', borderRadius: '14px', background: '#fef2f2',
        display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px',
      }}>
        <AlertTriangle size={26} color="#dc2626" />
      </div>
      <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a', margin: '0 0 8px' }}>
        Something went wrong
      </h2>
      <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 20px', maxWidth: '420px', lineHeight: 1.5 }}>
        The error has been reported to the team. Try again, or contact your administrator if the problem persists.
      </p>
      <button
        onClick={() => reset()}
        style={{
          padding: '10px 20px', borderRadius: '8px', background: '#2563eb',
          color: 'white', border: 'none', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
        }}
      >
        Try again
      </button>
    </div>
  )
}
