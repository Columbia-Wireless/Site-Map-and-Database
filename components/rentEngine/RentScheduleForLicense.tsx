'use client'

import { useEffect, useState } from 'react'
import { Loader2, AlertCircle } from 'lucide-react'
import RentScheduleTable, { RentScheduleRow, OneTimeChargeRow } from './RentScheduleTable'
import { RentScheduleIssue } from './RentScheduleIssues'

interface ScheduleResponse {
  licenseId: string
  documentCount: number
  linkedDocumentCount: number
  rows: RentScheduleRow[]
  oneTimeCharges: OneTimeChargeRow[]
  issues: RentScheduleIssue[]
}

interface Props {
  licenseId: string
  siteId: string
  showSite?: boolean
  showTenant?: boolean
}

/**
 * Fetches and renders the real rent schedule for one agreement (site_licenses.id)
 * via GET /api/rent-schedule/[licenseId]. This is the piece to drop into a
 * site/carrier/owner detail page's Rent Schedule tab — see #51/#52/#53.
 * For an entity with more than one relevant license, render one of these per
 * license rather than trying to merge them into a single fetch.
 */
export default function RentScheduleForLicense({ licenseId, siteId, showSite, showTenant }: Props) {
  const [data, setData] = useState<ScheduleResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    fetch(`/api/rent-schedule/${licenseId}`)
      .then(async res => {
        const body = await res.json()
        if (!res.ok) throw new Error(body.error ?? 'Failed to load rent schedule')
        return body as ScheduleResponse
      })
      .then(body => { if (!cancelled) setData(body) })
      .catch(err => { if (!cancelled) setError(err.message ?? 'Failed to load rent schedule') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [licenseId])

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '24px', color: '#94a3b8', fontSize: '13px' }}>
        <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Calculating rent schedule…
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', color: '#b91c1c', fontSize: '13px' }}>
        <AlertCircle size={14} /> {error}
      </div>
    )
  }

  if (!data) return null

  // The engine returns a completely empty result (no rows, no issues) when
  // it had zero usable documents — that's indistinguishable from a real bug
  // unless we also know whether anything is linked at all. See
  // countLinkedDocuments()'s doc comment in lib/rentEngine/adapter.ts.
  const noUsableDocs = data.rows.length === 0 && data.oneTimeCharges.length === 0 && data.issues.length === 0
  if (noUsableDocs) {
    if (data.linkedDocumentCount === 0) {
      return (
        <div style={{ padding: '16px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', color: '#64748b', fontSize: '13px' }}>
          No documents are linked to this license yet.
        </div>
      )
    }
    return (
      <div style={{ padding: '16px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '10px', color: '#92400e', fontSize: '13px' }}>
        {data.linkedDocumentCount} document{data.linkedDocumentCount !== 1 ? 's are' : ' is'} linked to this license, but none came through the SAM 2.0 sync — the rent engine currently only reads SAM 2.0-synced documents. This is expected for documents uploaded before that integration went live.
      </div>
    )
  }

  return (
    <RentScheduleTable
      rows={data.rows}
      oneTimeCharges={data.oneTimeCharges}
      issues={data.issues}
      siteId={siteId}
      showSite={showSite}
      showTenant={showTenant}
    />
  )
}
