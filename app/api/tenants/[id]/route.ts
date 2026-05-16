import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const supabase = getSupabase()

    const { error } = await supabase.from('licensees').update(body).eq('id', id)
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

    // Block deletion if licensee has active licenses
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

    const { error } = await supabase.from('licensees').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
