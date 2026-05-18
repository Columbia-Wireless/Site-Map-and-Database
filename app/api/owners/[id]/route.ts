import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'
import { getActorInfo, logChange } from '@/lib/audit'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const supabase = getSupabase()

    // Fetch current record to diff changes
    const { data: before } = await supabase.from('state_agencies').select('*').eq('id', id).single()

    const { error } = await supabase.from('state_agencies').update(body).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    // Log each changed field
    const actor = await getActorInfo()
    for (const [field, newVal] of Object.entries(body)) {
      const oldVal = before ? String(before[field] ?? '') : null
      const newStr = String(newVal ?? '')
      if (oldVal !== newStr) {
        await logChange(supabase, id, field, oldVal, newStr, actor.name, {
          userId: actor.userId, ip: actor.ip, entityType: 'owner',
        })
      }
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = getSupabase()

    const { count } = await supabase
      .from('tower_sites')
      .select('id', { count: 'exact', head: true })
      .eq('host_agency_id', id)

    if (count && count > 0) {
      return NextResponse.json(
        { error: `Cannot delete — this agency has ${count} site${count > 1 ? 's' : ''} assigned. Reassign all sites first.` },
        { status: 409 }
      )
    }

    const { data: before } = await supabase.from('state_agencies').select('name').eq('id', id).single()
    const { error } = await supabase.from('state_agencies').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    const actor = await getActorInfo()
    await logChange(supabase, id, 'owner_deleted', before?.name ?? id, null, actor.name, {
      userId: actor.userId, ip: actor.ip, entityType: 'owner',
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
