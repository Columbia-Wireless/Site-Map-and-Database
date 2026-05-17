import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://vfntpdpneusqgcwxwkix.supabase.co'
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZmbnRwZHBuZXVzcWdjd3h3a2l4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5NTg2MzEsImV4cCI6MjA5MzUzNDYzMX0.kFZ6b2WKAl7GVsEQZeO33qcxhyBruQlTfW0eZfkcg1c'
  return createClient(url, key)
}

// GET /api/sites/[id]/documents/[docId] — returns a 60-min signed URL for viewing
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  const { id: siteId, docId } = await params
  const supabase = getSupabaseAdmin()

  const { data: doc, error } = await supabase
    .from('site_documents')
    .select('id, name, doc_type, storage_path')
    .eq('id', docId)
    .eq('site_id', siteId)
    .single()

  if (error || !doc) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!doc.storage_path) return NextResponse.json({ error: 'No file attached' }, { status: 404 })

  const { data: signed, error: signErr } = await supabase.storage
    .from('lease-documents')
    .createSignedUrl(doc.storage_path, 3600) // 1 hour

  if (signErr || !signed) return NextResponse.json({ error: 'Could not generate URL' }, { status: 500 })

  return NextResponse.json({ signedUrl: signed.signedUrl, name: doc.name, doc_type: doc.doc_type })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  const { id: siteId, docId } = await params
  const supabase = getSupabaseAdmin()

  // Fetch storage path before deleting the record
  const { data: doc } = await supabase
    .from('site_documents')
    .select('storage_path')
    .eq('id', docId)
    .eq('site_id', siteId)
    .single()

  if (doc?.storage_path) {
    await supabase.storage.from('lease-documents').remove([doc.storage_path])
  }

  const { error } = await supabase
    .from('site_documents')
    .delete()
    .eq('id', docId)
    .eq('site_id', siteId)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
