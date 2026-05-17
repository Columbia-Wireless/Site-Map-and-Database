import { NextRequest, NextResponse } from 'next/server'
import { getSupabase, getServiceClient } from '@/lib/supabase'
import { getActorInfo, logChange } from '@/lib/audit'

// ── GET /api/sites/[id]/media ────────────────────────────────────────────────
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = getSupabase()
    const { data, error } = await supabase
      .from('site_media')
      .select('*')
      .eq('site_id', id)
      .order('uploaded_at', { ascending: false })
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json(data ?? [])
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// ── POST /api/sites/[id]/media ───────────────────────────────────────────────
// Accepts either:
//   a) multipart/form-data with file (legacy / small files via server)
//   b) application/json with { name, filePath, mimeType, fileSizeKb, description?, uploadedBy? }
//      used when the browser has already uploaded the file directly to Supabase storage
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const contentType = req.headers.get('content-type') ?? ''

    // ── JSON path: file already in storage, just save DB metadata ────────────
    if (contentType.startsWith('application/json')) {
      const body = await req.json()
      const { name, filePath, mimeType, fileSizeKb } = body
      if (!name || !filePath) return NextResponse.json({ error: 'name and filePath required' }, { status: 400 })

      const actor    = await getActorInfo()
      const supabase = getSupabase()
      const service  = getServiceClient()   // service role bypasses RLS for audit log
      const isPhoto  = (mimeType ?? '').startsWith('image/')
      const isVideo  = (mimeType ?? '').startsWith('video/')
      const mediaType = isPhoto ? 'photo' : isVideo ? 'video' : 'document'

      const { data: row, error: dbErr } = await supabase
        .from('site_media')
        .insert([{
          site_id:      id,
          name,
          media_type:   mediaType,
          file_path:    filePath,
          mime_type:    mimeType ?? null,
          file_size_kb: fileSizeKb ?? null,
          description:  body.description || null,
          uploaded_by:  body.uploadedBy ?? 'Admin',
        }])
        .select('*')
        .single()

      if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 400 })

      const sizeMb = fileSizeKb ? (fileSizeKb / 1024).toFixed(1) : '?'
      await logChange(service, id, 'media_uploaded', null,
        `${name} (${mediaType}, ${sizeMb} MB)`,
        actor.name, { userId: actor.userId, ip: actor.ip },
      )

      return NextResponse.json(row, { status: 201 })
    }

    // ── Multipart path: file uploaded through the server (small files) ───────
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const description = (formData.get('description') as string | null) ?? ''
    const uploadedBy = (formData.get('uploaded_by') as string | null) ?? 'Admin'

    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

    const actor   = await getActorInfo()
    const supabase = getSupabase()
    const service  = getServiceClient()   // service role for audit log — bypasses RLS
    const sizeMb  = (file.size / (1024 * 1024)).toFixed(1)

    const mime = file.type
    const isPhoto = mime.startsWith('image/')
    const isVideo = mime.startsWith('video/')
    const isDoc = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain',
      'text/csv',
    ].includes(mime) || (!isPhoto && !isVideo && (
      file.name.match(/\.(pdf|doc|docx|xls|xlsx|ppt|pptx|txt|csv)$/i) !== null
    ))

    if (!isPhoto && !isVideo && !isDoc) {
      await logChange(service, id, 'media_upload_failed', null,
        `${file.name} (${sizeMb} MB) — unsupported file type (${mime || 'unknown'})`,
        actor.name, { userId: actor.userId, ip: actor.ip },
      )
      return NextResponse.json({ error: 'Unsupported file type. Allowed: images, videos, PDF, Word, Excel, PowerPoint.' }, { status: 400 })
    }

    const mediaType = isPhoto ? 'photo' : isVideo ? 'video' : 'document'
    const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
    const uuid = crypto.randomUUID()
    const filePath = `${id}/${uuid}.${ext}`

    // Upload to Supabase Storage using service client (bypasses RLS)
    const arrayBuf = await file.arrayBuffer()
    const { error: storageErr } = await service.storage
      .from('site-media')
      .upload(filePath, arrayBuf, { contentType: mime, upsert: false })

    if (storageErr) {
      await logChange(service, id, 'media_upload_failed', null,
        `${file.name} (${mediaType}, ${sizeMb} MB) — storage error: ${storageErr.message}`,
        actor.name, { userId: actor.userId, ip: actor.ip },
      )
      return NextResponse.json({ error: storageErr.message }, { status: 400 })
    }

    // Save metadata to DB
    const { data: row, error: dbErr } = await supabase
      .from('site_media')
      .insert([{
        site_id: id,
        name: file.name,
        media_type: mediaType,
        file_path: filePath,
        mime_type: mime,
        file_size_kb: Math.round(file.size / 1024),
        description: description || null,
        uploaded_by: uploadedBy,
      }])
      .select('*')
      .single()

    if (dbErr) {
      // Roll back storage upload on DB failure
      await service.storage.from('site-media').remove([filePath])
      await logChange(service, id, 'media_upload_failed', null,
        `${file.name} (${mediaType}, ${sizeMb} MB) — database error: ${dbErr.message}`,
        actor.name, { userId: actor.userId, ip: actor.ip },
      )
      return NextResponse.json({ error: dbErr.message }, { status: 400 })
    }

    // Success
    await logChange(service, id, 'media_uploaded', null,
      `${file.name} (${mediaType}, ${sizeMb} MB)`,
      actor.name, { userId: actor.userId, ip: actor.ip },
    )

    return NextResponse.json(row, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
