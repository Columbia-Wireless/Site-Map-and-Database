import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'

const BASE_URL = process.env.SITE_URL || 'https://tower-demo-461686768358.us-east1.run.app'
const OGC_BASE = `${BASE_URL}/api/ogc`

const HEADERS = {
  'Content-Type': 'application/geo+json',
  'Access-Control-Allow-Origin': '*',
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ featureId: string }> }
) {
  const { featureId } = await params
  const supabase = getSupabase()

  const { data: s, error } = await supabase
    .from('tower_sites')
    .select('id, site_code, name, address, city, state, zip, county, lat, lng, tower_type, height_ft, status, tenant_slots')
    .eq('id', featureId)
    .single()

  if (error || !s) return NextResponse.json({ error: 'Feature not found' }, { status: 404 })
  if (s.lat == null || s.lng == null) return NextResponse.json({ error: 'Feature has no geometry' }, { status: 404 })

  return NextResponse.json({
    type: 'Feature',
    id: s.id,
    geometry: { type: 'Point', coordinates: [s.lng, s.lat] },
    properties: {
      id:           s.id,
      site_code:    s.site_code,
      name:         s.name,
      address:      s.address,
      city:         s.city,
      state:        s.state,
      zip:          s.zip,
      county:       s.county,
      tower_type:   s.tower_type,
      height_ft:    s.height_ft,
      status:       s.status,
      tenant_slots: s.tenant_slots,
    },
    links: [
      { href: `${OGC_BASE}/collections/sites/items/${s.id}`, rel: 'self',       type: 'application/geo+json', title: 'This feature' },
      { href: `${OGC_BASE}/collections/sites`,               rel: 'collection',  type: 'application/json',     title: 'Sites collection' },
    ],
  }, { headers: HEADERS })
}
