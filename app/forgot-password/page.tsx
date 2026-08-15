'use client'

import { useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import Link from 'next/link'
import { Radio, Loader2, AlertCircle, CheckCircle2, ArrowLeft } from 'lucide-react'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://vfntpdpneusqgcwxwkix.supabase.co'
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZmbnRwZHBuZXVzcWdjd3h3a2l4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5NTg2MzEsImV4cCI6MjA5MzUzNDYzMX0.kFZ6b2WKAl7GVsEQZeO33qcxhyBruQlTfW0eZfkcg1c'

export default function ForgotPasswordPage() {
  const [email, setEmail]     = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const [sent, setSent]       = useState(false)

  const supabase = createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    })
    setLoading(false)
    // Always show the same success state regardless of whether the email
    // exists — avoids leaking which addresses have accounts.
    if (error && error.status && error.status >= 500) setError('Something went wrong. Please try again.')
    else setSent(true)
  }

  return (
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

        {sent ? (
          <div>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              background: '#f0fdf4', border: '1px solid #bbf7d0',
              borderRadius: '8px', padding: '12px 14px', marginBottom: '20px',
              fontSize: '13px', color: '#15803d', lineHeight: 1.5,
            }}>
              <CheckCircle2 size={14} style={{ flexShrink: 0 }} />
              If an account exists for <strong>{email}</strong>, a reset link is on its way. Check your inbox.
            </div>
            <Link href="/login" style={{
              display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px',
              color: '#2563eb', textDecoration: 'none', fontWeight: 600,
            }}>
              <ArrowLeft size={14} /> Back to sign in
            </Link>
          </div>
        ) : (
          <>
            <div style={{ fontSize: '22px', fontWeight: 700, color: '#0f172a', marginBottom: '4px' }}>
              Reset your password
            </div>
            <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '28px' }}>
              Enter your email and we&apos;ll send you a link to reset it.
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
                  Email address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  placeholder="you@example.com"
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
                {loading ? 'Sending…' : 'Send reset link'}
              </button>
            </form>

            <Link href="/login" style={{
              display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px',
              color: '#64748b', textDecoration: 'none', marginTop: '20px', justifyContent: 'center',
            }}>
              <ArrowLeft size={14} /> Back to sign in
            </Link>
          </>
        )}
      </div>
    </div>
  )
}
