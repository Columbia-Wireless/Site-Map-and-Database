'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, MapPin, Map, FileText, Building2, Radio } from 'lucide-react'

const nav = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/sites', label: 'Site Portfolio', icon: MapPin },
  { href: '/tenants', label: 'Tenants', icon: Building2 },
  { href: '/map', label: 'Map View', icon: Map },
  { href: '/reports', label: 'Reports', icon: FileText },
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="sidebar" style={{ display: 'flex', flexDirection: 'column' }}>
      {/* Logo */}
      <div style={{
        padding: '24px 20px 20px',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            background: '#2563eb',
            borderRadius: '8px',
            width: '34px',
            height: '34px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}>
            <Radio size={18} color="white" />
          </div>
          <div>
            <div style={{ color: 'white', fontWeight: 700, fontSize: '13px', lineHeight: 1.2 }}>
              Columbia Wireless
            </div>
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px' }}>
              Site Management
            </div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '16px 12px' }}>
        <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)', fontWeight: 600, letterSpacing: '0.08em', padding: '0 8px 8px', textTransform: 'uppercase' }}>
          Navigation
        </div>
        {nav.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link key={href} href={href} style={{ textDecoration: 'none' }}>
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
      </nav>

      {/* Footer */}
      <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px' }}>
          Trusted Telecom Site Management
        </div>
      </div>
    </aside>
  )
}
