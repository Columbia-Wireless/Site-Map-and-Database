'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Download, Layers } from 'lucide-react'
import SiteTable, { TowerSiteRow } from './SiteTable'
import AddSiteDrawer from './AddSiteDrawer'
import Sam2ImportModal from '@/components/sam2/Sam2ImportModal'

interface OwnerOption { id: string; name: string }

type Confidence = 'high' | 'medium' | 'low'

export default function SitePortfolio({ initialSites, owners, showExport }: { initialSites: TowerSiteRow[]; owners: OwnerOption[]; showExport?: boolean }) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [sam2ModalOpen, setSam2ModalOpen] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [prefill, setPrefill] = useState<{ initialData: Record<string, string>; fieldConfidence: Record<string, Confidence>; sourceFilename: string } | undefined>(undefined)
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
            onClick={() => setSam2ModalOpen(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: '7px',
              background: 'white', color: '#7c3aed', border: '1px solid #ddd6fe',
              borderRadius: '8px', padding: '10px 18px',
              fontSize: '14px', fontWeight: 600, cursor: 'pointer',
            }}
          >
            <Layers size={16} />
            Batch Import (SAM 2.0)
          </button>
          <button
            onClick={() => { setPrefill(undefined); setDrawerOpen(true) }}
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

      {sam2ModalOpen && (
        <Sam2ImportModal
          onClose={() => setSam2ModalOpen(false)}
          onSynced={() => router.refresh()}
        />
      )}

      <AddSiteDrawer
        open={drawerOpen}
        onClose={() => { setDrawerOpen(false); setPrefill(undefined) }}
        onSaved={handleSaved}
        owners={owners}
        initialData={prefill?.initialData}
        fieldConfidence={prefill?.fieldConfidence}
        sourceFilename={prefill?.sourceFilename}
      />
    </div>
  )
}
