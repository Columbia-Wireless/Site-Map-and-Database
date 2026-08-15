'use client'

import { useState, useEffect } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Radio, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://vfntpdpneusqgcwxwkix.supabase.co'
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZmbnRwZHBuZXVzcWdjd3h3a2l4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5NTg2MzEsImV4cCI6MjA5MzUzNDYzMX0.kFZ6b2WKAl7GVsEQZeO33qcxhyBruQlTfW0eZfkcg1c'

export default function ResetPasswordPage() {
  const [password, setPassword]           = useState('')
  const [confirm, setConfirm]             = useState('')
  const [loading, setLoading]             = useState(false)
  const [error, setError]                 = useState('')
  const [success, setSuccess]             = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)
  const [hasSession, setHasSession]       = useState(false)
  const router = useRouter()

  const supabase = createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setHasSession(!!session)
      setCheckingSession(false)
    })
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return }
    if (password !== confirm) { setError('Passwords do not match.'); return }

    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (error) { setError(error.message); return }
    setSuccess(true)
    setTimeout(() => router.push('/dashboard'), 1500)
  }

  const Shell = ({ children }: { children: React.ReactNode }) => (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%)',
    }}>
      <div style={{
        background: 'white', borderRadius: '16px', padding: '40px',
        width: '100%', maxWidth: '400px', boxShadow: '0 24px 64px rgba(0,0,0,0.35)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '32px' }}>
          <div style={{
            background: '#2563eb', borderRadius: '10px',
            width: '42px', height: '42px',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <Radio size={22} color="white" />
          </div>
          <div>
            <div style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a', lineHeight: 1.2 }}>
              Columbia Wireless Site Asset Management
            </div>
            <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>
              powered by VeriPura
            </div>
          </div>
        </div>
        {children}
      </div>
    </div>
  )

  if (checkingSession) {
    return (
      <Shell>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '20px 0' }}>
          <Loader2 size={20} style={{ animation: 'spin 1s linear infinite', color: '#94a3b8' }} />
        </div>
      </Shell>
    )
  }

  if (!hasSession) {
    return (
      <Shell>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          background: '#fef2f2', border: '1px solid #fecaca',
          borderRadius: '8px', padding: '12px 14px', marginBottom: '20px',
          fontSize: '13px', color: '#b91c1c', lineHeight: 1.5,
        }}>
          <AlertCircle size={14} style={{ flexShrink: 0 }} />
          This reset link is invalid or has expired.
        </div>
        <Link href="/forgot-password" style={{
          display: 'block', textAlign: 'center', padding: '11px', borderRadius: '8px',
          background: '#2563eb', color: 'white', fontSize: '14px', fontWeight: 600, textDecoration: 'none',
        }}>
          Request a new link
        </Link>
      </Shell>
    )
  }

  if (success) {
    return (
      <Shell>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          background: '#f0fdf4', border: '1px solid #bbf7d0',
          borderRadius: '8px', padding: '12px 14px',
          fontSize: '13px', color: '#15803d',
        }}>
          <CheckCircle2 size={14} />
          Password updated. Redirecting…
        </div>
      </Shell>
    )
  }

  return (
    <Shell>
      <div style={{ fontSize: '22px', fontWeight: 700, color: '#0f172a', marginBottom: '4px' }}>
        Set a new password
      </div>
      <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '28px' }}>
        Choose a strong password for your account.
      </div>

      {error && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          background: '#fef2f2', border: '1px solid #fecaca',
          borderRadius: '8px', padding: '10px 14px', marginBottom: '20px',
          fontSize: '13px', color: '#b91c1c',
        }}>
          <AlertCircle size={14} />
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
            New password
          </label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            placeholder="••••••••"
            style={{
              width: '100%', padding: '10px 12px', borderRadius: '8px',
              border: '1px solid #d1d5db', fontSize: '14px', outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
            Confirm password
          </label>
          <input
            type="password"
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            required
            placeholder="••••••••"
            style={{
              width: '100%', padding: '10px 12px', borderRadius: '8px',
              border: '1px solid #d1d5db', fontSize: '14px', outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%', padding: '11px', borderRadius: '8px',
            background: loading ? '#93c5fd' : '#2563eb',
            color: 'white', border: 'none',
            fontSize: '14px', fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            marginTop: '4px',
          }}
        >
          {loading && <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} />}
          {loading ? 'Updating…' : 'Update password'}
        </button>
      </form>
    </Shell>
  )
}
