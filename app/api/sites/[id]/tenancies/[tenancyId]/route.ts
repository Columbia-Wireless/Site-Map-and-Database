import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'
import { getActorName, logChange } from '@/lib/audit'

const FIELD_LABELS: Record<string, string> = {
  annual_rent: 'Annual Rent', escalation_rate: 'Escalation Rate', status: 'Status',
  license_start: 'License Start', license_end: 'License End', mount_type: 'Mount Type',
  antenna_height_ft: 'Antenna Height', notes: 'Notes',
  contract_type: 'Contract Type', invoice_method: 'Invoice Method',
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; tenancyId: string }> }) {
  try {
    const { id, tenancyId } = await params
    const body = await req.json()
    const supabase = getSupabase()

    const { data: existing } = await supabase
      .from('site_licenses')
      .select('*, licensees(name)')
      .eq('id', tenancyId)
      .single()

    const updates: Record<string, unknown> = {}
    if (body.licensee_id !== undefined) updates.licensee_id = body.licensee_id
    if (body.contract_type !== undefined) updates.contract_type = body.contract_type
    if (body.invoice_method !== undefined) updates.invoice_method = body.invoice_method
    if (body.mount_type !== undefined) updates.mount_type = body.mount_type
    if (body.antenna_height_ft !== undefined) updates.antenna_height_ft = body.antenna_height_ft ? Number(body.antenna_height_ft) : null
    if (body.annual_rent !== undefined) updates.annual_rent = Number(body.annual_rent)
    if (body.escalation_rate !== undefined) updates.escalation_rate = Number(body.escalation_rate)
    if (body.license_start !== undefined) updates.license_start = body.license_start
    if (body.license_end !== undefined) updates.license_end = body.license_end
    if (body.status !== undefined) updates.status = body.status
    if (body.notes !== undefined) updates.notes = body.notes
    if (body.document_id !== undefined) updates.document_id = body.document_id || null

    const { error } = await supabase.from('site_licenses').update(updates).eq('id', tenancyId)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    if (existing) {
      const actor = await getActorName()
      const licenseeName = (existing as any).licensees?.name ?? 'License'
      for (const [key, newVal] of Object.entries(updates)) {
        const oldVal = (existing as any)[key]
        const label = FIELD_LABELS[key] ?? key
        let oldStr = oldVal != null ? String(oldVal) : null
        let newStr = newVal != null ? String(newVal) : null
        if (key === 'annual_rent') {
          oldStr = oldVal != null ? `$${Number(oldVal).toLocaleString()}` : null
          newStr = newVal != null ? `$${Number(newVal).toLocaleString()}` : null
        }
        if (oldStr !== newStr) {
          await logChange(supabase, id, `license:${label} (${licenseeName})`, oldStr, newStr, actor)
        }
      }
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; tenancyId: string }> }) {
  try {
    const { id, tenancyId } = await params
    const supabase = getSupabase()

    const { data: existing } = await supabase
      .from('site_licenses')
      .select('*, licensees(name)')
      .eq('id', tenancyId)
      .single()

    const { error } = await supabase.from('site_licenses').delete().eq('id', tenancyId)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    if (existing) {
      const actor = await getActorName()
      const licenseeName = (existing as any).licensees?.name ?? 'Licensee'
      const rent = Number((existing as any).annual_rent)
      const rentStr = rent > 0 ? ` — $${rent.toLocaleString()}/yr` : ''
      await logChange(supabase, id, 'license_removed', `${licenseeName}${rentStr}`, null, actor)
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
