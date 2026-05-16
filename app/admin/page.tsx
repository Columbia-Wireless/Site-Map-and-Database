export const dynamic = 'force-dynamic'

import { getSupabase } from '@/lib/supabase'
import AdminClient from '@/components/admin/AdminClient'

async function getCounts() {
  const supabase = getSupabase()
  const [
    { count: sites },
    { count: owners },
    { count: tenants },
    { count: tenancies },
    { count: documents },
    { count: changeLogs },
    { count: media },
  ] = await Promise.all([
    supabase.from('tower_sites').select('*', { count: 'exact', head: true }),
    supabase.from('state_agencies').select('*', { count: 'exact', head: true }),
    supabase.from('licensees').select('*', { count: 'exact', head: true }),
    supabase.from('site_licenses').select('*', { count: 'exact', head: true }),
    supabase.from('site_documents').select('*', { count: 'exact', head: true }),
    supabase.from('site_change_log').select('*', { count: 'exact', head: true }),
    supabase.from('site_media').select('*', { count: 'exact', head: true }),
  ])
  return { sites, owners, tenants, tenancies, documents, changeLogs, media }
}

export default async function AdminPage() {
  const counts = await getCounts()
  const totalRows = Object.values(counts).reduce((s, v) => (s ?? 0) + (v ?? 0), 0) as number
  return <AdminClient counts={counts} totalRows={totalRows} />
}
