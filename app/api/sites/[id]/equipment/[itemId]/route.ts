import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; itemId: string }> }) {
  try {
    const { itemId } = await params
    const body = await req.json()
    const supabase = getSupabase()
    const updates: Record<string, unknown> = {}
    if (body.license_id !== undefined) updates.license_id = body.license_id || null
    if (body.equipment_type !== undefined) updates.equipment_type = body.equipment_type
    if (body.manufacturer !== undefined) updates.manufacturer = body.manufacturer || null
    if (body.model !== undefined) updates.model = body.model || null
    if (body.quantity !== undefined) updates.quantity = Number(body.quantity)
    if (body.install_date !== undefined) updates.install_date = body.install_date || null
    if (body.location_description !== undefined) updates.location_description = body.location_description || null
    if (body.fcc_id !== undefined) updates.fcc_id = body.fcc_id || null
    if (body.notes !== undefined) updates.notes = body.notes || null
    const { error } = await supabase.from('equipment_items').update(updates).eq('id', itemId)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; itemId: string }> }) {
  try {
    const { itemId } = await params
    const supabase = getSupabase()
    const { error } = await supabase.from('equipment_items').delete().eq('id', itemId)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
