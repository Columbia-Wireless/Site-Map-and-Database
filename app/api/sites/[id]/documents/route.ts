import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { logDocEvent, getCallerName } from '@/lib/logDocEvent'

const DOC_TYPE_LABELS: Record<string, string> = {
  lease:           'Lease Agreement',
  amendment:       'Amendment',
  addendum:        'Addendum',
  coi:             'Certificate of Insurance',
  fcc_license:     'FCC License',
  structural:      'Structural Certification',
  title:           'Title / Deed',
  survey:          'Survey',
  other:           'Other',
}

function getSupabaseAdmin() {
  const url  = process.env.NEXT_PUBLIC_SUPABASE_URL  || 'https://vfntpdpneusqgcwxwkix.supabase.co'
  const key  = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZmbnRwZHBuZXVzcWdjd3h3a2l4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5NTg2MzEsImV4cCI6MjA5MzUzNDYzMX0.kFZ6b2WKAl7GVsEQZeO33qcxhyBruQlTfW0eZfkcg1c'
  return createClient(url, key)
}

// GET /api/sites/[id]/documents
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = getSupabaseAdmin()

    const { data, error } = await supabase
      .from('site_documents')
      .select('*')
      .eq('site_id', id)
      .order('uploaded_at', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json(data)
  } catch (err: any) {
    console.error('[GET /documents] Unexpected error:', err)
    return NextResponse.json({ error: err?.message ?? 'Internal server error' }, { status: 500 })
  }
}

// POST /api/sites/[id]/documents  — JSON metadata only (file already uploaded to Storage by client)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: siteId } = await params
    const supabase = getSupabaseAdmin()
    const userName = await getCallerName(req)

    const body = await req.json()
    const { file_name, file_type, file_size_kb, file_hash, storage_path, doc_type, parent_id } = body

    if (!file_name || !storage_path) {
      return NextResponse.json({ error: 'file_name and storage_path are required' }, { status: 400 })
    }

    const { data: doc, error: dbError } = await supabase
      .from('site_documents')
      .insert({
        site_id:            siteId,
        name:               file_name,
        doc_type:           doc_type || 'other',
        uploaded_by:        userName,
        file_size_kb:       file_size_kb || 0,
        storage_path:       storage_path,
        file_hash:          file_hash || null,
        parent_document_id: parent_id || null,
        doc_status:         'uploaded',
      })
      .select()
      .single()

    if (dbError) return NextResponse.json({ error: dbError.message }, { status: 400 })

    await logDocEvent(supabase, doc.id, 'uploaded', userName, {
      file_name:    doc.name,
      doc_type:     doc.doc_type,
      file_size_kb: doc.file_size_kb,
      file_hash:    doc.file_hash ?? null,
    })

    return NextResponse.json(doc)
  } catch (err: any) {
    console.error('[POST /documents] Unexpected error:', err)
    return NextResponse.json({ error: err?.message ?? 'Internal server error' }, { status: 500 })
  }
}
