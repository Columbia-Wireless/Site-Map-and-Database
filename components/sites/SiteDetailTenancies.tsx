'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import TenancyDrawer from './TenancyDrawer'
import { SiteTenancy } from '@/lib/types'

interface TenantOption { id: string; name: string }

interface TenancyRow extends SiteTenancy {
  tenants: { name: string } | null
}

const TENANCY_STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  active:        { bg: '#dcfce7', color: '#15803d' },
  pending:       { bg: '#e0f2fe', color: '#0369a1' },
  expiring_soon: { bg: '#fffbeb', color: '#b45309' },
  expired:       { bg: '#fee2e2', color: '#b91c1c' },
  terminated:    { bg: '#f1f5f9', color: '#475569' },
}

const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)

interface Props {
  siteId: string
  tenants: TenantOption[]
  tenantSlots?: number | null
}

export default function SiteDetailTenancies({ siteId, tenants, tenantSlots }: Props) {
  const [tenancies, setTenancies] = useState<TenancyRow[]>([])
  const [loading, setLoading] = useState(true)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState<TenancyRow | undefined>(undefined)
  const [deleting, setDeleting] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/sites/${siteId}/tenancies`)
    if (res.ok) setTenancies(await res.json())
    setLoading(false)
  }, [siteId])

  useEffect(() => { load() }, [load])

  function openAdd() { setEditing(undefined); setDrawerOpen(true) }
  function openEdit(t: TenancyRow) { setEditing(t); setDrawerOpen(true) }

  async function handleDelete(tenancyId: string, tenantName: string) {
    if (!window.confirm(`Remove the tenancy for ${tenantName}? This cannot be undone.`)) return
    setDeleting(tenancyId)
    const res = await fetch(`/api/sites/${siteId}/tenancies/${tenancyId}`, { method: 'DELETE' })
    if (res.ok) {
      await load()
    } else {
      const j = await res.json()
      alert(j.error ?? 'Delete failed')
    }
    setDeleting(null)
  }

  const totalRevenue = tenancies.reduce((sum, t) => sum + Number(t.annual_rent), 0)

  return (
    <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '10px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid #f1f5f9' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a' }}>
            Licenses
          </span>
          {/* Occupancy pill */}
          {(() => {
            const active = tenancies.filter(t => ['active','pending','expiring_soon'].includes(t.status)).length
            if (tenantSlots) {
              const avail = tenantSlots - active
              const pct = Math.min(100, (active / tenantSlots) * 100)
              const bg = pct >= 100 ? '#dcfce7' : pct >= 60 ? '#dbeafe' : '#fef3c7'
              const clr = pct >= 100 ? '#166534' : pct >= 60 ? '#1d4ed8' : '#92400e'
              return (
                <span style={{ fontSize: '12px', fontWeight: 700, padding: '3px 10px', borderRadius: '20px', background: bg, color: clr }}>
                  {active} / {tenantSlots} slots{avail > 0 ? ` · ${avail} available` : ' · Full'}
                </span>
              )
            }
            return (
              <span style={{ fontSize: '13px', color: '#64748b' }}>
                {active} active
              </span>
            )
          })()}
          {tenancies.length > 0 && (
            <span style={{ fontSize: '13px', color: '#64748b' }}>
              {fmt(totalRevenue)} / yr
            </span>
          )}
        </div>
        <button
          onClick={openAdd}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#1a3a5c', color: 'white', border: 'none', borderRadius: '7px', padding: '7px 14px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
        >
          <Plus size={14} /> Add License
        </button>
      </div>

      {loading ? (
        <div style={{ padding: '32px', textAlign: 'center', color: '#94a3b8', fontSize: '14px' }}>Loading…</div>
      ) : tenancies.length === 0 ? (
        <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8', fontSize: '14px' }}>
          No licenses yet. Click <strong>Add License</strong> to add the first license.
        </div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
              {['Licensee', 'Contract Type', 'Invoice', 'Mount Type', 'Height', 'Annual Rent', 'Escalation', 'License Start', 'License End', 'Status', ''].map(h => (
                <th key={h} style={{ padding: '9px 14px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tenancies.map((t, i) => {
              const statusStyle = TENANCY_STATUS_COLORS[t.status] ?? { bg: '#f1f5f9', color: '#475569' }
              const now = new Date()
              const daysToExpiry = Math.round((new Date(t.license_end).getTime() - now.getTime()) / 86400000)

              return (
                <tr key={t.id} style={{ background: i % 2 === 0 ? 'white' : '#fafafa', borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '11px 14px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a' }}>{t.licensees?.name ?? '—'}</div>
                    {t.notes && (
                      <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px', maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={t.notes}>
                        {t.notes}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '11px 14px', fontSize: '12px', color: '#475569', whiteSpace: 'nowrap' }}>
                    <span style={{
                      padding: '2px 7px', borderRadius: '10px', fontWeight: 600,
                      background: t.contract_type === 'Base Agreement' ? '#eff6ff' : t.contract_type === 'Amendment' ? '#f0fdf4' : t.contract_type === 'Settlement' ? '#fef9c3' : '#f1f5f9',
                      color:      t.contract_type === 'Base Agreement' ? '#1d4ed8' : t.contract_type === 'Amendment' ? '#15803d' : t.contract_type === 'Settlement' ? '#854d0e' : '#475569',
                    }}>
                      {t.contract_type ?? 'Base Agreement'}
                    </span>
                  </td>
                  <td style={{ padding: '11px 14px', fontSize: '12px', color: '#64748b', whiteSpace: 'nowrap' }}>
                    {(!t.invoice_method || t.invoice_method === 'None') ? <span style={{ color: '#cbd5e1' }}>—</span> : t.invoice_method}
                  </td>
                  <td style={{ padding: '11px 14px', fontSize: '13px', color: '#334155' }}>{t.mount_type}</td>
                  <td style={{ padding: '11px 14px', fontSize: '13px', color: '#64748b' }}>
                    {t.antenna_height_ft != null ? `${t.antenna_height_ft} ft` : '—'}
                  </td>
                  <td style={{ padding: '11px 14px', fontSize: '13px', fontWeight: 600, color: '#0f172a' }}>
                    {fmt(Number(t.annual_rent))}
                  </td>
                  <td style={{ padding: '11px 14px', fontSize: '13px', color: '#64748b' }}>
                    {t.escalation_rate}%
                  </td>
                  <td style={{ padding: '11px 14px', fontSize: '13px', color: '#64748b', whiteSpace: 'nowrap' }}>
                    {new Date(t.license_start).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </td>
                  <td style={{ padding: '11px 14px', fontSize: '13px', whiteSpace: 'nowrap', color: daysToExpiry < 0 ? '#dc2626' : daysToExpiry <= 180 ? '#d97706' : '#334155', fontWeight: daysToExpiry <= 180 ? 600 : 400 }}>
                    {new Date(t.license_end).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </td>
                  <td style={{ padding: '11px 14px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 600, padding: '3px 8px', borderRadius: '12px', background: statusStyle.bg, color: statusStyle.color, whiteSpace: 'nowrap' }}>
                      {t.status === 'expiring_soon' ? 'Expiring Soon' : t.status.charAt(0).toUpperCase() + t.status.slice(1)}
                    </span>
                  </td>
                  <td style={{ padding: '11px 14px' }}>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        onClick={() => openEdit(t)}
                        style={{ background: 'none', border: '1px solid #e2e8f0', borderRadius: '5px', padding: '4px 6px', cursor: 'pointer', color: '#64748b' }}
                        title="Edit"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={() => handleDelete(t.id, t.tenants?.name ?? 'tenant')}
                        disabled={deleting === t.id}
                        style={{ background: 'none', border: '1px solid #fecaca', borderRadius: '5px', padding: '4px 6px', cursor: 'pointer', color: '#dc2626' }}
                        title="Remove"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
          {tenancies.length > 1 && (
            <tfoot>
              <tr style={{ borderTop: '2px solid #e2e8f0', background: '#f8fafc' }}>
                <td colSpan={5} style={{ padding: '10px 14px', fontSize: '12px', fontWeight: 600, color: '#64748b' }}>
                  TOTAL ({tenancies.length} licensees)
                </td>
                <td style={{ padding: '10px 14px', fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>
                  {fmt(totalRevenue)}
                </td>
                <td colSpan={5} />
              </tr>
            </tfoot>
          )}
        </table>
      )}

      <TenancyDrawer
        open={drawerOpen}
        onClose={() => { setDrawerOpen(false); setEditing(undefined) }}
        onSaved={load}
        siteId={siteId}
        tenants={tenants}
        existing={editing as any}
      />
    </div>
  )
}
