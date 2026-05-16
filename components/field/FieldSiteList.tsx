'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'

interface Site {
  id: string
  site_code: string
  name: string
  address: string
  city: string
  state: string
  lat: number | null
  lng: number | null
  tower_type: string | null
  height_ft: number | null
  status: string | null
  tenant_slots: number | null
}

interface LastSurvey {
  completed_at: string
  surveyor_name: string
}

interface Props {
  sites: Site[]
  lastSurveyBySite: Record<string, LastSurvey>
  occupiedCountBySite: Record<string, number>
  userName: string
  isAdminPreview?: boolean
  userRole?: string | null
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function formatDistance(km: number): string {
  const miles = km * 0.621371
  if (miles < 0.1) return `${Math.round(km * 1000)}m`
  return `${miles.toFixed(1)} mi`
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function pill(bg: string, text: string): React.CSSProperties {
  return { padding: '2px 8px', borderRadius: '20px', background: bg, color: text, fontSize: '11px', fontWeight: 600, whiteSpace: 'nowrap' }
}

const STATUS_PILL: Record<string, { bg: string; text: string; label: string }> = {
  occupied:     { bg: '#dcfce7', text: '#166534', label: 'Occupied' },
  vacant:       { bg: '#fee2e2', text: '#991b1b', label: 'Vacant' },
  construction: { bg: '#fef3c7', text: '#92400e', label: 'Construction' },
  inactive:     { bg: '#f1f5f9', text: '#64748b', label: 'Inactive' },
}

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin', admin: 'Admin', editor: 'Editor', reporter: 'Reporter', viewer: 'Viewer',
}

export default function FieldSiteList({ sites, lastSurveyBySite, occupiedCountBySite, userName, isAdminPreview, userRole }: Props) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [userLat, setUserLat] = useState<number | null>(null)
  const [userLng, setUserLng] = useState<number | null>(null)
  const [gpsLoading, setGpsLoading] = useState(false)
  const [gpsError, setGpsError] = useState('')
  const [sortByDistance, setSortByDistance] = useState(false)

  const getLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setGpsError('Geolocation not supported on this device')
      return
    }
    setGpsLoading(true)
    setGpsError('')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLat(pos.coords.latitude)
        setUserLng(pos.coords.longitude)
        setSortByDistance(true)
        setGpsLoading(false)
      },
      (err) => {
        setGpsError('Location access denied')
        setGpsLoading(false)
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }, [])

  const filtered = sites.filter((s) => {
    const q = search.toLowerCase()
    return (
      !q ||
      s.name.toLowerCase().includes(q) ||
      s.site_code.toLowerCase().includes(q) ||
      s.city.toLowerCase().includes(q) ||
      (s.address && s.address.toLowerCase().includes(q))
    )
  })

  const sorted = [...filtered].sort((a, b) => {
    if (sortByDistance && userLat !== null && userLng !== null) {
      const dA = a.lat && a.lng ? haversineKm(userLat, userLng, a.lat, a.lng) : 9999
      const dB = b.lat && b.lng ? haversineKm(userLat, userLng, b.lat, b.lng) : 9999
      return dA - dB
    }
    return a.name.localeCompare(b.name)
  })

  const S: Record<string, React.CSSProperties> = {
    root: {
      minHeight: '100vh',
      background: '#f8fafc',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    },
    header: {
      position: 'sticky',
      top: 0,
      zIndex: 50,
      background: '#1e3a5f',
      color: '#fff',
      padding: '16px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
    },
    headerTop: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: '12px',
    },
    title: { fontSize: '18px', fontWeight: 700, margin: 0 },
    userTag: { fontSize: '13px', opacity: 0.8 },
    searchRow: { display: 'flex', gap: '8px' },
    searchInput: {
      flex: 1,
      padding: '10px 14px',
      borderRadius: '10px',
      border: 'none',
      fontSize: '16px',
      background: 'rgba(255,255,255,0.15)',
      color: '#fff',
      outline: 'none',
    },
    gpsBtn: {
      padding: '10px 14px',
      borderRadius: '10px',
      border: 'none',
      background: gpsLoading ? '#94a3b8' : (sortByDistance ? '#22c55e' : 'rgba(255,255,255,0.2)'),
      color: '#fff',
      fontSize: '20px',
      cursor: gpsLoading ? 'default' : 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: '48px',
    },
    list: { padding: '12px 12px 80px' },
    card: {
      background: '#fff',
      borderRadius: '14px',
      padding: '16px',
      marginBottom: '10px',
      boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
      cursor: 'pointer',
      border: '1px solid #e2e8f0',
      display: 'flex',
      alignItems: 'center',
      gap: '14px',
      WebkitTapHighlightColor: 'transparent',
    },
    cardIcon: {
      width: '44px',
      height: '44px',
      borderRadius: '12px',
      background: '#f0f4ff',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '22px',
      flexShrink: 0,
    },
    cardBody: { flex: 1, minWidth: 0 },
    cardName: { fontSize: '15px', fontWeight: 600, color: '#1e293b', marginBottom: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
    cardSub: { fontSize: '13px', color: '#64748b', marginBottom: '6px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
    cardMeta: { display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' as const },
    cardRight: { textAlign: 'right' as const, flexShrink: 0 },
    distText: { fontSize: '13px', fontWeight: 600, color: '#3b82f6' },
    surveyText: { fontSize: '11px', color: '#94a3b8', marginTop: '2px' },
    chevron: { fontSize: '18px', color: '#cbd5e1', marginLeft: '4px' },
    empty: { textAlign: 'center' as const, padding: '48px 16px', color: '#94a3b8' },
    backBtn: {
      position: 'fixed' as const,
      bottom: '24px',
      right: '20px',
      background: '#1e3a5f',
      color: '#fff',
      border: 'none',
      borderRadius: '50px',
      padding: '14px 22px',
      fontSize: '14px',
      fontWeight: 600,
      boxShadow: '0 4px 16px rgba(30,58,95,0.35)',
      cursor: 'pointer',
    },
  }

  return (
    <div style={S.root}>
      {/* Admin preview banner */}
      {isAdminPreview && (
        <div style={{
          background: '#1e293b', color: '#e2e8f0', fontSize: '12px',
          padding: '8px 16px', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', gap: '10px',
        }}>
          <span>
            👁 Previewing field worker view as{' '}
            <strong style={{ color: '#f8fafc' }}>{ROLE_LABELS[userRole ?? ''] ?? userRole}</strong>
            {' '}· Field workers see no financial or admin data
          </span>
          <button
            onClick={() => router.push('/dashboard')}
            style={{
              background: '#3b82f6', border: 'none', color: 'white',
              borderRadius: '6px', padding: '4px 10px', fontSize: '11px',
              fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
            }}
          >
            ← Admin
          </button>
        </div>
      )}
      <div style={S.header}>
        <div style={S.headerTop}>
          <p style={S.title}>📡 Field Surveys</p>
          <span style={S.userTag}>{userName.split('@')[0]}</span>
        </div>
        <div style={S.searchRow}>
          <input
            style={S.searchInput}
            placeholder="Search sites..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button style={S.gpsBtn} onClick={getLocation} title="Sort by distance">
            {gpsLoading ? '⏳' : '📍'}
          </button>
        </div>
        {gpsError && (
          <p style={{ color: '#fca5a5', fontSize: '13px', marginTop: '8px' }}>{gpsError}</p>
        )}
        {sortByDistance && userLat && (
          <p style={{ color: '#86efac', fontSize: '13px', marginTop: '8px' }}>
            ✓ Sorted by distance from your location
          </p>
        )}
      </div>

      <div style={S.list}>
        <p style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '8px', paddingLeft: '4px' }}>
          {sorted.length} of {sites.length} sites
        </p>
        {sorted.length === 0 && (
          <div style={S.empty}>
            <div style={{ fontSize: '36px', marginBottom: '12px' }}>🔍</div>
            <p>No sites match your search</p>
          </div>
        )}
        {sorted.map((site) => {
          const dist =
            sortByDistance && userLat !== null && userLng !== null && site.lat && site.lng
              ? haversineKm(userLat, userLng, site.lat, site.lng)
              : null
          const last = lastSurveyBySite[site.id]
          const st = STATUS_PILL[site.status ?? 'vacant'] ?? STATUS_PILL.vacant
          return (
            <div
              key={site.id}
              style={S.card}
              onClick={() => router.push(`/field/${site.id}`)}
            >
              <div style={S.cardIcon}>🗼</div>
              <div style={S.cardBody}>
                <div style={S.cardName}>{site.name}</div>
                <div style={S.cardSub}>{site.city}, {site.state} · {site.site_code}</div>
                <div style={S.cardMeta}>
                  <span style={pill(st.bg, st.text)}>{st.label}</span>
                  {site.tower_type && (
                    <span style={pill('#f1f5f9', '#475569')}>{site.tower_type}</span>
                  )}
                  {site.height_ft && (
                    <span style={pill('#f1f5f9', '#475569')}>{site.height_ft}ft</span>
                  )}
                  {(() => {
                    const occ = occupiedCountBySite[site.id] ?? 0
                    const slots = site.tenant_slots
                    if (!occ && !slots) return null
                    const label = slots ? `${occ}/${slots}` : `${occ} tenant${occ !== 1 ? 's' : ''}`
                    const full = slots && occ >= slots
                    return (
                      <span style={pill(full ? '#dcfce7' : occ > 0 ? '#dbeafe' : '#f1f5f9', full ? '#166534' : occ > 0 ? '#1d4ed8' : '#64748b')}>
                        {label}
                      </span>
                    )
                  })()}
                </div>
              </div>
              <div style={S.cardRight}>
                {dist !== null && (
                  <div style={S.distText}>{formatDistance(dist)}</div>
                )}
                {last ? (
                  <div style={S.surveyText}>Surveyed {formatDate(last.completed_at)}</div>
                ) : (
                  <div style={S.surveyText}>No survey</div>
                )}
              </div>
              <span style={S.chevron}>›</span>
            </div>
          )
        })}
      </div>

      <button style={S.backBtn} onClick={() => router.push('/dashboard')}>
        ← Dashboard
      </button>
    </div>
  )
}
