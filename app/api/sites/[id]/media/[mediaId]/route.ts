import { NextRequest, NextResponse } from 'next/server'
import { getSupabase, getServiceClient } from '@/lib/supabase'
import { getActorInfo, logChange } from '@/lib/audit'

// ── DELETE /api/sites/[id]/media/[mediaId] ───────────────────────────────────
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; mediaId: string }> }
) {
  try {
    const { id, mediaId } = await params
    const supabase = getSupabase()

    // Fetch the full record before deleting — needed for audit log and storage path
    const { data: row, error: fetchErr } = await supabase
      .from('site_media')
      .select('file_path, name, media_type, file_size_kb')
      .eq('id', mediaId)
      .single()

    if (fetchErr || !row) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Delete from storage
    const service = getServiceClient()
    const { error: storageErr } = await service.storage
      .from('site-media')
      .remove([row.file_path])

    if (storageErr) {
      console.warn('Storage delete warning:', storageErr.message)
      // Continue — don't block DB delete if file is already gone
    }

    // Delete DB record
    const { error: dbErr } = await supabase
      .from('site_media')
      .delete()
      .eq('id', mediaId)

    if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 400 })

    // Audit log — use service client so RLS doesn't silently swallow the insert
    const actor = await getActorInfo()
    const sizeMb = row.file_size_kb ? `${(row.file_size_kb / 1024).toFixed(1)} MB` : ''
    await logChange(service, id, 'media_deleted',
      `${row.name} (${row.media_type}${sizeMb ? ', ' + sizeMb : ''})`, null,
      actor.name, { userId: actor.userId, ip: actor.ip },
    )

    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// ── PATCH /api/sites/[id]/media/[mediaId] ────────────────────────────────────
// Update description only
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; mediaId: string }> }
) {
  try {
    const { mediaId } = await params
    const { description } = await req.json()
    const supabase = getSupabase()
    const { error } = await supabase
      .from('site_media')
      .update({ description })
      .eq('id', mediaId)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
