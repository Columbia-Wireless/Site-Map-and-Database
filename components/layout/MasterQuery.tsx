'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Search, MapPin, Building2, Landmark, Users, X, ArrowRight } from 'lucide-react'

interface SearchResults {
  sites:     { id: string; site_code: string; name: string; city: string; state: string; tower_type: string; status: string }[]
  licensees: { id: string; name: string; hq_city: string; hq_state: string; status: string }[]
  agencies:  { id: string; name: string; city: string; state: string; type: string; status: string }[]
  users:     { id: string; full_name: string | null; email: string; role: string | null }[]
}

const EMPTY: SearchResults = { sites: [], licensees: [], agencies: [], users: [] }

const TYPE_LABELS: Record<string, string> = {
  monopole: 'Monopole', lattice: 'Lattice', rooftop: 'Rooftop',
  water_tower: 'Water Tower', guyed: 'Guyed', small_cell: 'Small Cell',
}

export default function MasterQuery() {
  const [open, setOpen]           = useState(false)
  const [query, setQuery]         = useState('')
  const [results, setResults]     = useState<SearchResults>(EMPTY)
  const [loading, setLoading]     = useState(false)
  const [activeIdx, setActiveIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const router = useRouter()

  // Ctrl+K / Cmd+K global shortcut
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(o => !o)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Focus input when modal opens
  useEffect(() => {
    if (open) {
      setQuery('')
      setResults(EMPTY)
      setActiveIdx(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (query.length < 2) { setResults(EMPTY); setLoading(false); return }
    setLoading(true)
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`)
        const data = await res.json()
        setResults(data)
        setActiveIdx(0)
      } finally {
        setLoading(false)
      }
    }, 250)
  }, [query])

  // Flatten results for keyboard navigation
  const flat = [
    ...results.sites.map(r => ({ type: 'site', href: `/sites/${r.id}`, label: r.site_code, sub: `${r.name} · ${r.city}, ${r.state}`, tag: TYPE_LABELS[r.tower_type] ?? r.tower_type })),
    ...results.licensees.map(r => ({ type: 'licensee', href: `/tenants/${r.id}`, label: r.name, sub: r.hq_city && r.hq_state ? `${r.hq_city}, ${r.hq_state}` : 'Licensee', tag: r.status })),
    ...results.agencies.map(r => ({ type: 'agency', href: `/owners/${r.id}`, label: r.name, sub: r.city && r.state ? `${r.city}, ${r.state}` : 'Host Agency', tag: r.type })),
    ...results.users.map(r => ({ type: 'user', href: `/admin/users`, label: r.full_name || r.email, sub: r.email, tag: r.role ?? '' })),
  ]

  const navigate = useCallback((href: string) => {
    router.push(href)
    setOpen(false)
  }, [router])

  // Arrow key navigation
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!open || flat.length === 0) return
      if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, flat.length - 1)) }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)) }
      if (e.key === 'Enter' && flat[activeIdx]) { navigate(flat[activeIdx].href) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, flat, activeIdx, navigate])

  const hasResults = flat.length > 0

  function icon(type: string) {
    if (type === 'site')     return <MapPin size={14} color="#2563eb" />
    if (type === 'licensee') return <Building2 size={14} color="#7e22ce" />
    if (type === 'agency')   return <Landmark size={14} color="#15803d" />
    return <Users size={14} color="#b45309" />
  }

  function sectionLabel(type: string) {
    if (type === 'site')     return 'Sites'
    if (type === 'licensee') return 'Licensees'
    if (type === 'agency')   return 'Host Agencies'
    return 'Users'
  }

  // Group flat list by type for section headers
  const sections: { type: string; items: typeof flat }[] = []
  for (const item of flat) {
    const last = sections[sections.length - 1]
    if (!last || last.type !== item.type) sections.push({ type: item.type, items: [item] })
    else last.items.push(item)
  }

  let globalIdx = 0

  if (!open) return null

  return (
    <div
      onClick={() => setOpen(false)}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(3px)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        paddingTop: '12vh',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: '600px', margin: '0 16px',
          background: 'white', borderRadius: '14px',
          boxShadow: '0 24px 64px rgba(0,0,0,0.35)',
          overflow: 'hidden',
        }}
      >
        {/* Input */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 18px', borderBottom: '1px solid #f1f5f9' }}>
          <Search size={18} color="#94a3b8" style={{ flexShrink: 0 }} />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search sites, licensees, agencies, users…"
            style={{ flex: 1, border: 'none', outline: 'none', fontSize: '16px', color: '#0f172a', background: 'transparent' }}
          />
          {loading && (
            <div style={{ width: '16px', height: '16px', border: '2px solid #e2e8f0', borderTopColor: '#2563eb', borderRadius: '50%', animation: 'spin 0.7s linear infinite', flexShrink: 0 }} />
          )}
          <button onClick={() => setOpen(false)} style={{ background: 'none', border: '1px solid #e2e8f0', borderRadius: '5px', padding: '3px 7px', fontSize: '11px', color: '#94a3b8', cursor: 'pointer', flexShrink: 0 }}>
            ESC
          </button>
        </div>

        {/* Results */}
        {query.length >= 2 && (
          <div style={{ maxHeight: '440px', overflowY: 'auto' }}>
            {!hasResults && !loading && (
              <div style={{ padding: '32px', textAlign: 'center', color: '#94a3b8', fontSize: '14px' }}>
                No results for "{query}"
              </div>
            )}
            {sections.map(section => (
              <div key={section.type}>
                <div style={{ padding: '8px 18px 4px', fontSize: '10px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', background: '#fafafa', borderBottom: '1px solid #f1f5f9' }}>
                  {sectionLabel(section.type)}
                </div>
                {section.items.map(item => {
                  const idx = globalIdx++
                  const active = idx === activeIdx
                  return (
                    <div
                      key={item.href + item.label}
                      onClick={() => navigate(item.href)}
                      onMouseEnter={() => setActiveIdx(idx)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '12px',
                        padding: '10px 18px', cursor: 'pointer',
                        background: active ? '#eff6ff' : 'white',
                        borderBottom: '1px solid #f8fafc',
                        transition: 'background 0.1s',
                      }}
                    >
                      <div style={{ width: '28px', height: '28px', borderRadius: '7px', background: active ? 'white' : '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: active ? '0 1px 3px rgba(0,0,0,0.08)' : 'none' }}>
                        {icon(item.type)}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item.label}
                        </div>
                        <div style={{ fontSize: '12px', color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item.sub}
                        </div>
                      </div>
                      {item.tag && (
                        <span style={{ fontSize: '10px', fontWeight: 600, padding: '2px 7px', borderRadius: '8px', background: '#f1f5f9', color: '#64748b', whiteSpace: 'nowrap', flexShrink: 0 }}>
                          {item.tag}
                        </span>
                      )}
                      {active && <ArrowRight size={14} color="#2563eb" style={{ flexShrink: 0 }} />}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        )}

        {/* Footer hint */}
        <div style={{ display: 'flex', gap: '16px', padding: '8px 18px', background: '#fafafa', borderTop: '1px solid #f1f5f9', fontSize: '11px', color: '#94a3b8' }}>
          <span>↑↓ navigate</span>
          <span>↵ open</span>
          <span>ESC close</span>
          <span style={{ marginLeft: 'auto' }}>Ctrl+K to reopen</span>
        </div>
      </div>
    </div>
  )
}
