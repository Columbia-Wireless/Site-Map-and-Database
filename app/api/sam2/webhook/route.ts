import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'
import { syncSam2Payload } from '@/lib/sam2Sync'
import type { Sam2SyncPayload } from '@/lib/sam2Types'

/**
 * Server-to-server webhook receiver — the real replacement for the iframe's
 * postMessage relay, per the intake redesign agreed with Onno 2026-08-15/17
 * and the contract he confirmed live 2026-08-21 ("Intake redesign: closing
 * the open items" thread). No browser session here — SAM 2.0 calls this
 * directly once a document finishes parse -> classify -> extract -> file.
 *
 * Auth: X-Sam2-Webhook-Secret header, checked against SAM2_WEBHOOK_SECRET.
 * Not set yet as of this writing — Onno is waiting on us to confirm we're
 * ready before he generates it (see reply sent 2026-08-22). Returns 503
 * until it's configured, same no-op-safely pattern as lib/sam2Corrections.ts.
 *
 * Failure-payload shape is NOT yet confirmed — Onno's email describes "a new
 * failure payload for anything that can't be filed, with a retryable flag"
 * but didn't include exact field names, and his contract doc
 * (docs/intake-webhook-contract.md in the SAM 2.0 repo) isn't fetchable from
 * here. Detected below by the absence of extractedData.siteIdentity rather
 * than a confirmed discriminator field — flagged to Onno to verify, don't
 * trust this shape without his confirmation.
 */

async function resolveDefaultOrganizationId(supabase: ReturnType<typeof getSupabase>): Promise<string | null> {
  // Single-tenant today (Onno's own Aug 15 note: "there is exactly one
  // company using the system today, Columbia Wireless"). Revisit once
  // multi-tenant matters — the webhook payload has no org identifier to
  // route on yet (same gap flagged in docs/SAM2_INTEGRATION.md's known gaps).
  const { data, error } = await supabase
    .from('organizations')
    .select('id')
    .eq('is_platform_admin', false)
    .limit(2)
  if (error || !data || data.length !== 1) return null
  return data[0].id
}

async function logWebhookFailure(supabase: ReturnType<typeof getSupabase>, organizationId: string | null, payload: any) {
  try {
    await supabase.from('sam2_import_log').insert([{
      organization_id: organizationId,
      file_name: payload?.fileName ?? 'unknown',
      site_id: null,
      document_id: null,
      outcome: 'error',
      warnings: [],
      error_message: `Webhook delivered a failure notification (unconfirmed shape): ${JSON.stringify(payload).slice(0, 2000)}`,
      actor_name: 'SAM 2.0 (webhook)',
      actor_id: null,
    }])
  } catch (err) {
    console.error('[sam2/webhook] failed to log failure notification:', err)
  }
}

export async function POST(req: NextRequest) {
  const secret = process.env.SAM2_WEBHOOK_SECRET
  if (!secret) {
    console.warn('[sam2/webhook] SAM2_WEBHOOK_SECRET not set — rejecting call. Configure once Onno shares the secret.')
    return NextResponse.json({ error: 'Webhook not configured yet' }, { status: 503 })
  }

  const provided = req.headers.get('x-sam2-webhook-secret')
  if (provided !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let payload: any
  try {
    payload = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const supabase = getSupabase()
  const organizationId = await resolveDefaultOrganizationId(supabase)

  // Unconfirmed failure-payload shape — see module comment. Ack receipt
  // (200) rather than triggering Onno's retry loop for a case we already
  // understand isn't a delivery problem on our end.
  if (!payload?.extractedData?.siteIdentity) {
    await logWebhookFailure(supabase, organizationId, payload)
    return NextResponse.json({ ok: true, note: 'Recorded as a failed/unparseable delivery — shape not yet confirmed with Onno' })
  }

  if (!organizationId) {
    return NextResponse.json({ error: 'Could not resolve a single organization to receive this document — see resolveDefaultOrganizationId' }, { status: 500 })
  }

  const typedPayload = payload as Sam2SyncPayload
  if (!typedPayload.siteId || !typedPayload.agreementId || !typedPayload.documentId) {
    return NextResponse.json({ error: 'siteId, agreementId, and documentId are required' }, { status: 400 })
  }

  try {
    const result = await syncSam2Payload(typedPayload, {
      organizationId,
      actorName: 'SAM 2.0 (webhook)',
      actorId: null,
    })
    return NextResponse.json({ ok: true, result })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Sync failed' }, { status: 500 })
  }
}
