import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = getSupabase()
    const { data, error } = await supabase
      .from('equipment_items')
      .select('*, site_licenses(id, licensees(id, name))')
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
      .from('equipment_items')
      .insert([{
        site_id: id,
        license_id: body.license_id || null,
        equipment_type: body.equipment_type,
        manufacturer: body.manufacturer || null,
        model: body.model || null,
        quantity: Number(body.quantity ?? 1),
        install_date: body.install_date || null,
        location_description: body.location_description || null,
        fcc_id: body.fcc_id || null,
        notes: body.notes || null,
      }])
      .select('id')
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ id: data.id })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
