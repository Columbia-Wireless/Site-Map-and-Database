import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'
import { getActorInfo, logChange } from '@/lib/audit'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = getSupabase()
    const { data, error } = await supabase.from('tower_sites').select('*').eq('id', id).single()
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const supabase = getSupabase()
    const actor = await getActorInfo()

    // Fetch current values for audit diff
    const { data: current } = await supabase.from('tower_sites').select('*').eq('id', id).single()

    const updates = {
      site_code:      body.site_code,
      name:           body.name,
      address:        body.address ?? null,
      city:           body.city ?? null,
      state:          body.state ?? null,
      zip:            body.zip ?? null,
      lat:            body.lat !== '' && body.lat != null ? Number(body.lat) : null,
      lng:            body.lng !== '' && body.lng != null ? Number(body.lng) : null,
      host_agency_id: body.host_agency_id || null,
      tower_type:     body.tower_type ?? null,
      height_ft:      body.height_ft !== '' && body.height_ft != null ? Number(body.height_ft) : null,
      tenant_slots:   body.tenant_slots !== '' && body.tenant_slots != null ? Number(body.tenant_slots) : null,
      status:         body.status ?? 'operational',
      notes:          body.notes ?? null,
    }

    const { error } = await supabase.from('tower_sites').update(updates).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    // Audit log — one entry per changed field
    if (current) {
      const fields: (keyof typeof updates)[] = [
        'site_code', 'name', 'address', 'city', 'state', 'zip',
        'lat', 'lng', 'host_agency_id', 'tower_type', 'height_ft',
        'tenant_slots', 'status', 'notes',
      ]
      for (const field of fields) {
        const oldVal = String(current[field] ?? '')
        const newVal = String(updates[field] ?? '')
        if (oldVal !== newVal) {
          await logChange(supabase, id, field, oldVal, newVal, actor.name, {
            userId: actor.userId,
            ip:     actor.ip,
          })
        }
      }
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
