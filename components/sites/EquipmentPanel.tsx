'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import EquipmentDrawer from './EquipmentDrawer'

interface EquipmentItem {
  id: string
  license_id: string | null
  equipment_type: string
  manufacturer: string | null
  model: string | null
  quantity: number
  install_date: string | null
  location_description: string | null
  fcc_id: string | null
  notes: string | null
  site_licenses?: { id: string; licensees?: { id: string; name: string } | null } | null
}

interface LicenseOption { id: string; name: string }

const TYPE_ICONS: Record<string, string> = {
  'Antenna (Panel)':        '📡',
  'Antenna (Omni)':         '📶',
  'Antenna (Sector)':       '📡',
  'Antenna (Directional)':  '🎯',
  'Remote Radio Head (RRH)':'📻',
  'Equipment Cabinet':      '🗄️',
  'GPS Unit':               '🛰️',
  'Power Amplifier':        '⚡',
  'Backhaul Equipment':     '🔗',
  'Coaxial Cable Run':      '〰️',
  'Other':                  '🔧',
}

interface Props {
  siteId: string
  licenses: LicenseOption[]
}

export default function EquipmentPanel({ siteId, licenses }: Props) {
  const [items, setItems] = useState<EquipmentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState<EquipmentItem | undefined>(undefined)
  const [deleting, setDeleting] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/sites/${siteId}/equipment`)
    if (res.ok) setItems(await res.json())
    setLoading(false)
  }, [siteId])

  useEffect(() => { load() }, [load])

  function openAdd() { setEditing(undefined); setDrawerOpen(true) }
  function openEdit(item: EquipmentItem) { setEditing(item); setDrawerOpen(true) }

  async function handleDelete(itemId: string, label: string) {
    if (!window.confirm(`Remove ${label}? This cannot be undone.`)) return
    setDeleting(itemId)
    await fetch(`/api/sites/${siteId}/equipment/${itemId}`, { method: 'DELETE' })
    await load()
    setDeleting(null)
  }

  // Group by carrier name
  const grouped = items.reduce<Record<string, EquipmentItem[]>>((acc, item) => {
    const key = item.site_licenses?.licensees?.name ?? 'Site-wide'
    ;(acc[key] ??= []).push(item)
    return acc
  }, {})

  const carrierOrder = [
    ...Object.keys(grouped).filter(k => k !== 'Site-wide').sort(),
    ...(grouped['Site-wide'] ? ['Site-wide'] : []),
  ]

  return (
    <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '10px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid #f1f5f9' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a' }}>Equipment Inventory</span>
          {items.length > 0 && (
            <span style={{ fontSize: '12px', fontWeight: 600, padding: '3px 10px', borderRadius: '20px', background: '#eff6ff', color: '#1d4ed8' }}>
              {items.length} items · {Object.keys(grouped).length} carrier{Object.keys(grouped).length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <button
          onClick={openAdd}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#1a3a5c', color: 'white', border: 'none', borderRadius: '7px', padding: '7px 14px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
        >
          <Plus size={14} /> Add Equipment
        </button>
      </div>

      {loading ? (
        <div style={{ padding: '32px', textAlign: 'center', color: '#94a3b8', fontSize: '14px' }}>Loading…</div>
      ) : items.length === 0 ? (
        <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8', fontSize: '14px' }}>
          No equipment on record. Click <strong>Add Equipment</strong> to create the first entry.
        </div>
      ) : (
        <div>
          {carrierOrder.map((carrier, ci) => (
            <div key={carrier}>
              {/* Carrier header */}
              <div style={{ padding: '10px 20px', background: ci % 2 === 0 ? '#f8fafc' : '#f1f5f9', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#1a3a5c', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {carrier}
                </span>
                <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                  · {grouped[carrier].length} item{grouped[carrier].length !== 1 ? 's' : ''}
                </span>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'transparent', borderBottom: '1px solid #f1f5f9' }}>
                    {['Type', 'Make / Model', 'Qty', 'Install Date', 'Location', 'FCC ID', ''].map(h => (
                      <th key={h} style={{ padding: '7px 14px', textAlign: 'left', fontSize: '10px', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {grouped[carrier].map((item, i) => (
                    <tr key={item.id} style={{ background: i % 2 === 0 ? 'white' : '#fafafa', borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '15px' }}>{TYPE_ICONS[item.equipment_type] ?? '🔧'}</span>
                          <div>
                            <div style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a' }}>{item.equipment_type}</div>
                            {item.notes && (
                              <div style={{ fontSize: '11px', color: '#94a3b8', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.notes}>
                                {item.notes}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '10px 14px', fontSize: '13px', color: '#334155' }}>
                        {item.manufacturer || item.model
                          ? <>{item.manufacturer && <span style={{ fontWeight: 500 }}>{item.manufacturer}</span>}{item.manufacturer && item.model && ' '}{item.model && <span style={{ color: '#64748b' }}>{item.model}</span>}</>
                          : <span style={{ color: '#cbd5e1' }}>—</span>
                        }
                      </td>
                      <td style={{ padding: '10px 14px', fontSize: '13px', fontWeight: 600, color: '#0f172a', textAlign: 'center' }}>
                        {item.quantity}
                      </td>
                      <td style={{ padding: '10px 14px', fontSize: '12px', color: '#64748b', whiteSpace: 'nowrap' }}>
                        {item.install_date
                          ? new Date(item.install_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
                          : <span style={{ color: '#cbd5e1' }}>—</span>}
                      </td>
                      <td style={{ padding: '10px 14px', fontSize: '12px', color: '#475569', maxWidth: '200px' }}>
                        {item.location_description
                          ? <span title={item.location_description} style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.location_description}</span>
                          : <span style={{ color: '#cbd5e1' }}>—</span>}
                      </td>
                      <td style={{ padding: '10px 14px', fontSize: '12px', color: '#64748b', fontFamily: 'monospace' }}>
                        {item.fcc_id ?? <span style={{ color: '#cbd5e1', fontFamily: 'inherit' }}>—</span>}
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            onClick={() => openEdit(item)}
                            style={{ background: 'none', border: '1px solid #e2e8f0', borderRadius: '5px', padding: '4px 6px', cursor: 'pointer', color: '#64748b' }}
                            title="Edit"
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            onClick={() => handleDelete(item.id, `${item.quantity}× ${item.equipment_type}`)}
                            disabled={deleting === item.id}
                            style={{ background: 'none', border: '1px solid #fecaca', borderRadius: '5px', padding: '4px 6px', cursor: 'pointer', color: '#dc2626' }}
                            title="Remove"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      <EquipmentDrawer
        open={drawerOpen}
        onClose={() => { setDrawerOpen(false); setEditing(undefined) }}
        onSaved={load}
        siteId={siteId}
        licenses={licenses}
        existing={editing}
      />
    </div>
  )
}
