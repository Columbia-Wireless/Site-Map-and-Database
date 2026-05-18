'use client'

import { useState, useEffect } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'
import { ShieldCheck, Loader2, AlertCircle } from 'lucide-react'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://vfntpdpneusqgcwxwkix.supabase.co'
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZmbnRwZHBuZXVzcWdjd3h3a2l4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5NTg2MzEsImV4cCI6MjA5MzUzNDYzMX0.kFZ6b2WKAl7GVsEQZeO33qcxhyBruQlTfW0eZfkcg1c'

export default function MFAChallengePage() {
  const [code, setCode]       = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const router = useRouter()
  const supabase = createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY)

  // Auto-submit when 6 digits are entered
  useEffect(() => {
    if (code.length === 6) verify()
  }, [code])

  async function verify() {
    if (code.length !== 6 || loading) return
    setLoading(true)
    setError('')

    try {
      const { data: factors } = await supabase.auth.mfa.listFactors()
      const totpFactor = factors?.totp?.[0]
      if (!totpFactor) { router.replace('/dashboard'); return }

      const { data: challenge, error: cErr } = await supabase.auth.mfa.challenge({ factorId: totpFactor.id })
      if (cErr) throw cErr

      const { error: vErr } = await supabase.auth.mfa.verify({
        factorId:    totpFactor.id,
        challengeId: challenge.id,
        code,
      })
      if (vErr) throw vErr

      fetch('/api/audit/mfa-event', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ event: 'mfa_challenge_success' }) })
      router.replace('/dashboard')
    } catch (err: any) {
      setError(err.message ?? 'Invalid code. Please try again.')
      setCode('')
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%)',
    }}>
      <div style={{
        background: 'white', borderRadius: '16px', padding: '40px',
        width: '100%', maxWidth: '380px', boxShadow: '0 24px 64px rgba(0,0,0,0.35)',
        textAlign: 'center',
      }}>
        <div style={{
          width: '52px', height: '52px', borderRadius: '14px', background: '#eff6ff',
          display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px',
        }}>
          <ShieldCheck size={26} color="#2563eb" />
        </div>

        <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a', margin: '0 0 6px' }}>
          Two-factor verification
        </h1>
        <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 28px', lineHeight: 1.5 }}>
          Enter the 6-digit code from your authenticator app
        </p>

        {error && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            background: '#fef2f2', border: '1px solid #fecaca',
            borderRadius: '8px', padding: '10px 14px', marginBottom: '20px',
            fontSize: '13px', color: '#b91c1c', textAlign: 'left',
          }}>
            <AlertCircle size={14} />
            {error}
          </div>
        )}

        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={6}
          autoFocus
          value={code}
          onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          placeholder="000000"
          style={{
            width: '100%', padding: '14px', borderRadius: '10px',
            border: '2px solid #e2e8f0', fontSize: '28px', fontWeight: 700,
            textAlign: 'center', letterSpacing: '0.35em', outline: 'none',
            color: '#0f172a', boxSizing: 'border-box',
            transition: 'border-color 0.15s',
          }}
          onFocus={e => e.target.style.borderColor = '#2563eb'}
          onBlur={e => e.target.style.borderColor = '#e2e8f0'}
        />

        <button
          onClick={verify}
          disabled={code.length !== 6 || loading}
          style={{
            width: '100%', marginTop: '16px', padding: '12px',
            borderRadius: '8px', border: 'none',
            background: code.length === 6 && !loading ? '#2563eb' : '#cbd5e1',
            color: 'white', fontSize: '14px', fontWeight: 600,
            cursor: code.length === 6 && !loading ? 'pointer' : 'not-allowed',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            transition: 'background 0.15s',
          }}
        >
          {loading && <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} />}
          {loading ? 'Verifying…' : 'Verify'}
        </button>

        <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '20px' }}>
          Open your authenticator app and enter the current code
        </p>
      </div>
    </div>
  )
}
