import { NextResponse } from 'next/server'

/**
 * Retired 2026-08-19. This was the legacy in-house extraction pathway —
 * running a second, redundant Anthropic-based pipeline alongside SAM 2.0
 * (which now does extraction for the whole platform), billed on a separate
 * Anthropic account that ran out of credit. The "Extract Terms" button that
 * called this (components/sites/DocDetailModal.tsx) has been removed too,
 * not just hidden here.
 *
 * The original implementation (Anthropic PDF/image extraction, address
 * cross-check, doc_status computation) is preserved in git history as of
 * this commit if it's ever needed again — deleted here rather than left in
 * as unreachable dead code, since it was also carrying a handful of latent
 * strict-null-check errors under the currently installed @anthropic-ai/sdk
 * types (a ContentBlock/ThinkingBlock narrowing issue, mainly) that aren't
 * worth fixing in code nothing will ever call again.
 */
export async function POST() {
  return NextResponse.json(
    { error: 'Legacy Anthropic extraction has been retired. Route this document through SAM 2.0 instead.' },
    { status: 410 }
  )
}
