import { NextRequest, NextResponse } from 'next/server'
import { getSupabase, getServiceClient } from '@/lib/supabase'

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
// Accepts multipart/form-data: file (required), description (optional), uploaded_by (optional)
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const description = (formData.get('description') as string | null) ?? ''
    const uploadedBy = (formData.get('uploaded_by') as string | null) ?? 'Admin'

    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

    const mime = file.type
    const isPhoto = mime.startsWith('image/')
    const isVideo = mime.startsWith('video/')
    if (!isPhoto && !isVideo) {
      return NextResponse.json({ error: 'Unsupported file type. Only images and videos are allowed.' }, { status: 400 })
    }

    const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
    const uuid = crypto.randomUUID()
    const filePath = `${id}/${uuid}.${ext}`

    // Upload to Supabase Storage using service client (bypasses RLS)
    const service = getServiceClient()
    const arrayBuf = await file.arrayBuffer()
    const { error: storageErr } = await service.storage
      .from('site-media')
      .upload(filePath, arrayBuf, { contentType: mime, upsert: false })

    if (storageErr) return NextResponse.json({ error: storageErr.message }, { status: 400 })

    // Save metadata to DB
    const supabase = getSupabase()
    const { data: row, error: dbErr } = await supabase
      .from('site_media')
      .insert([{
        site_id: id,
        name: file.name,
        media_type: isPhoto ? 'photo' : 'video',
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
      return NextResponse.json({ error: dbErr.message }, { status: 400 })
    }

    return NextResponse.json(row, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
