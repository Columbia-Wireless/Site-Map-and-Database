import { NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'

export async function GET() {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('tower_sites')
    .select('id, site_code, name, address, city, state, zip, lat, lng, tower_type, height_ft, status, county')
    .order('name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const features = (data ?? [])
    .filter(s => s.lat != null && s.lng != null)
    .map(s => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [s.lng, s.lat] },
      properties: {
        id: s.id,
        site_code: s.site_code,
        name: s.name,
        address: s.address,
        city: s.city,
        state: s.state,
        zip: s.zip,
        county: s.county,
        tower_type: s.tower_type,
        height_ft: s.height_ft,
        status: s.status,
      },
    }))

  return NextResponse.json(
    { type: 'FeatureCollection', features, totalFeatures: features.length },
    { headers: { 'Content-Type': 'application/geo+json', 'Access-Control-Allow-Origin': '*' } },
  )
}
