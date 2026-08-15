import { NextRequest, NextResponse } from 'next/server'
import { reportError } from '@/lib/errorReporting'

/**
 * Receives client-side error reports from the app/error.tsx and
 * app/global-error.tsx boundaries and forwards them to Cloud Error
 * Reporting (browser JS can't write to the container's stderr directly).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    reportError(new Error(body?.message ?? 'Unknown client error'), {
      stack: body?.stack,
      url: body?.url,
      digest: body?.digest,
      userAgent: request.headers.get('user-agent') ?? undefined,
    })
  } catch {
    // Best-effort — never fail the client on a logging error.
  }
  return NextResponse.json({ ok: true })
}
