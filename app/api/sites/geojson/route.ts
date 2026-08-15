import { NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'
import { getProfile } from '@/lib/profile'
import { scopeFromProfile, scopeSitesQuery } from '@/lib/orgScope'

export async function GET() {
  const supabase = getSupabase()
  const scope = scopeFromProfile(await getProfile())
  const { data, error } = await scopeSitesQuery(
    supabase
      .from('tower_sites')
      .select('id, site_code, name, address, city, state, zip, lat, lng, tower_type, height_ft, status, county, organization_id'),
    scope,
  ).order('name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const features = (data ?? [])
    .filter((s: any) => s.lat != null && s.lng != null)
    .map((s: any) => ({
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
