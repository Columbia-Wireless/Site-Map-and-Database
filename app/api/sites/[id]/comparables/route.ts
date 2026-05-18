import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://vfntpdpneusqgcwxwkix.supabase.co'
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZmbnRwZHBuZXVzcWdjd3h3a2l4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5NTg2MzEsImV4cCI6MjA5MzUzNDYzMX0.kFZ6b2WKAl7GVsEQZeO33qcxhyBruQlTfW0eZfkcg1c'

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3958.8
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.asin(Math.sqrt(a))
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const radius = Math.min(250, Math.max(1, parseInt(request.nextUrl.searchParams.get('radius') ?? '50')))

  const supabase = getSupabase()

  // Fetch focal site
  const { data: focal, error: fErr } = await supabase
    .from('tower_sites')
    .select('id, lat, lng, tower_type')
    .eq('id', id)
    .single()

  if (fErr || !focal) return NextResponse.json({ error: 'Site not found' }, { status: 404 })
  if (focal.lat == null || focal.lng == null) {
    return NextResponse.json({ comparables: [], message: 'Focal site has no coordinates' })
  }

  // Fetch all other sites with license aggregates
  const { data: sites, error: sErr } = await supabase
    .from('tower_sites')
    .select('id, site_code, name, city, state, tower_type, height_ft, lat, lng, tenant_slots, site_licenses(id, annual_rent, status)')
    .neq('id', id)
    .not('lat', 'is', null)
    .not('lng', 'is', null)

  if (sErr || !sites) return NextResponse.json({ error: 'Failed to fetch sites' }, { status: 500 })

  const comparables = sites
    .map(site => {
      const distance = haversine(focal.lat!, focal.lng!, site.lat!, site.lng!)
      const licenses = (site.site_licenses as any[]) ?? []
      const activeLicenses = licenses.filter(l => ['active', 'pending', 'expiring_soon'].includes(l.status))
      const annualRevenue = licenses.reduce((sum: number, l: any) => sum + Number(l.annual_rent ?? 0), 0)
      const slots = site.tenant_slots ?? null
      const occupancyPct = slots ? Math.round((activeLicenses.length / slots) * 100) : null
      return {
        id: site.id,
        site_code: site.site_code,
        name: site.name,
        city: site.city,
        state: site.state,
        tower_type: site.tower_type,
        height_ft: site.height_ft,
        distance_miles: Math.round(distance * 10) / 10,
        active_tenants: activeLicenses.length,
        tenant_slots: slots,
        occupancy_pct: occupancyPct,
        annual_revenue: annualRevenue,
        same_type: site.tower_type === focal.tower_type,
      }
    })
    .filter(s => s.distance_miles <= radius)
    .sort((a, b) => a.distance_miles - b.distance_miles)
    .slice(0, 50)

  return NextResponse.json({ comparables, focal_type: focal.tower_type })
}
