import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'
import { getProfile } from '@/lib/profile'
import { assertSiteVisible } from '@/lib/orgScope'
import { loadRentScheduleInputs } from '@/lib/rentEngine/adapter'
import { generateRentSchedule } from '@/lib/rentEngine/services/timelineEngine'

/**
 * GET /api/rent-schedule/[licenseId] — computes the real rent schedule for
 * one agreement (site_licenses.id), using the ported SAM 2.0 engine
 * (lib/rentEngine/) against the full document chain, not the flat cached
 * fields on site_licenses.
 *
 * Write-through: every call recomputes fresh (pure function, no external
 * calls, cheap) and updates site_licenses.schedule_cache/schedule_computed_at
 * so other pages can read a summary without recomputing.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ licenseId: string }> }
) {
  const profile = await getProfile()
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { licenseId } = await params
  const supabase = getSupabase()

  const { data: license } = await supabase
    .from('site_licenses')
    .select('site_id')
    .eq('id', licenseId)
    .maybeSingle()
  if (!license) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!(await assertSiteVisible(license.site_id))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const inputs = await loadRentScheduleInputs(licenseId)
  if (!inputs) {
    return NextResponse.json({ error: 'Could not resolve site/agreement for this license' }, { status: 404 })
  }

  const result = generateRentSchedule(inputs.site, inputs.agreement, inputs.documents)

  const { error: cacheError } = await supabase
    .from('site_licenses')
    .update({ schedule_cache: result, schedule_computed_at: new Date().toISOString() })
    .eq('id', licenseId)
  if (cacheError) {
    console.error('[rent-schedule] cache write failed:', cacheError.message)
  }

  return NextResponse.json({
    licenseId,
    documentCount: inputs.documents.length,
    ...result,
  })
}
