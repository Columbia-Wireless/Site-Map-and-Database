'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import 'leaflet/dist/leaflet.css'

const STATUS_COLORS: Record<string, string> = {
  active: '#16a34a',
  expiring_soon: '#d97706',
  expired: '#dc2626',
  disputed: '#be185d',
  pending: '#64748b',
}

const STATUS_LABELS: Record<string, string> = {
  active: 'Active', expiring_soon: 'Expiring Soon', expired: 'Expired',
  disputed: 'Disputed', pending: 'Pending',
}

interface SitePinData {
  id: string; site_code: string; name: string; city: string; state: string
  lat: number; lng: number; tenant_name: string; annual_rent: number
  status: string; tower_type: string
}

const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)

export default function TowerMap({ sites }: { sites: SitePinData[] }) {
  const mapRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const [statusFilter, setStatusFilter] = useState('all')

  useEffect(() => {
    if (!mapRef.current) return

    const L = require('leaflet')

    // Fix default icon paths broken by webpack
    delete (L.Icon.Default.prototype as any)._getIconUrl
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    })

    const map = L.map(mapRef.current, {
      center: [38.9, -77.2],
      zoom: 8,
      zoomControl: true,
    })

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map)

    const filtered = statusFilter === 'all' ? sites : sites.filter(s => s.status === statusFilter)

    filtered.forEach(site => {
      const color = STATUS_COLORS[site.status] || '#64748b'

      const icon = L.divIcon({
        html: `<div style="
          width: 14px; height: 14px; border-radius: 50%;
          background: ${color}; border: 2px solid white;
          box-shadow: 0 1px 4px rgba(0,0,0,0.3);
        "></div>`,
        className: '',
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      })

      const marker = L.marker([site.lat, site.lng], { icon }).addTo(map)

      const popup = L.popup({ maxWidth: 260, closeButton: true }).setContent(`
        <div style="font-family: Arial, sans-serif; padding: 4px;">
          <div style="font-size: 11px; font-weight: 600; color: #2563eb; margin-bottom: 2px;">${site.site_code}</div>
          <div style="font-size: 14px; font-weight: 700; color: #0f172a; margin-bottom: 4px;">${site.name}</div>
          <div style="font-size: 12px; color: #64748b; margin-bottom: 8px;">${site.city}, ${site.state}</div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
            <span style="font-size: 12px; color: #64748b;">Tenant</span>
            <span style="font-size: 12px; font-weight: 500;">${site.tenant_name}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
            <span style="font-size: 12px; color: #64748b;">Annual Rent</span>
            <span style="font-size: 12px; font-weight: 700; color: #0f172a;">${fmt(Number(site.annual_rent))}</span>
          </div>
          <div style="margin-bottom: 10px;">
            <span style="
              display: inline-block; font-size: 11px; font-weight: 600;
              padding: 2px 8px; border-radius: 10px;
              background: ${color}20; color: ${color};
            ">${STATUS_LABELS[site.status] || site.status}</span>
          </div>
          <a href="/sites/${site.id}" style="
            display: block; text-align: center; background: #1a3a5c; color: white;
            padding: 6px 12px; border-radius: 6px; font-size: 12px; font-weight: 600;
            text-decoration: none;
          ">View Full Record →</a>
        </div>
      `)

      marker.bindPopup(popup)
    })

    return () => { map.remove() }
  }, [sites, statusFilter])

  return (
    <div style={{ position: 'relative', height: '100%' }}>
      {/* Legend */}
      <div style={{
        position: 'absolute', top: '16px', right: '16px', zIndex: 1000,
        background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px',
        padding: '12px 14px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        minWidth: '160px',
      }}>
        <div style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Filter by Status
        </div>
        {[['all', 'All Sites', '#1a3a5c'], ...Object.entries(STATUS_COLORS)].map(([val, label, color]) => (
          <div
            key={val}
            onClick={() => setStatusFilter(val)}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0',
              cursor: 'pointer', opacity: statusFilter === val ? 1 : 0.5,
            }}
          >
            <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: color, flexShrink: 0 }} />
            <span style={{ fontSize: '12px', color: '#334155', fontWeight: statusFilter === val ? 600 : 400 }}>
              {val === 'all' ? 'All Sites' : STATUS_LABELS[val]}
            </span>
          </div>
        ))}
      </div>

      <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
    </div>
  )
}
