import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCallerName } from '@/lib/logDocEvent'

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://vfntpdpneusqgcwxwkix.supabase.co'
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  return createClient(url, key)
}

// GET /api/field/photos?site_id=...
export async function GET(req: NextRequest) {
  const siteId = req.nextUrl.searchParams.get('site_id')
  if (!siteId) return NextResponse.json({ error: 'site_id required' }, { status: 400 })

  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('site_photos')
    .select('*')
    .eq('site_id', siteId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data ?? [])
}

// POST /api/field/photos — multipart: uploads file to storage then saves metadata
export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabaseAdmin()
    const userName = await getCallerName(req)
    const formData = await req.formData()

    const file = formData.get('file') as File | null
    const siteId = formData.get('site_id') as string
    const surveyId = formData.get('survey_id') as string | null
    const userId = formData.get('user_id') as string | null
    const category = (formData.get('category') as string) || 'general'
    const caption = formData.get('caption') as string | null

    if (!file || !siteId) {
      return NextResponse.json({ error: 'file and site_id required' }, { status: 400 })
    }

    const ext = file.name.split('.').pop() ?? 'jpg'
    const path = `photos/${siteId}/${Date.now()}.${ext}`

    const arrayBuffer = await file.arrayBuffer()
    const { error: uploadErr } = await supabase.storage
      .from('site-media')
      .upload(path, arrayBuffer, { contentType: file.type, upsert: true })

    if (uploadErr) throw new Error(uploadErr.message)

    const { data: { publicUrl } } = supabase.storage.from('site-media').getPublicUrl(path)

    const { data, error } = await supabase
      .from('site_photos')
      .insert({
        site_id: siteId,
        survey_id: surveyId || null,
        uploaded_by: userId || null,
        uploaded_by_name: userName,
        storage_path: path,
        public_url: publicUrl,
        category,
        caption: caption || null,
        file_size_bytes: file.size,
        mime_type: file.type,
      })
      .select()
      .single()

    if (error) throw new Error(error.message)
    return NextResponse.json(data)
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Photo upload failed' }, { status: 500 })
  }
}

// DELETE /api/field/photos?id=...
export async function DELETE(req: NextRequest) {
  const photoId = req.nextUrl.searchParams.get('id')
  if (!photoId) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const supabase = getSupabaseAdmin()

  const { data: photo } = await supabase
    .from('site_photos')
    .select('storage_path')
    .eq('id', photoId)
    .single()

  if (photo?.storage_path) {
    await supabase.storage.from('site-media').remove([photo.storage_path])
  }

  const { error } = await supabase.from('site_photos').delete().eq('id', photoId)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ success: true })
}
