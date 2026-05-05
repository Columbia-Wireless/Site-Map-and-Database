'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import SiteTable from './SiteTable'
import AddSiteDrawer from './AddSiteDrawer'
import { TowerSite } from '@/lib/types'

export default function SitePortfolio({ initialSites }: { initialSites: TowerSite[] }) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const router = useRouter()

  const handleSaved = useCallback(() => {
    router.refresh()
  }, [router])

  return (
    <div style={{ padding: '32px', maxWidth: '1400px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#0f172a', margin: 0 }}>
            Site Portfolio
          </h1>
          <p style={{ color: '#64748b', marginTop: '4px', fontSize: '14px' }}>
            {initialSites.length} licensed sites under management
          </p>
        </div>
        <button
          onClick={() => setDrawerOpen(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: '7px',
            background: '#1a3a5c', color: 'white', border: 'none',
            borderRadius: '8px', padding: '10px 18px',
            fontSize: '14px', fontWeight: 600, cursor: 'pointer',
          }}
        >
          <Plus size={16} />
          Add New Site
        </button>
      </div>

      <SiteTable sites={initialSites} />

      <AddSiteDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onSaved={handleSaved}
      />
    </div>
  )
}
