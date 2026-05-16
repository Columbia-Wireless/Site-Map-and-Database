'use client'

import { useEffect, useRef, useState } from 'react'
import 'leaflet/dist/leaflet.css'
import { SitePinData } from './MapClient'

// ─── Color scheme ─────────────────────────────────────────────────────────────
const OCCUPANCY_COLORS: Record<string, string> = {
  vacant:       '#dc2626',   // red    — no tenants, available
  occupied:     '#16a34a',   // green  — has active tenants
  construction: '#d97706',   // amber  — under construction / renovation
  inactive:     '#94a3b8',   // gray   — offline / decommissioned
}

const OCCUPANCY_LABELS: Record<string, string> = {
  vacant:       'Fully Available',
  occupied:     'Occupied',
  construction: 'Under Construction',
  inactive:     'Discontinued / Offline',
}

const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)

const STATUS_LABELS: Record<string, string> = {
  operational:        'Operational',
  under_construction: 'Under Construction',
  offline:            'Offline',
  decommissioned:     'Decommissioned',
}

// ─── Expiry ring helper ────────────────────────────────────────────────────────
function expiryRingColor(daysToExpiry: number | null): string | null {
  if (daysToExpiry === null) return null
  if (daysToExpiry <= 30)  return '#dc2626'   // red  — critical
  if (daysToExpiry <= 90)  return '#d97706'   // amber — warning
  return null
}

// CSS animation injected once into the document
const PULSE_CSS = `
@keyframes map-pulse {
  0%   { transform: scale(1);   opacity: 0.8; }
  50%  { transform: scale(1.9); opacity: 0.2; }
  100% { transform: scale(2.6); opacity: 0;   }
}
.map-pulse-ring {
  position: absolute;
  border-radius: 50%;
  animation: map-pulse 1.8s ease-out infinite;
  pointer-events: none;
}
`

export default function TowerMap({ sites, focusLat, focusLng, focusSiteCode, licenseeName }: {
  sites: SitePinData[]
  focusLat?: number
  focusLng?: number
  focusSiteCode?: string
  licenseeName?: string
}) {
  const mapRef = useRef<HTMLDivElement>(null)
  const [occupancyFilter, setOccupancyFilter] = useState('all')

  // Inject pulse CSS once
  useEffect(() => {
    if (typeof document === 'undefined') return
    if (document.getElementById('map-pulse-style')) return
    const style = document.createElement('style')
    style.id = 'map-pulse-style'
    style.textContent = PULSE_CSS
    document.head.appendChild(style)
  }, [])

  useEffect(() => {
    if (!mapRef.current) return

    const L = require('leaflet')

    delete (L.Icon.Default.prototype as any)._getIconUrl
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    })

    const defaultCenter: [number, number] = [34.0007, -81.0341]
    const defaultZoom = 8
    const map = L.map(mapRef.current, {
      center: focusLat != null && focusLng != null ? [focusLat, focusLng] : defaultCenter,
      zoom:   focusLat != null ? 14 : defaultZoom,
      zoomControl: true,
    })

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map)

    // Apply licensee + occupancy filters
    const licFiltered = licenseeName
      ? sites.filter(s => s.tenant_name.includes(licenseeName))
      : sites

    const filtered = occupancyFilter === 'all'
      ? licFiltered
      : occupancyFilter === 'expiring'
        ? licFiltered.filter(s => s.days_to_expiry !== null && s.days_to_expiry <= 90)
        : licFiltered.filter(s => s.occupancy === occupancyFilter)

    // Zoom to fit licensee sites
    if (licenseeName) {
      const withCoords = filtered.filter(s => s.lat != null && s.lng != null)
      if (withCoords.length > 1) {
        const bounds = L.latLngBounds(withCoords.map((s: SitePinData) => [s.lat, s.lng]))
        map.fitBounds(bounds, { padding: [60, 60] })
      }
    }

    let focusedMarker: any = null

    filtered.filter(s => s.lat != null && s.lng != null).forEach(site => {
      const isFocused = focusSiteCode
        ? site.site_code === focusSiteCode
        : (licenseeName ? true : false)

      const dotColor  = OCCUPANCY_COLORS[site.occupancy] || '#64748b'
      const ringColor = expiryRingColor(site.days_to_expiry)
      const dotSize   = isFocused ? 20 : 14
      // Container is larger than the dot — gives Leaflet a bigger hit area
      const container = isFocused ? 44 : 36
      const half      = container / 2
      const dotOffset = (container - dotSize) / 2
      const ringSize  = dotSize + 14
      const ringOffset = (container - ringSize) / 2

      // Build ring HTML if needed — centered in container, pointer-events: none via CSS
      const ringHtml = ringColor ? `
        <div class="map-pulse-ring" style="
          width: ${ringSize}px; height: ${ringSize}px;
          background: ${ringColor};
          top: ${ringOffset}px; left: ${ringOffset}px;
        "></div>
        <div class="map-pulse-ring" style="
          width: ${ringSize}px; height: ${ringSize}px;
          background: ${ringColor};
          top: ${ringOffset}px; left: ${ringOffset}px;
          animation-delay: 0.6s;
        "></div>
      ` : ''

      const icon = L.divIcon({
        html: `
          <div style="position: relative; width: ${container}px; height: ${container}px;">
            ${ringHtml}
            <div style="
              position: absolute;
              top: ${dotOffset}px; left: ${dotOffset}px;
              z-index: 1;
              width: ${dotSize}px; height: ${dotSize}px; border-radius: 50%;
              background: ${dotColor};
              border: ${isFocused ? '3px' : '2px'} solid white;
              box-shadow: 0 2px 6px rgba(0,0,0,0.35);
              ${isFocused ? 'outline: 2px solid ' + dotColor + ';' : ''}
            "></div>
          </div>
        `,
        className: '',
        iconSize:   [container, container],
        iconAnchor: [half, half],
      })

      const statusLabel = STATUS_LABELS[site.status] || site.status
      const expiryNote = site.days_to_expiry !== null && site.days_to_expiry <= 90
        ? `<div style="
            margin-bottom: 8px; padding: 5px 10px; border-radius: 6px;
            background: ${site.days_to_expiry <= 30 ? '#fee2e2' : '#fffbeb'};
            color: ${site.days_to_expiry <= 30 ? '#b91c1c' : '#92400e'};
            font-size: 11px; font-weight: 600;
          ">
            ⚠ Lease expiring in ${site.days_to_expiry} day${site.days_to_expiry !== 1 ? 's' : ''}
          </div>`
        : ''

      const marker = L.marker([site.lat, site.lng], { icon }).addTo(map)

      const popup = L.popup({ maxWidth: 270, closeButton: true }).setContent(`
        <div style="font-family: Arial, sans-serif; padding: 4px;">
          <div style="font-size: 11px; font-weight: 600; color: #2563eb; margin-bottom: 2px;">${site.site_code}</div>
          <div style="font-size: 14px; font-weight: 700; color: #0f172a; margin-bottom: 4px;">${site.name}</div>
          <div style="font-size: 12px; color: #64748b; margin-bottom: 8px;">${site.city}, ${site.state}</div>
          ${expiryNote}
          <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
            <span style="font-size: 12px; color: #64748b;">Tenants</span>
            <span style="font-size: 12px; font-weight: 500;">${site.active_tenancies > 0 ? site.tenant_name : 'Vacant'}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
            <span style="font-size: 12px; color: #64748b;">Annual Revenue</span>
            <span style="font-size: 12px; font-weight: 700; color: #0f172a;">${site.annual_rent > 0 ? fmt(site.annual_rent) : '—'}</span>
          </div>
          <div style="margin-bottom: 10px;">
            <span style="
              display: inline-block; font-size: 11px; font-weight: 600;
              padding: 2px 8px; border-radius: 10px;
              background: ${dotColor}20; color: ${dotColor};
            ">${statusLabel}</span>
          </div>
          <a href="/sites/${site.id}" style="
            display: block; text-align: center; background: #1a3a5c; color: white;
            padding: 6px 12px; border-radius: 6px; font-size: 12px; font-weight: 600;
            text-decoration: none;
          ">View Full Record →</a>
        </div>
      `)

      marker.bindPopup(popup)

      if (focusSiteCode && site.site_code === focusSiteCode) {
        focusedMarker = marker
      }
    })

    if (focusedMarker) focusedMarker.openPopup()

    return () => { map.remove() }
  }, [sites, occupancyFilter, focusLat, focusLng, focusSiteCode, licenseeName])

  // ─── Compute legend counts ─────────────────────────────────────────────────
  const base = licenseeName ? sites.filter(s => s.tenant_name.includes(licenseeName)) : sites
  const counts = {
    all:          base.length,
    vacant:       base.filter(s => s.occupancy === 'vacant').length,
    occupied:     base.filter(s => s.occupancy === 'occupied').length,
    construction: base.filter(s => s.occupancy === 'construction').length,
    inactive:     base.filter(s => s.occupancy === 'inactive').length,
    expiring:     base.filter(s => s.days_to_expiry !== null && s.days_to_expiry <= 90).length,
  }
  const shownCount = occupancyFilter === 'all'
    ? counts.all
    : occupancyFilter === 'expiring'
      ? counts.expiring
      : counts[occupancyFilter as keyof typeof counts] ?? 0

  return (
    <div style={{ position: 'relative', height: '100%' }}>
      {/* Legend / filter */}
      <div style={{
        position: 'absolute', top: '16px', right: '16px', zIndex: 1000,
        background: 'white', border: '1px solid #e2e8f0', borderRadius: '10px',
        padding: '14px 16px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
        minWidth: '210px',
      }}>
        <div style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Filter by Availability
        </div>

        {/* Occupancy filters */}
        {([
          ['all',          'All Sites',              '#1a3a5c',   null],
          ['vacant',       'Fully Available',         OCCUPANCY_COLORS.vacant,       null],
          ['occupied',     'Occupied',                OCCUPANCY_COLORS.occupied,     null],
          ['construction', 'Under Construction',      OCCUPANCY_COLORS.construction, null],
          ['inactive',     'Discontinued / Offline',  OCCUPANCY_COLORS.inactive,     null],
        ] as [string, string, string, null][]).map(([val, label, color]) => (
          <div
            key={val}
            onClick={() => setOccupancyFilter(val)}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              gap: '8px', padding: '4px 0', cursor: 'pointer',
              opacity: occupancyFilter === val ? 1 : 0.55,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: color, flexShrink: 0 }} />
              <span style={{ fontSize: '12px', color: '#334155', fontWeight: occupancyFilter === val ? 600 : 400 }}>
                {label}
              </span>
            </div>
            <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 500 }}>
              {val === 'all' ? counts.all : counts[val as keyof typeof counts] ?? 0}
            </span>
          </div>
        ))}

        {/* Divider */}
        <div style={{ borderTop: '1px solid #f1f5f9', margin: '8px 0' }} />

        {/* Expiry filter */}
        <div
          onClick={() => setOccupancyFilter(occupancyFilter === 'expiring' ? 'all' : 'expiring')}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            gap: '8px', padding: '4px 0', cursor: 'pointer',
            opacity: counts.expiring === 0 ? 0.3 : (occupancyFilter === 'expiring' ? 1 : 0.65),
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* Pulsing dot indicator */}
            <div style={{ position: 'relative', width: '10px', height: '10px', flexShrink: 0 }}>
              <div style={{
                position: 'absolute', width: '10px', height: '10px', borderRadius: '50%',
                background: '#d97706', border: '2px solid white',
                boxShadow: '0 0 0 2px #d97706',
              }} />
            </div>
            <span style={{ fontSize: '12px', color: '#334155', fontWeight: occupancyFilter === 'expiring' ? 600 : 400 }}>
              Expiring ≤ 90 days
            </span>
          </div>
          <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 500 }}>{counts.expiring}</span>
        </div>

        {/* Site count footer */}
        <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #f1f5f9', fontSize: '11px', color: '#94a3b8' }}>
          {licenseeName
            ? `${shownCount} sites for ${licenseeName}`
            : occupancyFilter === 'all'
              ? `${counts.all} sites total`
              : `${shownCount} of ${counts.all} sites`
          }
        </div>

        {/* Ring legend */}
        {counts.expiring > 0 && (
          <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #f1f5f9' }}>
            <div style={{ fontSize: '10px', fontWeight: 600, color: '#94a3b8', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Expiry rings</div>
            {[
              { color: '#d97706', label: '31–90 days' },
              { color: '#dc2626', label: '≤ 30 days' },
            ].map(({ color, label }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '3px' }}>
                <div style={{ width: '12px', height: '12px', borderRadius: '50%', border: `2px solid ${color}`, flexShrink: 0 }} />
                <span style={{ fontSize: '11px', color: '#64748b' }}>{label}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
    </div>
  )
}
