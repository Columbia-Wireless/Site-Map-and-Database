import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'
import { getActorName, logChange } from '@/lib/audit'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = getSupabase()
    const { data, error } = await supabase
      .from('site_licenses')
      .select('*, licensees(id, name)')
      .eq('site_id', id)
      .order('created_at', { ascending: true })
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const supabase = getSupabase()

    const { data, error } = await supabase
      .from('site_licenses')
      .insert([{
        site_id: id,
        licensee_id: body.licensee_id,
        contract_type: body.contract_type ?? 'Base Agreement',
        invoice_method: body.invoice_method ?? 'None',
        mount_type: body.mount_type || 'Primary',
        antenna_height_ft: body.antenna_height_ft ? Number(body.antenna_height_ft) : null,
        annual_rent: Number(body.annual_rent),
        escalation_rate: Number(body.escalation_rate ?? 3),
        license_start: body.license_start,
        license_end: body.license_end,
        status: body.status ?? 'active',
        notes: body.notes ?? null,
      }])
      .select('id')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    const { data: licensee } = await supabase.from('licensees').select('name').eq('id', body.licensee_id).single()
    const actor = await getActorName()
    const rent = Number(body.annual_rent)
    const rentStr = rent > 0 ? ` — $${rent.toLocaleString()}/yr` : ''
    await logChange(supabase, id, 'license_added', null, `${licensee?.name ?? 'Licensee'}${rentStr}`, actor)

    return NextResponse.json({ id: data.id })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
