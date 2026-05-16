'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Download } from 'lucide-react'
import SiteTable, { TowerSiteRow } from './SiteTable'
import AddSiteDrawer from './AddSiteDrawer'

interface OwnerOption { id: string; name: string }

export default function SitePortfolio({ initialSites, owners, showExport }: { initialSites: TowerSiteRow[]; owners: OwnerOption[]; showExport?: boolean }) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [exporting, setExporting] = useState(false)
  const router = useRouter()

  async function handleExport() {
    setExporting(true)
    const res = await fetch('/api/export/sites')
    if (res.ok) {
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `scetv-towers-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
    }
    setExporting(false)
  }

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
        <div style={{ display: 'flex', gap: '10px' }}>
          {showExport && (
            <button
              onClick={handleExport}
              disabled={exporting}
              style={{
                display: 'flex', alignItems: 'center', gap: '7px',
                background: 'white', color: '#16a34a', border: '1px solid #86efac',
                borderRadius: '8px', padding: '10px 18px',
                fontSize: '14px', fontWeight: 600, cursor: 'pointer',
                opacity: exporting ? 0.6 : 1,
              }}
            >
              <Download size={16} />
              {exporting ? 'Exporting…' : 'Export CSV'}
            </button>
          )}
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
      </div>

      <SiteTable sites={initialSites} />

      <AddSiteDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onSaved={handleSaved}
        owners={owners}
      />
    </div>
  )
}
