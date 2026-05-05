import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const supabase = getSupabase()

    const { data: site, error } = await supabase
      .from('tower_sites')
      .insert([body])
      .select('id, site_code')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    await supabase.from('site_change_log').insert([{
      site_id: site.id,
      field_name: 'site_created',
      old_value: null,
      new_value: site.site_code,
      changed_by: 'Admin',
      changed_at: new Date().toISOString(),
    }])

    return NextResponse.json({ id: site.id })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
