import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const supabase = getSupabase()
    const { error } = await supabase.from('state_agencies').update(body).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
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

    const { error } = await supabase.from('state_agencies').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
