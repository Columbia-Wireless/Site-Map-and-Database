import { NextRequest, NextResponse } from 'next/server'
import { getProfile, canEdit } from '@/lib/profile'
import { getActorInfo } from '@/lib/audit'
import { syncSam2Payload } from '@/lib/sam2Sync'
import type { Sam2SyncPayload } from '@/lib/sam2Types'

/**
 * Browser-session entry point: receives a SAM2_DOCUMENT_PARSED payload
 * relayed by the client from Sam2ImportModal's postMessage listener, and
 * syncs it via lib/sam2Sync.ts. Org/actor come from the logged-in user's
 * session, unlike app/api/sam2/webhook/route.ts (server-to-server, no
 * session) which calls the same shared sync function with an explicit
 * context instead.
 *
 * Payload shape CORRECTED 2026-08-18 (see lib/sam2Types.ts's module comment
 * for the full story) — siteIdentity/leaseTerms/documentMetadata/geocode all
 * live under payload.extractedData, not top-level, and the id fields are
 * payload.documentId/siteId/agreementId, not sam2DocId/sam2SiteId/
 * sam2AgreementId.
 */
export async function POST(req: NextRequest) {
  const profile = await getProfile()
  if (!profile || !canEdit(profile)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }
  if (!profile.organization_id) {
    return NextResponse.json({ error: 'No organization on profile' }, { status: 403 })
  }

  let payload: Sam2SyncPayload
  try {
    payload = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!payload.siteId || !payload.agreementId || !payload.documentId || !payload.extractedData?.siteIdentity) {
    return NextResponse.json({ error: 'siteId, agreementId, documentId, and extractedData.siteIdentity are required' }, { status: 400 })
  }

  const actor = await getActorInfo()

  try {
    const result = await syncSam2Payload(payload, {
      organizationId: profile.organization_id,
      actorName: actor.name,
      actorId: actor.userId,
    })
    return NextResponse.json(result)
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Sync failed' }, { status: 500 })
  }
}
