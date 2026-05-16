'use client'

import SiteDocuments from './SiteDocuments'

interface Doc {
  id: string
  name: string
  doc_type: string
  doc_status: string
  uploaded_by: string
  uploaded_at: string
  file_size_kb: number
  file_hash?: string
  iota_block_id?: string
  iota_explorer_url?: string
  parent_document_id?: string
  extracted_terms?: Record<string, any>
  [key: string]: any
}

interface Props {
  siteId: string
  initialDocs: Doc[]
  canEdit?: boolean
}

export default function SiteDocsAndTerms({ siteId, initialDocs, canEdit = false }: Props) {
  return (
    <SiteDocuments
      siteId={siteId}
      initialDocs={initialDocs}
      canEdit={canEdit}
    />
  )
}
