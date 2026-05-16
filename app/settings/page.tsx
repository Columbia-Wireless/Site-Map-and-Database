'use client'

import { useState, useEffect } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { ShieldCheck, ShieldOff, Loader2, AlertCircle, CheckCircle2, Copy } from 'lucide-react'
import Image from 'next/image'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://vfntpdpneusqgcwxwkix.supabase.co'
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZmbnRwZHBuZXVzcWdjd3h3a2l4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5NTg2MzEsImV4cCI6MjA5MzUzNDYzMX0.kFZ6b2WKAl7GVsEQZeO33qcxhyBruQlTfW0eZfkcg1c'

type Step = 'idle' | 'enrolling' | 'confirming' | 'done'

export default function SettingsPage() {
  const supabase = createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY)

  const [userEmail, setUserEmail]   = useState('')
  const [enrolled, setEnrolled]     = useState(false)
  const [factorId, setFactorId]     = useState('')
  const [step, setStep]             = useState<Step>('idle')
  const [qrCode, setQrCode]         = useState('')
  const [secret, setSecret]         = useState('')
  const [enrollId, setEnrollId]     = useState('')
  const [code, setCode]             = useState('')
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState('')
  const [success, setSuccess]       = useState('')
  const [copied, setCopied]         = useState(false)

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) setUserEmail(user.email ?? '')

      const { data: factors } = await supabase.auth.mfa.listFactors()
      const totp = factors?.totp?.[0]
      if (totp) { setEnrolled(true); setFactorId(totp.id) }
    }
    init()
  }, [])

  async function startEnroll() {
    setLoading(true)
    setError('')
    const { data, error: err } = await supabase.auth.mfa.enroll({ factorType: 'totp', issuer: 'SCETV Site Management' })
    setLoading(false)
    if (err || !data) { setError(err?.message ?? 'Failed to start enrollment'); return }
    setQrCode(data.totp.qr_code)
    setSecret(data.totp.secret)
    setEnrollId(data.id)
    setStep('enrolling')
  }

  async function confirmEnroll() {
    if (code.length !== 6) return
    setLoading(true)
    setError('')
    const { data: challenge, error: cErr } = await supabase.auth.mfa.challenge({ factorId: enrollId })
    if (cErr) { setError(cErr.message); setLoading(false); return }

    const { error: vErr } = await supabase.auth.mfa.verify({
      factorId:    enrollId,
      challengeId: challenge.id,
      code,
    })
    setLoading(false)
    if (vErr) { setError('Invalid code — please try again'); setCode(''); return }

    setEnrolled(true)
    setFactorId(enrollId)
    setStep('done')
    setSuccess('Two-factor authentication is now active on your account.')
  }

  async function unenroll() {
    if (!confirm('Remove two-factor authentication from your account?')) return
    setLoading(true)
    setError('')
    const { error: err } = await supabase.auth.mfa.unenroll({ factorId })
    setLoading(false)
    if (err) { setError(err.message); return }
    setEnrolled(false)
    setFactorId('')
    setStep('idle')
    setSuccess('Two-factor authentication has been removed.')
  }

  function copySecret() {
    navigator.clipboard.writeText(secret)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div style={{ padding: '32px', maxWidth: '640px' }}>
      <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a', margin: '0 0 4px' }}>Account Settings</h1>
      <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 28px' }}>{userEmail}</p>

      {/* MFA Card */}
      <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '20px', borderBottom: '1px solid #f1f5f9' }}>
          <div style={{ background: enrolled ? '#dcfce7' : '#f1f5f9', borderRadius: '10px', padding: '10px' }}>
            {enrolled
              ? <ShieldCheck size={20} color="#16a34a" />
              : <ShieldOff size={20} color="#64748b" />
            }
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '15px', fontWeight: 600, color: '#0f172a' }}>Two-Factor Authentication</div>
            <div style={{ fontSize: '13px', color: enrolled ? '#16a34a' : '#94a3b8', marginTop: '2px' }}>
              {enrolled ? 'Active — your account is protected' : 'Not enabled'}
            </div>
          </div>
          {enrolled && (
            <span style={{ fontSize: '11px', fontWeight: 700, background: '#dcfce7', color: '#15803d', padding: '3px 10px', borderRadius: '20px' }}>
              ENABLED
            </span>
          )}
        </div>

        <div style={{ padding: '20px' }}>
          {error && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px', fontSize: '13px', color: '#b91c1c' }}>
              <AlertCircle size={14} /> {error}
            </div>
          )}
          {success && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px', fontSize: '13px', color: '#15803d' }}>
              <CheckCircle2 size={14} /> {success}
            </div>
          )}

          {/* Idle: not enrolled */}
          {!enrolled && step === 'idle' && (
            <div>
              <p style={{ fontSize: '13px', color: '#475569', lineHeight: 1.6, margin: '0 0 16px' }}>
                Add a second layer of security. After enabling, you'll enter a 6-digit code from an authenticator app (Google Authenticator, Microsoft Authenticator, or Authy) each time you sign in.
              </p>
              <button
                onClick={startEnroll}
                disabled={loading}
                style={{ display: 'flex', alignItems: 'center', gap: '7px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', padding: '10px 18px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
              >
                {loading ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <ShieldCheck size={14} />}
                {loading ? 'Setting up…' : 'Enable two-factor authentication'}
              </button>
            </div>
          )}

          {/* Enrolling: show QR code */}
          {step === 'enrolling' && (
            <div>
              <p style={{ fontSize: '13px', color: '#475569', margin: '0 0 20px', lineHeight: 1.6 }}>
                <strong>Step 1:</strong> Open your authenticator app and scan the QR code below. Then enter the 6-digit code it shows to confirm.
              </p>

              <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', alignItems: 'flex-start', marginBottom: '20px' }}>
                {qrCode && (
                  <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px', display: 'inline-block' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={qrCode} alt="MFA QR Code" width={160} height={160} style={{ display: 'block' }} />
                  </div>
                )}
                <div style={{ flex: 1, minWidth: '200px' }}>
                  <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 8px' }}>
                    Can't scan? Enter this key manually:
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '8px 12px' }}>
                    <code style={{ fontSize: '12px', color: '#0f172a', flex: 1, wordBreak: 'break-all', letterSpacing: '0.1em' }}>{secret}</code>
                    <button
                      onClick={copySecret}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: copied ? '#16a34a' : '#94a3b8', flexShrink: 0 }}
                      title="Copy key"
                    >
                      {copied ? <CheckCircle2 size={15} /> : <Copy size={15} />}
                    </button>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
                <div style={{ flex: 1, maxWidth: '200px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                    Verification code
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    autoFocus
                    value={code}
                    onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '20px', fontWeight: 700, letterSpacing: '0.3em', textAlign: 'center', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
                <button
                  onClick={confirmEnroll}
                  disabled={code.length !== 6 || loading}
                  style={{ padding: '10px 18px', background: code.length === 6 ? '#16a34a' : '#cbd5e1', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: code.length === 6 ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', gap: '7px', whiteSpace: 'nowrap' }}
                >
                  {loading ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <CheckCircle2 size={14} />}
                  {loading ? 'Verifying…' : 'Confirm'}
                </button>
              </div>
            </div>
          )}

          {/* Enrolled */}
          {enrolled && step !== 'enrolling' && (
            <div>
              <p style={{ fontSize: '13px', color: '#475569', lineHeight: 1.6, margin: '0 0 16px' }}>
                Your account requires a verification code from your authenticator app on every sign-in.
              </p>
              <button
                onClick={unenroll}
                disabled={loading}
                style={{ display: 'flex', alignItems: 'center', gap: '7px', background: 'white', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: '8px', padding: '9px 16px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
              >
                {loading ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <ShieldOff size={14} />}
                {loading ? 'Removing…' : 'Disable two-factor authentication'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
