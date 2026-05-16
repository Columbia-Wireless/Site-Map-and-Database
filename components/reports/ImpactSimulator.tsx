'use client'

import { useState, useMemo } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts'
import { TrendingUp, X, ChevronDown, ChevronUp, Building2, Radio, Landmark, Search, Plus } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SiteOption {
  id: string
  site_code: string
  name: string
  city: string
  state: string
  tower_type: string
  status: string
  tenant_slots: number | null
  currentCarriers: number
  currentRent: number
}

type SiteType       = 'rooftop' | 'existing_tower' | 'greenfield'
type EscalationType = 'none' | 'annual' | 'step'
type TechTier       = 'macro_5g' | 'small_cell' | 'cbrs' | 'other'

interface CarrierSlot {
  id: string
  isExisting: boolean
  techTier: TechTier
  annualRent: number
}

interface ScenarioSite {
  siteId: string
  siteType: SiteType
  buildMonths: number
  freeRentMonths: number
  leaseUpMonths: number
  escalationType: EscalationType
  escalationRate: number        // e.g. 3 = 3 %
  escalationStartYear: number   // for step type
  escalationInterval: number    // for step type
  carriers: CarrierSlot[]
  expanded: boolean
  carriersExpanded: boolean
}

// ─── Lookup tables ────────────────────────────────────────────────────────────

const TECH_TIERS: Record<TechTier, { label: string; defaultRate: number }> = {
  macro_5g:   { label: 'Macro / 5G',  defaultRate: 36000 },
  small_cell: { label: 'Small Cell',  defaultRate: 24000 },
  cbrs:       { label: 'CBRS',        defaultRate: 18000 },
  other:      { label: 'Other',       defaultRate: 24000 },
}

const SITE_TYPE_PRESETS: Record<SiteType, {
  label: string; icon: React.ReactNode; color: string; description: string
  buildMonths: number; freeRentMonths: number; leaseUpMonths: number; defaultNewSlots: number
}> = {
  rooftop: {
    label: 'Rooftop / High-Rise',
    icon: <Building2 size={14} />,
    color: '#2563eb',
    description: 'Existing building with structural capacity. No construction needed. Can accommodate more carriers than a standard tower.',
    buildMonths: 0, freeRentMonths: 1, leaseUpMonths: 12, defaultNewSlots: 4,
  },
  existing_tower: {
    label: 'Existing Tower',
    icon: <Radio size={14} />,
    color: '#7c3aed',
    description: 'Monopole, lattice, or guyed tower with available slots. Infrastructure in place.',
    buildMonths: 0, freeRentMonths: 2, leaseUpMonths: 18, defaultNewSlots: 2,
  },
  greenfield: {
    label: 'Greenfield Site',
    icon: <Landmark size={14} />,
    color: '#d97706',
    description: 'Vacant land requiring tower construction. Build time precedes any leasing. New tenants receive a free rent period on signing.',
    buildMonths: 9, freeRentMonths: 2, leaseUpMonths: 24, defaultNewSlots: 2,
  },
}

const SITE_COLORS = ['#2563eb', '#16a34a', '#d97706', '#7c3aed', '#dc2626']

const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)

// ─── Escalation helper ────────────────────────────────────────────────────────
// Returns the rent multiplier for a given month (0-indexed from lease start).
function escalationMultiplier(
  month: number,
  type: EscalationType,
  rate: number,
  startYear: number,
  interval: number,
): number {
  if (type === 'none' || rate === 0) return 1
  const year = Math.floor(month / 12)
  if (type === 'annual') return Math.pow(1 + rate / 100, year)
  // step: bumps at startYear, startYear+interval, startYear+2*interval, …
  if (year < startYear) return 1
  const steps = Math.floor((year - startYear) / interval) + 1
  return Math.pow(1 + rate / 100, steps)
}

// ─── Revenue projection engine ────────────────────────────────────────────────
function projectSite(scenario: ScenarioSite, months: number): number[] {
  const result = new Array(months).fill(0)
  const { escalationType, escalationRate, escalationStartYear, escalationInterval,
          carriers, buildMonths, freeRentMonths, leaseUpMonths } = scenario

  const existing = carriers.filter(c => c.isExisting)
  const newSlots = carriers.filter(c => !c.isExisting)

  // Existing carriers: pay from month 0, escalation relative to simulation start
  for (const c of existing) {
    const monthlyBase = c.annualRent / 12
    for (let m = 0; m < months; m++) {
      result[m] += monthlyBase * escalationMultiplier(m, escalationType, escalationRate, escalationStartYear, escalationInterval)
    }
  }

  // New carriers: stagger in after build + lease-up; escalation relative to sign date
  const n = newSlots.length
  for (let i = 0; i < n; i++) {
    const c = newSlots[i]
    const monthlyBase = c.annualRent / 12
    const signMonth = buildMonths + (n <= 1 ? 0 : Math.round((i / (n - 1)) * leaseUpMonths))
    const payMonth  = signMonth + freeRentMonths
    for (let m = payMonth; m < months; m++) {
      const monthsSinceSigning = m - signMonth
      result[m] += monthlyBase * escalationMultiplier(monthsSinceSigning, escalationType, escalationRate, escalationStartYear, escalationInterval)
    }
  }

  return result
}

// ─── Build default carrier slots when a site is added ─────────────────────────
function buildDefaultCarriers(site: SiteOption, preset: typeof SITE_TYPE_PRESETS[SiteType]): CarrierSlot[] {
  const perCarrier = site.currentCarriers > 0 ? Math.round(site.currentRent / site.currentCarriers) : 0
  const existing: CarrierSlot[] = Array.from({ length: site.currentCarriers }, (_, i) => ({
    id: `ex-${i}`,
    isExisting: true,
    techTier: 'macro_5g',
    annualRent: perCarrier,
  }))
  const newCount = Math.max(1, preset.defaultNewSlots)
  const newSlots: CarrierSlot[] = Array.from({ length: newCount }, (_, i) => ({
    id: `new-${i}`,
    isExisting: false,
    techTier: 'macro_5g',
    annualRent: i === 0 ? 36000 : 30000, // anchor vs co-locator
  }))
  return [...existing, ...newSlots]
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ImpactSimulator({ sites }: { sites: SiteOption[] }) {
  const [scenarios, setScenarios] = useState<ScenarioSite[]>([])
  const [search, setSearch]       = useState('')
  const MONTHS = 36

  const selectedIds = new Set(scenarios.map(s => s.siteId))

  function addSite(site: SiteOption) {
    if (selectedIds.has(site.id) || scenarios.length >= 5) return
    const type: SiteType = site.tower_type === 'rooftop' ? 'rooftop'
      : site.currentCarriers === 0 ? 'greenfield'
      : 'existing_tower'
    const preset = SITE_TYPE_PRESETS[type]
    setScenarios(prev => [...prev, {
      siteId:             site.id,
      siteType:           type,
      buildMonths:        preset.buildMonths,
      freeRentMonths:     preset.freeRentMonths,
      leaseUpMonths:      preset.leaseUpMonths,
      escalationType:     'annual',
      escalationRate:     3,
      escalationStartYear: 6,
      escalationInterval: 5,
      carriers:           buildDefaultCarriers(site, preset),
      expanded:           true,
      carriersExpanded:   true,
    }])
    setSearch('')
  }

  function removeSite(siteId: string) {
    setScenarios(prev => prev.filter(s => s.siteId !== siteId))
  }

  function updateScenario(siteId: string, patch: Partial<ScenarioSite>) {
    setScenarios(prev => prev.map(s => s.siteId === siteId ? { ...s, ...patch } : s))
  }

  function applyTypePreset(siteId: string, type: SiteType) {
    const p = SITE_TYPE_PRESETS[type]
    setScenarios(prev => prev.map(s => s.siteId === siteId ? {
      ...s, siteType: type, buildMonths: p.buildMonths,
      freeRentMonths: p.freeRentMonths, leaseUpMonths: p.leaseUpMonths,
    } : s))
  }

  function addCarrierSlot(siteId: string) {
    setScenarios(prev => prev.map(s => {
      if (s.siteId !== siteId) return s
      const newCount = s.carriers.filter(c => !c.isExisting).length
      return {
        ...s,
        carriers: [...s.carriers, {
          id: `new-${Date.now()}`,
          isExisting: false,
          techTier: 'macro_5g' as TechTier,
          annualRent: newCount === 0 ? 36000 : 30000,
        }],
      }
    }))
  }

  function removeCarrierSlot(siteId: string, carrierId: string) {
    setScenarios(prev => prev.map(s => {
      if (s.siteId !== siteId) return s
      return { ...s, carriers: s.carriers.filter(c => c.id !== carrierId) }
    }))
  }

  function updateCarrier(siteId: string, carrierId: string, patch: Partial<CarrierSlot>) {
    setScenarios(prev => prev.map(s => {
      if (s.siteId !== siteId) return s
      return { ...s, carriers: s.carriers.map(c => c.id === carrierId ? { ...c, ...patch } : c) }
    }))
  }

  // ── Chart data ───────────────────────────────────────────────────────────
  const chartData = useMemo(() => {
    if (scenarios.length === 0) return []
    const projections = scenarios.map(sc => projectSite(sc, MONTHS))
    return Array.from({ length: MONTHS }, (_, m) => {
      const entry: Record<string, any> = { month: m + 1 }
      scenarios.forEach((sc, i) => {
        const site = sites.find(s => s.id === sc.siteId)!
        entry[site.site_code] = Math.round(projections[i][m])
      })
      return entry
    })
  }, [scenarios, sites])

  const summary = useMemo(() => {
    if (scenarios.length === 0) return null
    let currentAnnual = 0
    let yr1 = 0, yr2 = 0, yr3 = 0
    scenarios.forEach(sc => {
      const site = sites.find(s => s.id === sc.siteId)!
      currentAnnual += site.currentRent
      const monthly = projectSite(sc, MONTHS)
      yr1 += monthly.slice(0,  12).reduce((a, b) => a + b, 0)
      yr2 += monthly.slice(12, 24).reduce((a, b) => a + b, 0)
      yr3 += monthly.slice(24, 36).reduce((a, b) => a + b, 0)
    })
    return { currentAnnual, yr1, yr2, yr3, total3yr: yr1 + yr2 + yr3 }
  }, [scenarios, sites])

  const filteredSites = sites.filter(s =>
    !selectedIds.has(s.id) &&
    (s.name.toLowerCase().includes(search.toLowerCase()) ||
     s.site_code.toLowerCase().includes(search.toLowerCase()) ||
     s.city.toLowerCase().includes(search.toLowerCase()))
  )

  return (
    <div style={{ padding: '32px', maxWidth: '1200px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
        <div style={{ background: '#eff6ff', borderRadius: '10px', padding: '10px' }}>
          <TrendingUp size={22} color="#2563eb" />
        </div>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a', margin: 0 }}>Revenue Impact Simulator</h1>
          <p style={{ fontSize: '13px', color: '#64748b', margin: '2px 0 0' }}>
            Model potential revenue from carrier leasing across up to 5 sites
          </p>
        </div>
      </div>

      {/* Site type legend */}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '24px', marginTop: '16px' }}>
        {(Object.entries(SITE_TYPE_PRESETS) as [SiteType, typeof SITE_TYPE_PRESETS[SiteType]][]).map(([key, p]) => (
          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'white', border: `1px solid ${p.color}30`, borderRadius: '8px', padding: '6px 12px', fontSize: '12px', color: p.color, fontWeight: 500 }}>
            {p.icon} {p.label}
          </div>
        ))}
      </div>

      {/* Site picker */}
      {scenarios.length < 5 ? (
        <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', marginBottom: '20px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 14px', borderBottom: '1px solid #f1f5f9' }}>
            <Search size={15} color="#94a3b8" style={{ flexShrink: 0 }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={`Search and select a site to add… (${scenarios.length}/5)`}
              style={{ flex: 1, border: 'none', outline: 'none', fontSize: '13px', color: '#0f172a', background: 'transparent' }}
            />
            {search && (
              <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '2px', display: 'flex' }}>
                <X size={13} />
              </button>
            )}
          </div>
          <div style={{ maxHeight: '240px', overflowY: 'auto' }}>
            {filteredSites.slice(0, 30).map((site, i) => (
              <div key={site.id} onClick={() => addSite(site)}
                style={{ padding: '10px 14px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: i === 0 ? 'none' : '1px solid #f8fafc' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a' }}>{site.name}</div>
                  <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '1px' }}>
                    {site.site_code} · {[site.city, site.state].filter(Boolean).join(', ')} · {site.tower_type?.replace('_', ' ')}
                  </div>
                </div>
                <div style={{ textAlign: 'right', fontSize: '12px', flexShrink: 0, marginLeft: '12px' }}>
                  <div style={{ color: site.currentCarriers > 0 ? '#16a34a' : '#f59e0b', fontWeight: 600 }}>
                    {site.currentCarriers > 0 ? fmt(site.currentRent) : 'Vacant'}
                  </div>
                  <div style={{ color: '#94a3b8' }}>{site.currentCarriers} carrier{site.currentCarriers !== 1 ? 's' : ''}</div>
                </div>
              </div>
            ))}
            {filteredSites.length === 0 && (
              <div style={{ padding: '24px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
                {search ? `No sites match "${search}"` : 'All sites have been added'}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px 16px', marginBottom: '20px', fontSize: '13px', color: '#64748b' }}>
          <strong style={{ color: '#0f172a' }}>5 sites selected</strong> — remove a site below to add another.
        </div>
      )}

      {/* Empty state */}
      {scenarios.length === 0 && (
        <div style={{ background: 'white', border: '2px dashed #e2e8f0', borderRadius: '12px', padding: '48px', textAlign: 'center' }}>
          <TrendingUp size={32} color="#cbd5e1" style={{ marginBottom: '12px' }} />
          <div style={{ fontSize: '15px', fontWeight: 600, color: '#94a3b8', marginBottom: '6px' }}>No sites selected</div>
          <div style={{ fontSize: '13px', color: '#cbd5e1' }}>Search and select up to 5 sites above to model revenue projections</div>
        </div>
      )}

      {/* Scenario cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '28px' }}>
        {scenarios.map((sc, idx) => {
          const site   = sites.find(s => s.id === sc.siteId)!
          const preset = SITE_TYPE_PRESETS[sc.siteType]
          const color  = SITE_COLORS[idx]
          const newSlots = sc.carriers.filter(c => !c.isExisting)

          // ── Capacity maths ──────────────────────────────────────────────
          const totalPositions  = site.tenant_slots ?? null
          const occupiedCount   = site.currentCarriers
          const newCount        = newSlots.length
          const simulatedTotal  = occupiedCount + newCount
          const availableSlots  = totalPositions !== null ? totalPositions - occupiedCount : null
          const overCapacity    = availableSlots !== null && newCount > availableSlots

          // Tech breakdown of existing carriers
          const existingByTier = sc.carriers
            .filter(c => c.isExisting)
            .reduce<Record<string, number>>((acc, c) => {
              acc[c.techTier] = (acc[c.techTier] ?? 0) + 1
              return acc
            }, {})

          return (
            <div key={sc.siteId} style={{ background: 'white', border: `1px solid ${overCapacity ? '#ef4444' : color}30`, borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              {/* Card header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 18px', background: `${color}08`, borderBottom: `1px solid ${color}20` }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: color, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>{site.name}</span>
                  <span style={{ fontSize: '12px', color: '#94a3b8', marginLeft: '8px' }}>{site.site_code} · {site.city}, {site.state}</span>
                </div>
                <span style={{ fontSize: '11px', fontWeight: 600, padding: '3px 8px', borderRadius: '20px', background: `${preset.color}15`, color: preset.color, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  {preset.icon} {preset.label}
                </span>
                <button onClick={() => updateScenario(sc.siteId, { expanded: !sc.expanded })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '4px' }}>
                  {sc.expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
                <button onClick={() => removeSite(sc.siteId)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '4px' }}>
                  <X size={16} />
                </button>
              </div>

              {/* ── Capacity summary bar ── */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', borderBottom: `1px solid ${color}15`, background: '#fafafa' }}>
                <CapStat label="Total Capacity" value={totalPositions !== null ? `${totalPositions} positions` : 'Unknown'} sub="" color="#0f172a" />
                <CapStat
                  label="Currently Occupied"
                  value={`${occupiedCount} carrier${occupiedCount !== 1 ? 's' : ''}`}
                  sub={Object.entries(existingByTier).map(([t, n]) => `${n} ${TECH_TIERS[t as TechTier]?.label ?? t}`).join(' · ') || (occupiedCount === 0 ? 'Vacant' : '')}
                  color="#15803d"
                />
                <CapStat
                  label="Available Slots"
                  value={availableSlots !== null ? `${availableSlots} open` : '—'}
                  sub={availableSlots !== null && availableSlots === 0 ? 'At capacity' : ''}
                  color={availableSlots === 0 ? '#b91c1c' : '#2563eb'}
                />
                <CapStat
                  label="This Simulation"
                  value={`+${newCount} new → ${simulatedTotal} total`}
                  sub={overCapacity ? `⚠ Exceeds capacity by ${newCount - (availableSlots ?? 0)}` : availableSlots !== null ? `${availableSlots - newCount} slots remaining` : ''}
                  color={overCapacity ? '#dc2626' : '#7c3aed'}
                />
              </div>

              {/* Occupancy bar */}
              {totalPositions !== null && (
                <div style={{ height: '4px', background: '#f1f5f9', display: 'flex' }}>
                  <div style={{ width: `${Math.min(100, (occupiedCount / totalPositions) * 100)}%`, background: '#16a34a', transition: 'width 0.3s' }} />
                  <div style={{ width: `${Math.min(100 - (occupiedCount / totalPositions) * 100, (newCount / totalPositions) * 100)}%`, background: overCapacity ? '#ef4444' : color, opacity: 0.5, transition: 'width 0.3s' }} />
                </div>
              )}

              {sc.expanded && (
                <div style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

                  {/* ── Site type + timing ── */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px' }}>
                    {/* Site type */}
                    <div>
                      <SectionLabel>Site Type</SectionLabel>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '6px' }}>
                        {(Object.entries(SITE_TYPE_PRESETS) as [SiteType, typeof SITE_TYPE_PRESETS[SiteType]][]).map(([key, p]) => (
                          <button key={key} onClick={() => applyTypePreset(sc.siteId, key)} style={{
                            display: 'inline-flex', alignItems: 'center', gap: '5px',
                            padding: '5px 10px', borderRadius: '7px',
                            border: `1px solid ${sc.siteType === key ? p.color : '#e2e8f0'}`,
                            background: sc.siteType === key ? `${p.color}12` : 'white',
                            color: sc.siteType === key ? p.color : '#64748b',
                            fontSize: '12px', fontWeight: sc.siteType === key ? 600 : 400, cursor: 'pointer',
                          }}>
                            {p.icon} {p.label}
                          </button>
                        ))}
                      </div>
                      <div style={{ fontSize: '11px', color: '#94a3b8' }}>{preset.description}</div>
                    </div>

                    {/* Timing */}
                    <div>
                      <SectionLabel>Timing</SectionLabel>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                        {sc.siteType === 'greenfield' && (
                          <InputField label="Build (mo)" value={sc.buildMonths} min={0} max={24}
                            onChange={v => updateScenario(sc.siteId, { buildMonths: v })} />
                        )}
                        <InputField label="Free Rent (mo)" value={sc.freeRentMonths} min={0} max={6}
                          onChange={v => updateScenario(sc.siteId, { freeRentMonths: v })} />
                        <InputField label="Lease-Up (mo)" value={sc.leaseUpMonths} min={1} max={36}
                          onChange={v => updateScenario(sc.siteId, { leaseUpMonths: v })} />
                      </div>
                    </div>
                  </div>

                  {/* ── Escalation ── */}
                  <div style={{ background: '#f8fafc', borderRadius: '10px', padding: '14px 16px' }}>
                    <SectionLabel>Escalation Clause</SectionLabel>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      {/* Type selector */}
                      {(['none', 'annual', 'step'] as EscalationType[]).map(t => (
                        <button key={t} onClick={() => updateScenario(sc.siteId, { escalationType: t })} style={{
                          padding: '5px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 500, cursor: 'pointer',
                          border: `1px solid ${sc.escalationType === t ? '#2563eb' : '#e2e8f0'}`,
                          background: sc.escalationType === t ? '#eff6ff' : 'white',
                          color: sc.escalationType === t ? '#2563eb' : '#64748b',
                        }}>
                          {t === 'none' ? 'None' : t === 'annual' ? 'Annual %' : 'Step (yr 6 / 5-yr)'}
                        </button>
                      ))}

                      {sc.escalationType !== 'none' && (
                        <>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: '4px' }}>
                            <input
                              type="number" min={0} max={20} step={0.5}
                              value={sc.escalationRate}
                              onChange={e => {
                                const v = parseFloat(e.target.value)
                                if (!isNaN(v) && v >= 0 && v <= 20) updateScenario(sc.siteId, { escalationRate: v })
                              }}
                              style={{ width: '56px', padding: '5px 8px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '13px', fontWeight: 600, color: '#0f172a', outline: 'none', textAlign: 'center' }}
                            />
                            <span style={{ fontSize: '13px', color: '#64748b' }}>%</span>
                          </div>

                          {sc.escalationType === 'step' && (
                            <>
                              <span style={{ fontSize: '12px', color: '#94a3b8' }}>starting yr</span>
                              <input type="number" min={1} max={20} value={sc.escalationStartYear}
                                onChange={e => {
                                  const v = parseInt(e.target.value)
                                  if (!isNaN(v) && v >= 1) updateScenario(sc.siteId, { escalationStartYear: v })
                                }}
                                style={{ width: '48px', padding: '5px 8px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '13px', fontWeight: 600, color: '#0f172a', outline: 'none', textAlign: 'center' }}
                              />
                              <span style={{ fontSize: '12px', color: '#94a3b8' }}>every</span>
                              <input type="number" min={1} max={10} value={sc.escalationInterval}
                                onChange={e => {
                                  const v = parseInt(e.target.value)
                                  if (!isNaN(v) && v >= 1) updateScenario(sc.siteId, { escalationInterval: v })
                                }}
                                style={{ width: '48px', padding: '5px 8px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '13px', fontWeight: 600, color: '#0f172a', outline: 'none', textAlign: 'center' }}
                              />
                              <span style={{ fontSize: '12px', color: '#94a3b8' }}>yrs</span>
                            </>
                          )}
                        </>
                      )}
                    </div>

                    {sc.escalationType !== 'none' && (
                      <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '8px' }}>
                        {sc.escalationType === 'annual'
                          ? `Rent increases ${sc.escalationRate}% each year for all carriers (existing + new)`
                          : `Rent increases ${sc.escalationRate}% at year ${sc.escalationStartYear}, then every ${sc.escalationInterval} years — flat in between`
                        }
                      </div>
                    )}
                  </div>

                  {/* ── Carrier slots ── */}
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                      <SectionLabel style={{ margin: 0 }}>
                        Carriers — {sc.carriers.filter(c => c.isExisting).length} existing · {newSlots.length} new
                      </SectionLabel>
                      <button
                        onClick={() => updateScenario(sc.siteId, { carriersExpanded: !sc.carriersExpanded })}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}
                      >
                        {sc.carriersExpanded ? <><ChevronUp size={13} /> Hide</> : <><ChevronDown size={13} /> Show</>}
                      </button>
                    </div>

                    {sc.carriersExpanded && (
                      <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                          <thead>
                            <tr style={{ background: '#f8fafc' }}>
                              {['#', 'Status', 'Technology', 'Annual Rent', 'Sign Month (est.)', ''].map(h => (
                                <th key={h} style={{ padding: '7px 12px', textAlign: 'left', fontSize: '10px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {sc.carriers.map((c, ci) => {
                              const newIdx = sc.carriers.filter((x, xi) => !x.isExisting && xi < ci).length
                              const n = newSlots.length
                              const signMonth = c.isExisting ? 0
                                : sc.buildMonths + (n <= 1 ? 0 : Math.round((newIdx / (n - 1)) * sc.leaseUpMonths))

                              return (
                                <tr key={c.id} style={{ borderTop: ci === 0 ? 'none' : '1px solid #f1f5f9', background: c.isExisting ? '#fafeff' : 'white' }}>
                                  <td style={{ padding: '8px 12px', fontSize: '12px', color: '#94a3b8', fontWeight: 600 }}>{ci + 1}</td>
                                  <td style={{ padding: '8px 12px' }}>
                                    <span style={{
                                      fontSize: '11px', fontWeight: 600, padding: '2px 7px', borderRadius: '12px',
                                      background: c.isExisting ? '#dcfce7' : newIdx === 0 ? '#eff6ff' : '#f5f3ff',
                                      color:      c.isExisting ? '#15803d' : newIdx === 0 ? '#2563eb'  : '#7c3aed',
                                    }}>
                                      {c.isExisting ? 'Existing' : newIdx === 0 ? 'Anchor' : 'Co-locator'}
                                    </span>
                                  </td>
                                  <td style={{ padding: '8px 12px' }}>
                                    <select
                                      value={c.techTier}
                                      onChange={e => {
                                        const tier = e.target.value as TechTier
                                        const defaultRate = TECH_TIERS[tier].defaultRate
                                        updateCarrier(sc.siteId, c.id, { techTier: tier, annualRent: c.isExisting ? c.annualRent : defaultRate })
                                      }}
                                      style={{ border: '1px solid #e2e8f0', borderRadius: '6px', padding: '4px 8px', fontSize: '12px', color: '#0f172a', background: 'white', cursor: 'pointer', outline: 'none' }}
                                    >
                                      {(Object.entries(TECH_TIERS) as [TechTier, typeof TECH_TIERS[TechTier]][]).map(([k, v]) => (
                                        <option key={k} value={k}>{v.label}</option>
                                      ))}
                                    </select>
                                  </td>
                                  <td style={{ padding: '8px 12px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #e2e8f0', borderRadius: '6px', overflow: 'hidden', width: '120px' }}>
                                      <span style={{ padding: '0 6px', fontSize: '12px', color: '#94a3b8', background: '#f8fafc', borderRight: '1px solid #e2e8f0', height: '100%', display: 'flex', alignItems: 'center' }}>$</span>
                                      <input
                                        type="number" min={0} step={1000}
                                        value={c.annualRent}
                                        onChange={e => {
                                          const v = parseInt(e.target.value)
                                          if (!isNaN(v) && v >= 0) updateCarrier(sc.siteId, c.id, { annualRent: v })
                                        }}
                                        style={{ flex: 1, padding: '5px 8px', border: 'none', fontSize: '12px', fontWeight: 600, color: '#0f172a', outline: 'none', width: '100%' }}
                                      />
                                    </div>
                                  </td>
                                  <td style={{ padding: '8px 12px', fontSize: '12px', color: '#64748b' }}>
                                    {c.isExisting ? 'Active' : `Mo ${signMonth + 1}${sc.freeRentMonths > 0 ? ` (+${sc.freeRentMonths} free)` : ''}`}
                                  </td>
                                  <td style={{ padding: '8px 12px' }}>
                                    {!c.isExisting && (
                                      <button onClick={() => removeCarrierSlot(sc.siteId, c.id)}
                                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#cbd5e1', padding: '2px', display: 'flex' }}>
                                        <X size={13} />
                                      </button>
                                    )}
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                        <div style={{ padding: '10px 12px', borderTop: '1px solid #f1f5f9' }}>
                          <button onClick={() => addCarrierSlot(sc.siteId)} style={{
                            display: 'inline-flex', alignItems: 'center', gap: '5px',
                            background: 'white', border: '1px dashed #cbd5e1', borderRadius: '6px',
                            padding: '5px 12px', fontSize: '12px', color: '#64748b', cursor: 'pointer', fontWeight: 500,
                          }}>
                            <Plus size={12} /> Add carrier slot
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Summary + chart */}
      {summary && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px', marginBottom: '24px' }}>
            {[
              { label: 'Current Annual',  value: fmt(summary.currentAnnual), color: '#475569', bg: '#f8fafc' },
              { label: 'Year 1 Revenue',  value: fmt(summary.yr1),           color: '#2563eb', bg: '#eff6ff' },
              { label: 'Year 2 Revenue',  value: fmt(summary.yr2),           color: '#7c3aed', bg: '#f5f3ff' },
              { label: 'Year 3 Revenue',  value: fmt(summary.yr3),           color: '#16a34a', bg: '#f0fdf4' },
              { label: '3-Year Total',    value: fmt(summary.total3yr),      color: '#0f172a', bg: '#f1f5f9', bold: true },
            ].map(({ label, value, color, bg, bold }) => (
              <div key={label} style={{ background: bg, border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px' }}>
                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>{label}</div>
                <div style={{ fontSize: '18px', fontWeight: bold ? 800 : 700, color }}>{value}</div>
              </div>
            ))}
          </div>

          <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <div style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a', marginBottom: '4px' }}>Monthly Revenue Projection — 36 Months</div>
            <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '20px' }}>Stacked by site. Includes existing rent + projected new carrier revenue, with escalation applied.</div>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={chartData} margin={{ top: 0, right: 0, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} label={{ value: 'Month', position: 'insideBottom', offset: -2, fontSize: 11, fill: '#94a3b8' }} />
                <YAxis tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                <Tooltip
                  formatter={(value: any, name: any) => [fmt(Number(value ?? 0)), String(name ?? '')]}
                  labelFormatter={label => `Month ${label}`}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                />
                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '12px' }} />
                {scenarios.map((sc, idx) => {
                  const site = sites.find(s => s.id === sc.siteId)!
                  return (
                    <Area key={sc.siteId} type="monotone" dataKey={site.site_code}
                      stackId="1" stroke={SITE_COLORS[idx]} fill={SITE_COLORS[idx]}
                      fillOpacity={0.15} strokeWidth={2}
                    />
                  )
                })}
              </AreaChart>
            </ResponsiveContainer>
            <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: '8px', paddingTop: '12px', borderTop: '1px solid #f1f5f9' }}>
              {['Year 1 (Mo 1–12)', 'Year 2 (Mo 13–24)', 'Year 3 (Mo 25–36)'].map((label, i) => (
                <div key={i} style={{ textAlign: 'center', fontSize: '11px', color: '#94a3b8' }}>{label}</div>
              ))}
            </div>
          </div>

          <div style={{ marginTop: '16px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', padding: '12px 16px', fontSize: '12px', color: '#78350f' }}>
            <strong>Assumptions:</strong> Existing carriers pay their contracted rate from month 1. New carriers stagger in across the lease-up period after construction completes. Free rent delays the first payment per carrier. Escalation (if set) applies to all carriers — annual compounds yearly; step type bumps at the configured year and interval, flat in between. All figures are projections for illustrative purposes only.
          </div>
        </>
      )}
    </div>
  )
}

// ─── Small helpers ─────────────────────────────────────────────────────────────

function CapStat({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <div style={{ padding: '10px 16px', borderRight: '1px solid #f1f5f9' }}>
      <div style={{ fontSize: '10px', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '3px' }}>{label}</div>
      <div style={{ fontSize: '13px', fontWeight: 700, color }}>{value}</div>
      {sub && <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '1px' }}>{sub}</div>}
    </div>
  )
}

function SectionLabel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px', ...style }}>
      {children}
    </div>
  )
}

function InputField({ label, value, min, max, step = 1, onChange }: {
  label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void
}) {
  return (
    <div>
      <div style={{ fontSize: '10px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>{label}</div>
      <input
        type="number" value={value} min={min} max={max} step={step}
        onChange={e => {
          const v = Number(e.target.value)
          if (!isNaN(v) && v >= min && v <= max) onChange(v)
        }}
        style={{ width: '100%', padding: '6px 8px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '13px', fontWeight: 600, color: '#0f172a', outline: 'none', boxSizing: 'border-box' }}
      />
    </div>
  )
}
