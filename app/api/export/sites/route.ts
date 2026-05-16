import { NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'
import { getProfile, canExport } from '@/lib/profile'

export async function GET() {
  const profile = await getProfile()
  if (!canExport(profile)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const supabase = getSupabase()
  const { data: sites, error } = await supabase
    .from('tower_sites')
    .select('site_code, name, address, city, state, zip, county, tower_type, height_ft, status, lat, lng, tenant_slots, notes')
    .order('name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: licenses } = await supabase
    .from('site_licenses')
    .select('site_id, annual_rent, escalation_rate, status, license_start, license_end, licensees(name)')
    .order('site_id')

  const rentBySite: Record<string, { licensees: string[]; totalRent: number }> = {}
  for (const lic of licenses ?? []) {
    if (!rentBySite[lic.site_id]) rentBySite[lic.site_id] = { licensees: [], totalRent: 0 }
    const licName = (lic as any).licensees?.name
    if (licName && ['active', 'expiring_soon'].includes(lic.status)) {
      rentBySite[lic.site_id].licensees.push(licName)
      rentBySite[lic.site_id].totalRent += Number(lic.annual_rent)
    }
  }

  const { data: siteIds } = await supabase.from('tower_sites').select('id, site_code')
  const idByCode: Record<string, string> = {}
  for (const s of siteIds ?? []) idByCode[s.site_code] = s.id

  const headers = [
    'Site Code', 'Name', 'Address', 'City', 'State', 'ZIP', 'County',
    'Tower Type', 'Height (ft)', 'Status', 'Latitude', 'Longitude',
    'Tenant Slots', 'Active Licensees', 'Annual Revenue ($)', 'Notes',
  ]

  const rows = (sites ?? []).map(s => {
    const siteId = idByCode[s.site_code]
    const rentData = siteId ? rentBySite[siteId] : null
    return [
      s.site_code ?? '',
      s.name ?? '',
      s.address ?? '',
      s.city ?? '',
      s.state ?? '',
      s.zip ?? '',
      s.county ?? '',
      s.tower_type ?? '',
      s.height_ft ?? '',
      s.status ?? '',
      s.lat ?? '',
      s.lng ?? '',
      s.tenant_slots ?? '',
      rentData ? rentData.licensees.join('; ') : '',
      rentData ? rentData.totalRent : '',
      (s.notes ?? '').replace(/"/g, '""'),
    ]
  })

  const csv = [headers, ...rows]
    .map(row => row.map(cell => `"${cell}"`).join(','))
    .join('\r\n')

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="scetv-towers-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  })
}
