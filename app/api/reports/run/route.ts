import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { FIELD_CATALOG, type ReportConfig, type FilterDef } from '@/lib/report-fields'
import { getActorInfo, logChange, getAuditClient } from '@/lib/audit'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://vfntpdpneusqgcwxwkix.supabase.co'
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZmbnRwZHBuZXVzcWdjd3h3a2l4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5NTg2MzEsImV4cCI6MjA5MzUzNDYzMX0.kFZ6b2WKAl7GVsEQZeO33qcxhyBruQlTfW0eZfkcg1c'

const ROLE_RANK: Record<string, number> = {
  super_admin: 5, admin: 4, editor: 3, reporter: 2, viewer: 1,
}

function applyFilter(query: any, f: FilterDef, isJoin = false) {
  // For join sources (licenses), skip joined fields in DB-level filter
  if (isJoin && (f.field === 'site_name' || f.field === 'site_code' || f.field === 'licensee_name')) return query
  switch (f.op) {
    case 'eq':    return query.eq(f.field, f.value)
    case 'neq':   return query.neq(f.field, f.value)
    case 'ilike': return query.ilike(f.field, `%${f.value}%`)
    case 'gte':   return query.gte(f.field, f.value)
    case 'lte':   return query.lte(f.field, f.value)
    default:      return query
  }
}

export async function POST(request: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: { getAll() { return cookieStore.getAll() }, setAll() {} },
  })

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const rank = ROLE_RANK[profile?.role ?? ''] ?? 0

  const config: ReportConfig = await request.json()
  const { data_source, columns, filters = [], sort_field, sort_dir } = config

  // Enforce min_role on the report
  if (config.min_role && (ROLE_RANK[config.min_role] ?? 0) > rank) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 })
  }

  const validFields = FIELD_CATALOG[data_source]?.fields.map(f => f.key) ?? []
  const safeColumns = columns.filter(c => validFields.includes(c))
  if (!safeColumns.length) return NextResponse.json({ error: 'No valid columns' }, { status: 400 })

  let rows: any[] = []

  if (data_source === 'licenses') {
    let q = supabase
      .from('site_licenses')
      .select('id, status, annual_rent, license_start, license_end, escalation_rate, mount_type, tower_sites(site_code, name), licensees(name)')
      .limit(500)

    for (const f of filters) q = applyFilter(q, f, true)
    if (sort_field && !['site_name', 'site_code', 'licensee_name'].includes(sort_field)) {
      q = q.order(sort_field, { ascending: sort_dir === 'asc' })
    }

    const { data, error } = await q
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Remap to flat structure
    rows = (data ?? []).map((r: any) => ({
      site_name:       r.tower_sites?.name ?? '—',
      site_code:       r.tower_sites?.site_code ?? '—',
      licensee_name:   r.licensees?.name ?? '—',
      status:          r.status,
      annual_rent:     r.annual_rent,
      license_start:   r.license_start,
      license_end:     r.license_end,
      escalation_rate: r.escalation_rate,
      mount_type:      r.mount_type,
    }))

    // JS-level sort for join fields
    if (sort_field && ['site_name', 'site_code', 'licensee_name'].includes(sort_field)) {
      rows.sort((a, b) => {
        const av = String(a[sort_field] ?? '')
        const bv = String(b[sort_field] ?? '')
        return sort_dir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
      })
    }

    // JS-level filter for join fields
    for (const f of filters) {
      if (!['site_name', 'site_code', 'licensee_name'].includes(f.field)) continue
      rows = rows.filter(r => {
        const v = String(r[f.field] ?? '').toLowerCase()
        const fv = f.value.toLowerCase()
        if (f.op === 'eq')    return v === fv
        if (f.op === 'neq')   return v !== fv
        if (f.op === 'ilike') return v.includes(fv)
        return true
      })
    }
  } else {
    const tableMap: Record<string, string> = {
      sites: 'tower_sites', licensees: 'licensees', agencies: 'state_agencies', audit: 'site_change_log',
    }
    const table = tableMap[data_source]
    let q = (supabase.from(table) as any).select(safeColumns.join(', ')).limit(500)
    for (const f of filters) q = applyFilter(q, f)
    if (sort_field && safeColumns.includes(sort_field)) {
      q = q.order(sort_field, { ascending: sort_dir === 'asc' })
    }
    const { data, error } = await q
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    rows = data ?? []
  }

  // Return only selected columns
  const trimmed = rows.map(r => {
    const out: Record<string, any> = {}
    for (const col of safeColumns) out[col] = r[col] ?? null
    return out
  })

  const actor = await getActorInfo()
  await logChange(getAuditClient(), config.id ?? null, 'report_run', null,
    `${config.name ?? 'unnamed'} (${trimmed.length} rows)`, actor.name,
    { userId: actor.userId, ip: actor.ip, entityType: 'report' })

  return NextResponse.json({ rows: trimmed, columns: safeColumns })
}
