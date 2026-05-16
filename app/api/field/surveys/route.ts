import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCallerName } from '@/lib/logDocEvent'

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://vfntpdpneusqgcwxwkix.supabase.co'
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  return createClient(url, key)
}

// GET /api/field/surveys?site_id=...
export async function GET(req: NextRequest) {
  const siteId = req.nextUrl.searchParams.get('site_id')
  if (!siteId) return NextResponse.json({ error: 'site_id required' }, { status: 400 })

  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('site_surveys')
    .select('*')
    .eq('site_id', siteId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data ?? [])
}

// POST /api/field/surveys — create or update in-progress survey
export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabaseAdmin()
    const userName = await getCallerName(req)
    const body = await req.json()

    const {
      survey_id,
      site_id,
      user_id,
      status,
      gps_lat,
      gps_lng,
      gps_accuracy_meters,
      gps_delta_meters,
      gps_matched,
      tower_data,
      security_data,
      infrastructure_data,
      generator_data,
      maintenance_data,
      notes,
    } = body

    if (!site_id || !user_id) {
      return NextResponse.json({ error: 'site_id and user_id required' }, { status: 400 })
    }

    const payload: Record<string, any> = {
      site_id,
      surveyor_id: user_id,
      surveyor_name: userName,
      status: status ?? 'in_progress',
      gps_lat: gps_lat ?? null,
      gps_lng: gps_lng ?? null,
      gps_accuracy_meters: gps_accuracy_meters ?? null,
      gps_delta_meters: gps_delta_meters ?? null,
      gps_matched: gps_matched ?? null,
      tower_data: tower_data ?? {},
      security_data: security_data ?? {},
      infrastructure_data: infrastructure_data ?? {},
      generator_data: generator_data ?? {},
      maintenance_data: maintenance_data ?? {},
      notes: notes ?? null,
    }

    if (status === 'completed') {
      payload.completed_at = new Date().toISOString()
    }

    let result
    if (survey_id) {
      // Update existing
      const { data, error } = await supabase
        .from('site_surveys')
        .update(payload)
        .eq('id', survey_id)
        .select()
        .single()
      if (error) throw new Error(error.message)
      result = data
    } else {
      // Create new
      const { data, error } = await supabase
        .from('site_surveys')
        .insert(payload)
        .select()
        .single()
      if (error) throw new Error(error.message)
      result = data
    }

    return NextResponse.json(result)
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Survey save failed' }, { status: 500 })
  }
}
