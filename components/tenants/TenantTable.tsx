'use client'

import { useRouter } from 'next/navigation'
import { Building2 } from 'lucide-react'
import { Tenant } from '@/lib/types'

interface TenantWithTenancies extends Tenant {
  site_licenses: { id: string; annual_rent: number; status: string }[]
}

const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)

export default function TenantTable({ tenants }: { tenants: TenantWithTenancies[] }) {
  const router = useRouter()

  return (
    <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
            {['Licensee', 'HQ Location', 'Account Manager', 'Active Licenses', 'Annual Revenue', 'Status'].map(h => (
              <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {tenants.map((t, i) => {
            const tenancies = t.site_licenses ?? []
            const activeTenancies = tenancies.filter(s => ['active', 'pending', 'expiring_soon'].includes(s.status))
            const totalRevenue = tenancies.reduce((sum, s) => sum + Number(s.annual_rent), 0)

            return (
              <tr
                key={t.id}
                onClick={() => router.push(`/tenants/${t.id}`)}
                style={{ background: i % 2 === 0 ? 'white' : '#fafafa', borderBottom: '1px solid #f1f5f9', cursor: 'pointer', transition: 'background 0.1s' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#eff6ff')}
                onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? 'white' : '#fafafa')}
              >
                <td style={{ padding: '13px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ background: '#eff6ff', borderRadius: '7px', padding: '7px', flexShrink: 0 }}>
                      <Building2 size={15} color="#2563eb" />
                    </div>
                    <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '14px' }}>{t.name}</div>
                  </div>
                </td>
                <td style={{ padding: '13px 16px', fontSize: '13px', color: '#64748b' }}>
                  {t.hq_city && t.hq_state ? `${t.hq_city}, ${t.hq_state}` : '—'}
                </td>
                <td style={{ padding: '13px 16px', fontSize: '13px', color: '#334155' }}>
                  {t.account_manager_name || '—'}
                </td>
                <td style={{ padding: '13px 16px', fontSize: '13px' }}>
                  <span style={{ fontWeight: 600, color: '#0f172a' }}>{activeTenancies.length}</span>
                  <span style={{ color: '#94a3b8', fontSize: '12px' }}> / {tenancies.length} licenses</span>
                </td>
                <td style={{ padding: '13px 16px', fontSize: '13px', fontWeight: 600, color: '#0f172a' }}>
                  {totalRevenue > 0 ? fmt(totalRevenue) : '—'}
                </td>
                <td style={{ padding: '13px 16px' }}>
                  <span style={{
                    fontSize: '11px', fontWeight: 600, padding: '3px 8px', borderRadius: '12px',
                    background: t.status === 'active' ? '#dcfce7' : '#f1f5f9',
                    color: t.status === 'active' ? '#15803d' : '#475569',
                  }}>
                    {t.status === 'active' ? 'Active' : 'Inactive'}
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
