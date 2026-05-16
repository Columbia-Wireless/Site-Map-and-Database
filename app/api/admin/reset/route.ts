import { NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'

export async function POST() {
  try {
    const supabase = getServiceClient()

    // ── 1. Clear storage bucket (site-media) ────────────────────────────────
    const { data: files } = await supabase.storage.from('site-media').list('', {
      limit: 1000,
      offset: 0,
    })

    if (files && files.length > 0) {
      // list() at root gives folders (site_id prefixes) — we need to recurse
      for (const folder of files) {
        const { data: folderFiles } = await supabase.storage
          .from('site-media')
          .list(folder.name, { limit: 1000 })
        if (folderFiles && folderFiles.length > 0) {
          const paths = folderFiles.map(f => `${folder.name}/${f.name}`)
          await supabase.storage.from('site-media').remove(paths)
        }
      }
      // Remove the folder placeholders themselves
      const rootPaths = files.map(f => f.name)
      await supabase.storage.from('site-media').remove(rootPaths)
    }

    // ── 2. Truncate tables in FK-safe order ──────────────────────────────────
    // Using CASCADE so we don't have to worry about ordering
    const { error } = await supabase.rpc('reset_all_data')
    if (error) throw new Error(error.message)

    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
