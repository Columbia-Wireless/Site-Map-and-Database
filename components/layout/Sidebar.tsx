'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutDashboard, MapPin, Map, FileText, Building2, Radio, Landmark, Settings, LogOut, Users, ClipboardList, X, ShieldCheck, TrendingUp } from 'lucide-react'
import { createBrowserClient } from '@supabase/ssr'
import { useEffect, useState } from 'react'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://vfntpdpneusqgcwxwkix.supabase.co'
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZmbnRwZHBuZXVzcWdjd3h3a2l4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5NTg2MzEsImV4cCI6MjA5MzUzNDYzMX0.kFZ6b2WKAl7GVsEQZeO33qcxhyBruQlTfW0eZfkcg1c'

const nav = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/sites', label: 'Site Portfolio', icon: MapPin },
  { href: '/tenants', label: 'Licensees', icon: Building2 },
  { href: '/owners', label: 'Host Agencies', icon: Landmark },
  { href: '/map', label: 'Map View', icon: Map },
  { href: '/reports', label: 'Reports', icon: FileText },
  { href: '/reports/impact', label: 'Impact Simulator', icon: TrendingUp },
  { href: '/field', label: 'Field Surveys', icon: ClipboardList },
]

const adminNav = [
  { href: '/admin', label: 'Data Management', icon: Settings },
  { href: '/admin/users', label: 'User Management', icon: Users, minRole: 'admin' as const },
  { href: '/settings', label: 'Account Settings', icon: ShieldCheck },
]

export default function Sidebar({ onClose }: { onClose?: () => void } = {}) {
  const pathname = usePathname()
  const router   = useRouter()
  const [userEmail, setUserEmail]   = useState<string | null>(null)
  const [userName, setUserName]     = useState<string | null>(null)
  const [avatarUrl, setAvatarUrl]   = useState<string | null>(null)
  const [userRole, setUserRole]     = useState<string | null>(null)
  const [signingOut, setSigningOut] = useState(false)

  const supabase = createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY)

  const ROLE_RANK: Record<string, number> = {
    super_admin: 5, admin: 4, editor: 3, reporter: 2, viewer: 1,
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUserEmail(user.email ?? null)
        setUserName(user.user_metadata?.full_name ?? user.user_metadata?.name ?? null)
        setAvatarUrl(user.user_metadata?.avatar_url ?? null)
        // Fetch role from profiles
        supabase.from('profiles').select('role').eq('id', user.id).single()
          .then(({ data }) => { if (data) setUserRole(data.role) })
      }
    })
  }, [])

  async function signOut() {
    setSigningOut(true)
    // Call server-side logout route so the event is audit-logged with IP
    await fetch('/api/auth/logout', { method: 'POST' })
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <aside className="sidebar" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto' }}>
      {/* Logo + optional close button */}
      <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ background: '#2563eb', borderRadius: '8px', width: '34px', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Radio size={18} color="white" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: 'white', fontWeight: 700, fontSize: '13px', lineHeight: 1.2 }}>
              SCETV Site Management
            </div>
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px' }}>by Columbia Wireless</div>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: 'rgba(255,255,255,0.7)', borderRadius: '6px', padding: '5px', cursor: 'pointer', display: 'flex', alignItems: 'center', flexShrink: 0 }}
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '16px 12px' }}>
        <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)', fontWeight: 600, letterSpacing: '0.08em', padding: '0 8px 8px', textTransform: 'uppercase' }}>
          Navigation
        </div>
        {nav.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          const isField = href === '/field'
          return (
            <Link key={href} href={href} style={{ textDecoration: 'none' }} onClick={onClose}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 10px',
                borderRadius: '6px',
                marginBottom: isField ? '0' : '2px',
                marginTop: isField ? '6px' : '0',
                background: active ? 'rgba(255,255,255,0.12)' : isField ? 'rgba(34,197,94,0.15)' : 'transparent',
                color: active ? 'white' : isField ? '#86efac' : 'rgba(255,255,255,0.6)',
                fontSize: '14px',
                fontWeight: active || isField ? 600 : 400,
                cursor: 'pointer',
                transition: 'all 0.15s',
                border: isField && !active ? '1px solid rgba(34,197,94,0.3)' : '1px solid transparent',
              }}>
                <Icon size={17} />
                {label}
                {isField && (
                  <span style={{ marginLeft: 'auto', fontSize: '10px', fontWeight: 700, background: '#16a34a', color: 'white', borderRadius: '4px', padding: '1px 6px' }}>
                    MOBILE
                  </span>
                )}
              </div>
            </Link>
          )
        })}
      </nav>

      {/* Admin nav */}
      <div style={{ padding: '0 12px 12px' }}>
        <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)', fontWeight: 600, letterSpacing: '0.08em', padding: '0 8px 8px', textTransform: 'uppercase' }}>
          Admin
        </div>
        {adminNav
          .filter(item => {
            if (!item.minRole) return true
            if (!userRole) return false
            return (ROLE_RANK[userRole] ?? 0) >= (ROLE_RANK[item.minRole] ?? 0)
          })
          .map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link key={href} href={href} style={{ textDecoration: 'none' }} onClick={onClose}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 10px',
                borderRadius: '6px',
                marginBottom: '2px',
                background: active ? 'rgba(255,255,255,0.12)' : 'transparent',
                color: active ? 'white' : 'rgba(255,255,255,0.6)',
                fontSize: '14px',
                fontWeight: active ? 600 : 400,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}>
                <Icon size={17} />
                {label}
              </div>
            </Link>
          )
        })}
      </div>

      {/* User + sign out */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
          {avatarUrl ? (
            <img src={avatarUrl} alt="" style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
          ) : (
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <span style={{ fontSize: '13px', fontWeight: 700, color: 'white' }}>
                {(userName || userEmail || '?')[0].toUpperCase()}
              </span>
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            {userName && (
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {userName}
              </div>
            )}
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.45)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {userEmail ?? '…'}
            </div>
          </div>
        </div>
        <button
          onClick={signOut}
          disabled={signingOut}
          style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px', padding: '7px', borderRadius: '6px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.6)', fontSize: '12px', fontWeight: 500, cursor: 'pointer' }}
        >
          <LogOut size={13} />
          {signingOut ? 'Signing out…' : 'Sign out'}
        </button>
        <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: '10px', textAlign: 'center', marginTop: '8px' }}>
          Powered by VeriPura
        </div>
      </div>
    </aside>
  )
}
