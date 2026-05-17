'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Radio, Menu, X, ClipboardList } from 'lucide-react'
import Sidebar from './Sidebar'
import { MediaUploadProvider } from '@/contexts/MediaUploadContext'
import GlobalUploadToast from './GlobalUploadToast'

export default function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const isAuthPage = pathname === '/login' || pathname.startsWith('/auth')
  const isFieldPage = pathname.startsWith('/field')

  const [isMobile, setIsMobile] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // Close sidebar on navigation
  useEffect(() => { setSidebarOpen(false) }, [pathname])

  if (isAuthPage || isFieldPage) return <MediaUploadProvider>{children}<GlobalUploadToast /></MediaUploadProvider>

  // ── Mobile layout ──────────────────────────────────────────────────────────
  if (isMobile) {
    // Derive a short page title from pathname
    const pageTitle = (() => {
      if (pathname.startsWith('/sites')) return 'Sites'
      if (pathname.startsWith('/tenants')) return 'Licensees'
      if (pathname.startsWith('/owners')) return 'Host Agencies'
      if (pathname.startsWith('/map')) return 'Map'
      if (pathname.startsWith('/reports')) return 'Reports'
      if (pathname.startsWith('/admin')) return 'Admin'
      return 'Dashboard'
    })()

    return (
      <MediaUploadProvider>
      <GlobalUploadToast />
      <div style={{ minHeight: '100vh', background: '#f1f5f9' }}>
        {/* Mobile top bar */}
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, height: '56px', zIndex: 100,
          background: '#1a3a5c',
          display: 'flex', alignItems: 'center', padding: '0 14px', gap: '12px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
        }}>
          <button
            onClick={() => setSidebarOpen(true)}
            style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', padding: '6px', display: 'flex', alignItems: 'center' }}
          >
            <Menu size={22} />
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
            <div style={{ background: '#2563eb', borderRadius: '6px', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Radio size={14} color="white" />
            </div>
            <span style={{ color: 'white', fontWeight: 700, fontSize: '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {pageTitle}
            </span>
          </div>

          {/* Field Survey shortcut */}
          <button
            onClick={() => router.push('/field')}
            style={{
              display: 'flex', alignItems: 'center', gap: '5px',
              background: '#16a34a', border: 'none', borderRadius: '8px',
              color: 'white', fontSize: '12px', fontWeight: 700,
              padding: '6px 10px', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
            }}
          >
            <ClipboardList size={14} />
            Field
          </button>
        </div>

        {/* Overlay backdrop */}
        {sidebarOpen && (
          <div
            onClick={() => setSidebarOpen(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200 }}
          />
        )}

        {/* Slide-in sidebar */}
        <div style={{
          position: 'fixed', top: 0, left: 0, bottom: 0, width: '260px', zIndex: 300,
          transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.25s ease',
          display: 'flex', flexDirection: 'column',
        }}>
          <Sidebar onClose={() => setSidebarOpen(false)} />
        </div>

        {/* Page content — offset below top bar */}
        <main style={{ paddingTop: '56px', minHeight: '100vh', minWidth: 0 }}>
          {children}
        </main>
      </div>
      </MediaUploadProvider>
    )
  }

  // ── Desktop layout ─────────────────────────────────────────────────────────
  return (
    <MediaUploadProvider>
      <GlobalUploadToast />
      <div style={{ display: 'flex', minHeight: '100vh' }}>
        <Sidebar />
        <main style={{ flex: 1, overflow: 'auto', minWidth: 0 }}>
          {children}
        </main>
      </div>
    </MediaUploadProvider>
  )
}
