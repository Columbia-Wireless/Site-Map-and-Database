import { Clock } from 'lucide-react'

interface Change {
  id: string
  field_name: string
  old_value: string | null
  new_value: string | null
  changed_by: string
  changed_at: string
  tower_sites: { site_code: string; name: string } | null
}

const FIELD_LABELS: Record<string, string> = {
  annual_rent: 'Annual Rent',
  status: 'Status',
  tenant_contact: 'Tenant Contact',
  lease_end: 'Lease End',
  notes: 'Notes',
  escalation_rate: 'Escalation Rate',
}

export default function RecentActivity({ changes }: { changes: Change[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {changes.map(c => (
        <div key={c.id} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
          <div style={{
            background: '#eff6ff',
            borderRadius: '6px',
            padding: '6px',
            flexShrink: 0,
            marginTop: '1px',
          }}>
            <Clock size={13} color="#2563eb" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '13px', color: '#0f172a', fontWeight: 500 }}>
              <span style={{ color: '#2563eb' }}>{c.tower_sites?.site_code}</span>
              {' — '}
              {FIELD_LABELS[c.field_name] || c.field_name} updated
            </div>
            <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
              {c.changed_by} · {new Date(c.changed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
