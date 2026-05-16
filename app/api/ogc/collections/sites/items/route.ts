import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'

const BASE_URL = process.env.SITE_URL || 'https://tower-demo-461686768358.us-east1.run.app'
const OGC_BASE = `${BASE_URL}/api/ogc`

const HEADERS = {
  'Content-Type': 'application/geo+json',
  'Access-Control-Allow-Origin': '*',
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl

  // OGC API Features pagination params
  const limit  = Math.min(parseInt(searchParams.get('limit')  ?? '1000'), 1000)
  const offset = parseInt(searchParams.get('offset') ?? '0')

  // OGC API Features bbox param: minLng,minLat,maxLng,maxLat
  const bboxParam = searchParams.get('bbox')
  let bboxFilter: [number, number, number, number] | null = null
  if (bboxParam) {
    const parts = bboxParam.split(',').map(Number)
    if (parts.length === 4 && parts.every(n => !isNaN(n))) {
      bboxFilter = parts as [number, number, number, number]
    }
  }

  // Optional property filters
  const statusFilter    = searchParams.get('status')
  const towerTypeFilter = searchParams.get('tower_type')

  const supabase = getSupabase()
  let query = supabase
    .from('tower_sites')
    .select('id, site_code, name, address, city, state, zip, county, lat, lng, tower_type, height_ft, status, tenant_slots', { count: 'exact' })
    .not('lat', 'is', null)
    .not('lng', 'is', null)
    .order('name')
    .range(offset, offset + limit - 1)

  if (statusFilter)    query = query.eq('status', statusFilter)
  if (towerTypeFilter) query = query.eq('tower_type', towerTypeFilter)

  const { data, error, count } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  let sites = data ?? []

  // Apply bbox filter in-process (Supabase free tier has no PostGIS)
  if (bboxFilter) {
    const [minLng, minLat, maxLng, maxLat] = bboxFilter
    sites = sites.filter(s =>
      s.lng >= minLng && s.lng <= maxLng &&
      s.lat >= minLat && s.lat <= maxLat
    )
  }

  const features = sites.map(s => ({
    type: 'Feature' as const,
    id: s.id,
    geometry: { type: 'Point' as const, coordinates: [s.lng, s.lat] },
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
  }))

  const totalCount = count ?? features.length
  const nextOffset = offset + limit

  const links = [
    { href: `${OGC_BASE}/collections/sites/items?limit=${limit}&offset=${offset}`, rel: 'self',       type: 'application/geo+json', title: 'This page' },
    { href: `${OGC_BASE}/collections/sites`,                                        rel: 'collection',  type: 'application/json',     title: 'Sites collection' },
  ]
  if (nextOffset < totalCount) {
    links.push({ href: `${OGC_BASE}/collections/sites/items?limit=${limit}&offset=${nextOffset}`, rel: 'next', type: 'application/geo+json', title: 'Next page' })
  }
  if (offset > 0) {
    const prevOffset = Math.max(0, offset - limit)
    links.push({ href: `${OGC_BASE}/collections/sites/items?limit=${limit}&offset=${prevOffset}`, rel: 'prev', type: 'application/geo+json', title: 'Previous page' })
  }

  return NextResponse.json({
    type: 'FeatureCollection',
    features,
    numberMatched:  totalCount,
    numberReturned: features.length,
    links,
  }, { headers: HEADERS })
}
