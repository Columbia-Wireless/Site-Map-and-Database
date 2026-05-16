import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'
import { getProfile, canExport } from '@/lib/profile'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const profile = await getProfile()
  if (!canExport(profile)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const supabase = getSupabase()

  // Agency name for filename
  const { data: agency } = await supabase
    .from('state_agencies')
    .select('name')
    .eq('id', id)
    .single()

  // Sites for this agency + their licenses
  const { data: sites, error } = await supabase
    .from('tower_sites')
    .select(`
      id, site_code, name, address, city, state, zip, county,
      tower_type, height_ft, status, lat, lng, tenant_slots, notes,
      site_licenses(
        id, status, annual_rent, escalation_rate,
        license_start, license_end, contract_type, invoice_method,
        licensees(name)
      )
    `)
    .eq('host_agency_id', id)
    .order('site_code')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rows: string[][] = []

  // One row per license (sites with multiple tenants produce multiple rows)
  for (const site of sites ?? []) {
    const licenses: any[] = (site as any).site_licenses ?? []
    const activeOnly = licenses.filter(l =>
      ['active', 'pending', 'expiring_soon'].includes(l.status)
    )

    if (activeOnly.length === 0) {
      // Site with no active licenses — still include as one row
      rows.push([
        site.site_code ?? '',
        site.name ?? '',
        site.address ?? '',
        site.city ?? '',
        site.state ?? '',
        site.zip ?? '',
        site.county ?? '',
        site.tower_type ?? '',
        String(site.height_ft ?? ''),
        site.status ?? '',
        String(site.lat ?? ''),
        String(site.lng ?? ''),
        String(site.tenant_slots ?? ''),
        '', '', '', '', '', '', '',
      ])
    } else {
      for (const lic of activeOnly) {
        rows.push([
          site.site_code ?? '',
          site.name ?? '',
          site.address ?? '',
          site.city ?? '',
          site.state ?? '',
          site.zip ?? '',
          site.county ?? '',
          site.tower_type ?? '',
          String(site.height_ft ?? ''),
          site.status ?? '',
          String(site.lat ?? ''),
          String(site.lng ?? ''),
          String(site.tenant_slots ?? ''),
          lic.licensees?.name ?? '',
          lic.status ?? '',
          String(lic.annual_rent ?? ''),
          String(lic.escalation_rate ?? ''),
          lic.license_start ?? '',
          lic.license_end ?? '',
          lic.contract_type ?? '',
        ])
      }
    }
  }

  const headers = [
    'Site Code', 'Site Name', 'Address', 'City', 'State', 'ZIP', 'County',
    'Tower Type', 'Height (ft)', 'Site Status', 'Latitude', 'Longitude', 'Total Slots',
    'Licensee', 'License Status', 'Annual Rent ($)', 'Escalation Rate',
    'License Start', 'License End', 'Contract Type',
  ]

  const csv = [headers, ...rows]
    .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\r\n')

  const agencySlug = (agency?.name ?? 'agency').toLowerCase().replace(/[^a-z0-9]+/g, '-')
  const dateStr = new Date().toISOString().slice(0, 10)

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="scetv-${agencySlug}-${dateStr}.csv"`,
    },
  })
}
