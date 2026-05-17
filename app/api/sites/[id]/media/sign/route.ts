import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'

const BUCKET = 'site-media'

// ── GET /api/sites/[id]/media/sign?filename=foo.mp4&mime=video/mp4 ────────────
// Returns a signed upload URL so the browser can PUT large files directly to
// Supabase storage, bypassing Cloud Run's body-size limit.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const url = new URL(req.url)
    const filename = url.searchParams.get('filename')

    if (!filename) return NextResponse.json({ error: 'filename required' }, { status: 400 })

    const ext      = filename.split('.').pop()?.toLowerCase() ?? 'bin'
    const filePath = `${id}/${crypto.randomUUID()}.${ext}`

    const supabase = getServiceClient()
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUploadUrl(filePath, { upsert: false })

    if (error || !data) {
      return NextResponse.json({ error: error?.message ?? 'Could not create signed URL' }, { status: 500 })
    }

    return NextResponse.json({ signedUrl: data.signedUrl, filePath })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
