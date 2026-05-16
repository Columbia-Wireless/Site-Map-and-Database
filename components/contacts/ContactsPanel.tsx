import { Phone, Mail, User, ChevronRight } from 'lucide-react'

interface Contact {
  id: string
  contact_type: string
  name: string | null
  email: string | null
  phone: string | null
  notes: string | null
}

const TYPE_COLORS: Record<string, { bg: string; color: string }> = {
  'Carrier AP':              { bg: '#eff6ff', color: '#1d4ed8' },
  'Carrier Lease Admin':     { bg: '#f0fdf4', color: '#15803d' },
  'Carrier Legal':           { bg: '#fdf4ff', color: '#7c3aed' },
  'Carrier Site Tech':       { bg: '#fff7ed', color: '#c2410c' },
  'Carrier Emergency Tel #': { bg: '#fee2e2', color: '#b91c1c' },
  'Carrier COI Contact':     { bg: '#f0fdf4', color: '#166534' },
  'Carrier Real Estate Mgr': { bg: '#eff6ff', color: '#1d4ed8' },
  'Carrier Project Mgr':     { bg: '#eff6ff', color: '#1d4ed8' },
  'Carrier Contact':         { bg: '#f8fafc', color: '#475569' },
  'Owner':                   { bg: '#f5f3ff', color: '#6d28d9' },
  'Owner Legal':             { bg: '#fdf4ff', color: '#7c3aed' },
  'Owner AP-AR Contact':     { bg: '#eff6ff', color: '#1d4ed8' },
  'Owner Asset Mgr':         { bg: '#f5f3ff', color: '#6d28d9' },
  'Owner Notice Address':    { bg: '#f8fafc', color: '#475569' },
  'Billing Contact':         { bg: '#eff6ff', color: '#0369a1' },
  'Site Contact':            { bg: '#f0fdf4', color: '#15803d' },
  'Operations Manager':      { bg: '#fff7ed', color: '#c2410c' },
  'Generator Contractor':    { bg: '#fefce8', color: '#a16207' },
  'Electric Billing':        { bg: '#fefce8', color: '#a16207' },
  'VZW HVAC':                { bg: '#fefce8', color: '#a16207' },
  'VZW Generators':          { bg: '#fefce8', color: '#a16207' },
}

function typeBadge(t: string) {
  return TYPE_COLORS[t] ?? { bg: '#f1f5f9', color: '#64748b' }
}

export default function ContactsPanel({ contacts }: { contacts: Contact[] }) {
  if (!contacts.length) return null

  const groups = contacts.reduce<Record<string, Contact[]>>((acc, c) => {
    const grp = c.contact_type.startsWith('Carrier') ? 'Carrier / Licensee'
      : c.contact_type.startsWith('Owner') ? 'Owner / Agency'
      : c.contact_type.startsWith('VZW') ? 'Infrastructure'
      : ['Electric Billing', 'Generator Contractor', 'Operations Manager', 'Site Contact'].includes(c.contact_type) ? 'Infrastructure'
      : 'Other'
    ;(acc[grp] ??= []).push(c)
    return acc
  }, {})

  return (
    <div style={{
      background: 'white', border: '1px solid #e2e8f0', borderRadius: '10px',
      padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid #f1f5f9' }}>
        <User size={16} color="#2563eb" />
        <span style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a' }}>
          Contacts ({contacts.length})
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {Object.entries(groups).map(([grpName, grpContacts]) => (
          <div key={grpName}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
              {grpName}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '8px' }}>
              {grpContacts.map(c => {
                const badge = typeBadge(c.contact_type)
                return (
                  <div key={c.id} style={{
                    background: '#fafafa', border: '1px solid #f1f5f9', borderRadius: '8px',
                    padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '6px',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                      <span style={{
                        fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '10px',
                        background: badge.bg, color: badge.color, whiteSpace: 'nowrap',
                      }}>
                        {c.contact_type}
                      </span>
                    </div>
                    {c.name && (
                      <div style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a' }}>{c.name}</div>
                    )}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      {c.phone && (
                        <a href={`tel:${c.phone}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: '#2563eb', textDecoration: 'none' }}>
                          <Phone size={11} /> {c.phone}
                        </a>
                      )}
                      {c.email && (
                        <a href={`mailto:${c.email}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: '#2563eb', textDecoration: 'none' }}>
                          <Mail size={11} /> {c.email}
                        </a>
                      )}
                    </div>
                    {c.notes && (
                      <div style={{ fontSize: '11px', color: '#94a3b8', borderTop: '1px solid #f1f5f9', paddingTop: '5px', marginTop: '2px' }}>
                        {c.notes}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
