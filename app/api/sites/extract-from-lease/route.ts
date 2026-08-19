import { NextResponse } from 'next/server'

/**
 * Retired 2026-08-19, same reasoning as the per-document "Extract Terms"
 * route (api/sites/[id]/documents/[docId]/extract): this created a new site
 * by extracting site identity + lease terms from an uploaded document via
 * Anthropic directly, which is exactly what SAM 2.0's batch import already
 * does end to end (extraction + site creation), on an account that ran out
 * of credit. The "Create from Lease Document" button that called this
 * (components/sites/SitePortfolio.tsx) and its modal
 * (components/sites/AddSiteFromLeaseModal.tsx) have been removed too.
 *
 * Not retired: app/api/sites/[id]/comparables/extract — that one extracts
 * market comparable data from third-party documents (competitor sites,
 * appraisals) that were never Columbia Wireless's own leases, SAM 2.0 has
 * no equivalent for that, it's out of scope for it entirely.
 */
export async function POST() {
  return NextResponse.json(
    { error: 'Legacy Anthropic extraction has been retired. Use SAM 2.0 Batch Import to add sites from a lease.' },
    { status: 410 }
  )
}
