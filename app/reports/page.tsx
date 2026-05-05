export const dynamic = 'force-dynamic'

import { getSupabase } from '@/lib/supabase'
import ReportsClient from '@/components/reports/ReportsClient'

export default async function ReportsPage() {
  const supabase = getSupabase()
  const { data: sites } = await supabase.from('tower_sites').select('*').order('site_code')

  return (
    <div style={{ padding: '32px', maxWidth: '1200px' }}>
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#0f172a', margin: 0 }}>Reports</h1>
        <p style={{ color: '#64748b', marginTop: '4px', fontSize: '14px' }}>
          Generate and export portfolio reports
        </p>
      </div>
      <ReportsClient sites={sites ?? []} />
    </div>
  )
}
