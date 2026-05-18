import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'
import { getActorInfo, logChange } from '@/lib/audit'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const supabase = getSupabase()

    // Fetch current record to diff changes
    const { data: before } = await supabase.from('licensees').select('*').eq('id', id).single()

    const { error } = await supabase.from('licensees').update(body).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    // Log each changed field
    const actor = await getActorInfo()
    for (const [field, newVal] of Object.entries(body)) {
      const oldVal = before ? String(before[field] ?? '') : null
      const newStr = String(newVal ?? '')
      if (oldVal !== newStr) {
        await logChange(supabase, id, field, oldVal, newStr, actor.name, {
          userId: actor.userId, ip: actor.ip, entityType: 'licensee',
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
      .from('site_licenses')
      .select('id', { count: 'exact', head: true })
      .eq('licensee_id', id)
      .in('status', ['active', 'pending', 'expiring_soon'])

    if (count && count > 0) {
      return NextResponse.json(
        { error: `Cannot delete — this licensee has ${count} active license${count > 1 ? 's' : ''} on tower sites. Expire or terminate all licenses first.` },
        { status: 409 }
      )
    }

    const { data: before } = await supabase.from('licensees').select('name').eq('id', id).single()
    const { error } = await supabase.from('licensees').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    const actor = await getActorInfo()
    await logChange(supabase, id, 'licensee_deleted', before?.name ?? id, null, actor.name, {
      userId: actor.userId, ip: actor.ip, entityType: 'licensee',
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
