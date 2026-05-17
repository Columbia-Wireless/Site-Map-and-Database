'use client'

import { useState } from 'react'
import Link from 'next/link'
import { FileText, FolderOpen, ExternalLink } from 'lucide-react'
import DocViewerModal from '@/components/sites/DocViewerModal'

const DOC_TYPE_LABEL: Record<string, string> = {
  lease:       'Lease Agreement',
  amendment:   'Amendment',
  addendum:    'Addendum',
  coi:         'COI',
  fcc_license: 'FCC License',
  structural:  'Structural',
  title:       'Title / Deed',
  survey:      'Survey',
  other:       'Other',
}

const DOC_TYPE_COLORS: Record<string, { bg: string; color: string }> = {
  lease:       { bg: '#eff6ff', color: '#1d4ed8' },
  amendment:   { bg: '#f0fdf4', color: '#15803d' },
  addendum:    { bg: '#f0fdf4', color: '#15803d' },
  coi:         { bg: '#fef9c3', color: '#854d0e' },
  fcc_license: { bg: '#faf5ff', color: '#6b21a8' },
  structural:  { bg: '#fff7ed', color: '#9a3412' },
  title:       { bg: '#f0fdf4', color: '#166534' },
  survey:      { bg: '#fef3c7', color: '#b45309' },
  other:       { bg: '#f1f5f9', color: '#475569' },
}

interface SiteInfo {
  id: string
  site_code: string
  name: string
  city: string
  state: string
}

interface SiteDoc {
  id: string
  name: string
  doc_type: string
  file_size_kb: number | null
  uploaded_at: string
  doc_status: string
  site_id: string
}

interface Props {
  sites: SiteInfo[]
  documents: SiteDoc[]
}

function fmtSize(kb: number | null) {
  if (!kb) return null
  return kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`
}

export default function LicenseeDocsPanel({ sites, documents }: Props) {
  const [viewer, setViewer] = useState<{ siteId: string; docId: string; name: string } | null>(null)

  const totalDocs = documents.length

  return (
    <>
      <div style={{ marginTop: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a', margin: 0 }}>
            Carrier Documents
          </h2>
          <span style={{ fontSize: '12px', fontWeight: 600, background: '#eff6ff', color: '#2563eb', padding: '2px 9px', borderRadius: '12px' }}>
            {totalDocs} document{totalDocs !== 1 ? 's' : ''}
          </span>
        </div>

        {sites.length === 0 ? (
          <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '40px', textAlign: 'center', color: '#94a3b8', fontSize: '14px' }}>
            No licensed sites found for this carrier.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {sites.map(site => {
              const siteDocs = documents.filter(d => d.site_id === site.id)
              return (
                <div key={site.id} style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                  {/* Site header */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 16px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <FolderOpen size={14} color="#64748b" />
                      <Link href={`/sites/${site.id}`} style={{ fontSize: '13px', fontWeight: 700, color: '#1a3a5c', textDecoration: 'none' }}>
                        {site.site_code}
                      </Link>
                      <span style={{ fontSize: '13px', color: '#64748b' }}>{site.city}, {site.state}</span>
                    </div>
                    <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                      {siteDocs.length} document{siteDocs.length !== 1 ? 's' : ''}
                    </span>
                  </div>

                  {siteDocs.length === 0 ? (
                    <div style={{ padding: '16px', fontSize: '13px', color: '#94a3b8', fontStyle: 'italic' }}>
                      No documents on file for this site.
                    </div>
                  ) : (
                    siteDocs.map((doc, idx) => {
                      const typeStyle = DOC_TYPE_COLORS[doc.doc_type] ?? DOC_TYPE_COLORS.other
                      const size = fmtSize(doc.file_size_kb)
                      return (
                        <div
                          key={doc.id}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '12px',
                            padding: '11px 16px',
                            borderBottom: idx < siteDocs.length - 1 ? '1px solid #f1f5f9' : 'none',
                            background: idx % 2 === 0 ? 'white' : '#fafafa',
                          }}
                        >
                          <FileText size={15} color="#2563eb" style={{ flexShrink: 0 }} />

                          {/* Type badge */}
                          <span style={{
                            fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '10px',
                            background: typeStyle.bg, color: typeStyle.color, whiteSpace: 'nowrap', flexShrink: 0,
                          }}>
                            {DOC_TYPE_LABEL[doc.doc_type] ?? doc.doc_type}
                          </span>

                          {/* Name + meta */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '13px', fontWeight: 500, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {doc.name}
                            </div>
                            <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '1px', display: 'flex', gap: '8px' }}>
                              <span>{new Date(doc.uploaded_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                              {size && <><span>·</span><span>{size}</span></>}
                            </div>
                          </div>

                          {/* View button */}
                          <button
                            onClick={() => setViewer({ siteId: site.id, docId: doc.id, name: doc.name })}
                            style={{
                              display: 'flex', alignItems: 'center', gap: '5px',
                              padding: '5px 12px', borderRadius: '6px',
                              background: '#eff6ff', color: '#2563eb',
                              border: '1px solid #bfdbfe', fontSize: '12px', fontWeight: 600,
                              cursor: 'pointer', flexShrink: 0,
                            }}
                          >
                            <ExternalLink size={11} /> View
                          </button>
                        </div>
                      )
                    })
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {viewer && (
        <DocViewerModal
          siteId={viewer.siteId}
          docId={viewer.docId}
          docName={viewer.name}
          onClose={() => setViewer(null)}
        />
      )}
    </>
  )
}
