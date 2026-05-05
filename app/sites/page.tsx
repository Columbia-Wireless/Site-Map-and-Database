export const dynamic = 'force-dynamic'

import { getSupabase } from '@/lib/supabase'
import SitePortfolio from '@/components/sites/SitePortfolio'

export default async function SitesPage() {
  const supabase = getSupabase()
  const { data: sites } = await supabase
    .from('tower_sites')
    .select('*')
    .order('site_code', { ascending: true })

  return <SitePortfolio initialSites={sites ?? []} />
}
