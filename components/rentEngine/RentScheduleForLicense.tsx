'use client'

import { useEffect, useState } from 'react'
import { Loader2, AlertCircle } from 'lucide-react'
import RentScheduleTable, { RentScheduleRow, OneTimeChargeRow } from './RentScheduleTable'
import { RentScheduleIssue } from './RentScheduleIssues'

interface ScheduleResponse {
  licenseId: string
  documentCount: number
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
