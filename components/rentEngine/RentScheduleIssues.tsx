'use client'

import { useState } from 'react'
import { AlertCircle, Info, FileText } from 'lucide-react'
import Link from 'next/link'

export interface RentScheduleIssue {
  code: string
  severity: 'error' | 'info'
  message: string
}

interface Props {
  issues: RentScheduleIssue[]
  siteId: string
  /** True when the engine returned zero rows — issues alone don't tell you this. */
  hasNoRows: boolean
}

/**
 * Surfaces the rent engine's gap-flagging output (RentScheduleResult.issues)
 * in the CWF UI, per the "gaps get flagged, corrections happen in our UI"
 * decision.
 *
 * IMPORTANT LIMITATION, by design of the upstream data: ScheduleIssue only
 * carries { code, severity, message } — no docId. The engine's internal
 * ChainObservation does track which document(s) a problem traces to, but
 * that detail isn't surfaced through generateRentSchedule()'s public return
 * type. So this component can say *what* is missing in plain language, but
 * can't deep-link to the exact field on the exact document — it links back
 * to the site's document list instead, for a person to find and fix using
 * the existing Review & Edit Terms flow (TermsReviewModal.tsx). Precise
 * per-field linking needs the same upstream fix already flagged to Onno:
 * SAM 2.0 sending classification/lineage/delta per document.
 */
export default function RentScheduleIssues({ issues, siteId, hasNoRows }: Props) {
  const [showInfo, setShowInfo] = useState(false)
  const errors = issues.filter(i => i.severity === 'error')
  const infos = issues.filter(i => i.severity === 'info')

  if (issues.length === 0) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {errors.length > 0 && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', padding: '16px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
            <AlertCircle size={16} color="#b91c1c" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#991b1b', marginBottom: '4px' }}>
                {hasNoRows
                  ? "Rent schedule couldn't be calculated"
                  : `${errors.length} issue${errors.length !== 1 ? 's' : ''} blocking part of the schedule`}
              </div>
              <div style={{ fontSize: '12px', color: '#7f1d1d', marginBottom: '10px' }}>
                Something the calculation genuinely needs is missing from the documents on file. Nothing was guessed to fill the gap.
              </div>
              <ul style={{ margin: 0, padding: '0 0 0 18px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {errors.map((issue, i) => (
                  <li key={i} style={{ fontSize: '13px', color: '#0f172a', lineHeight: 1.5 }}>
                    {issue.message}
                  </li>
                ))}
              </ul>
              <Link
                href={`/sites/${siteId}`}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginTop: '12px', fontSize: '12px', fontWeight: 600, color: '#b91c1c', textDecoration: 'none' }}
              >
                <FileText size={13} /> Review documents for this site to fix
              </Link>
            </div>
          </div>
        </div>
      )}

      {infos.length > 0 && (
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px 16px' }}>
          <button
            onClick={() => setShowInfo(v => !v)}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'none', border: 'none', cursor: 'pointer', padding: 0, width: '100%', textAlign: 'left' }}
          >
            <Info size={14} color="#64748b" />
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>
              {infos.length} note{infos.length !== 1 ? 's' : ''} on how this schedule was calculated
            </span>
            <span style={{ marginLeft: 'auto', fontSize: '11px', color: '#94a3b8' }}>{showInfo ? 'Hide' : 'Show'}</span>
          </button>
          {showInfo && (
            <ul style={{ margin: '10px 0 0', padding: '0 0 0 18px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {infos.map((issue, i) => (
                <li key={i} style={{ fontSize: '12px', color: '#64748b', lineHeight: 1.5 }}>
                  {issue.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
