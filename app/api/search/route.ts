import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://vfntpdpneusqgcwxwkix.supabase.co'
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZmbnRwZHBuZXVzcWdjd3h3a2l4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5NTg2MzEsImV4cCI6MjA5MzUzNDYzMX0.kFZ6b2WKAl7GVsEQZeO33qcxhyBruQlTfW0eZfkcg1c'
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY

const ROLE_RANK: Record<string, number> = {
  super_admin: 5, admin: 4, editor: 3, reporter: 2, viewer: 1,
}

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q')?.trim()
  if (!q || q.length < 2) return NextResponse.json({ sites: [], licensees: [], agencies: [], billing: [], users: [] })

  const cookieStore = await cookies()
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: { getAll() { return cookieStore.getAll() }, setAll() {} },
  })

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role, organization_id, organizations(is_platform_admin)').eq('id', user.id).single()
  const rank = ROLE_RANK[profile?.role ?? ''] ?? 0
  const isAdmin = rank >= 4
  const isPlatformAdmin = !!(profile?.organizations as any)?.is_platform_admin
  const userOrgId = profile?.organization_id

  const wild = `%${q}%`
  const LIMIT = 6

  const [sitesRes, licenseesRes, agenciesRes, usersRes] = await Promise.all([
    supabase
      .from('tower_sites')
      .select('id, site_code, name, city, state, tower_type, status')
      .or(`site_code.ilike.${wild},name.ilike.${wild},city.ilike.${wild},address.ilike.${wild}`)
      .limit(LIMIT),

    supabase
      .from('licensees')
      .select('id, name, hq_city, hq_state, status')
      .or(`name.ilike.${wild},hq_city.ilike.${wild},hq_state.ilike.${wild}`)
      .limit(LIMIT),

    supabase
      .from('state_agencies')
      .select('id, name, city, state, type, status')
      .or(`name.ilike.${wild},city.ilike.${wild},state.ilike.${wild}`)
      .limit(LIMIT),

    isAdmin
      ? (() => {
          const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } })
          let q = adminClient.from('profiles').select('id, full_name, role, organization_id').ilike('full_name', wild).limit(LIMIT)
          if (!isPlatformAdmin && userOrgId) q = q.eq('organization_id', userOrgId)
          return q
        })()
      : Promise.resolve({ data: [] }),
  ])

  // Billing: rather than a fragile ilike across a joined table (PostgREST's
  // .or() can't reach embedded-resource columns), piggyback on the sites/
  // licensees already matched above — a query for "AT&T" that matches the
  // licensee also surfaces AT&T's current agreements here. RLS on
  // site_licenses scopes this the same way as the other queries.
  const matchedSiteIds = (sitesRes.data ?? []).map((s: any) => s.id)
  const matchedLicenseeIds = (licenseesRes.data ?? []).map((l: any) => l.id)
  let billing: any[] = []
  if (matchedSiteIds.length > 0 || matchedLicenseeIds.length > 0) {
    const orParts: string[] = []
    if (matchedSiteIds.length > 0) orParts.push(`site_id.in.(${matchedSiteIds.join(',')})`)
    if (matchedLicenseeIds.length > 0) orParts.push(`licensee_id.in.(${matchedLicenseeIds.join(',')})`)
    const { data: billingData } = await supabase
      .from('site_licenses')
      .select('id, site_id, licensee_id, status, tower_sites ( id, site_code, name ), licensees ( id, name )')
      .in('status', ['active', 'pending', 'expiring_soon'])
      .or(orParts.join(','))
      .limit(LIMIT)
    billing = billingData ?? []
  }

  // For users, enrich with emails from auth.admin if admin
  let users: any[] = usersRes.data ?? []
  if (isAdmin && users.length > 0) {
    try {
      const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } })
      const { data: { users: authUsers } } = await admin.auth.admin.listUsers()
      const emailMap: Record<string, string> = {}
      authUsers.forEach(u => { emailMap[u.id] = u.email ?? '' })
      users = users.map(u => ({ ...u, email: emailMap[u.id] ?? '' }))
      // Also search by email if no profile name matches
      // Email fallback only for platform admins — non-platform org admins get
      // name-only search since auth.admin.listUsers() returns all orgs' users.
      if (users.length < LIMIT && isPlatformAdmin) {
        const visibleUserIds = new Set(users.map((u: any) => u.id))
        const emailMatches = authUsers
          .filter(u => {
            if (!u.email?.toLowerCase().includes(q.toLowerCase())) return false
            if (visibleUserIds.has(u.id)) return false
            return true
          })
          .slice(0, LIMIT - users.length)
          .map(u => ({ id: u.id, full_name: null, email: u.email, role: null }))
        users = [...users, ...emailMatches]
      }
    } catch { /* non-fatal */ }
  }

  return NextResponse.json({
    sites:     sitesRes.data     ?? [],
    licensees: licenseesRes.data ?? [],
    agencies:  agenciesRes.data  ?? [],
    billing,
    users:     isAdmin ? users : [],
  })
}
