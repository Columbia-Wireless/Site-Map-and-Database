import { getSupabase } from '@/lib/supabase'
import { getProfile, type UserProfile } from '@/lib/profile'

export interface OrgScope {
  organizationId: string | null
  isPlatformAdmin: boolean
}

const NO_ORG = '00000000-0000-0000-0000-000000000000' // matches nothing; used when profile has no org

export function scopeFromProfile(profile: UserProfile | null): OrgScope {
  if (!profile) return { organizationId: null, isPlatformAdmin: false }
  return { organizationId: profile.organization_id, isPlatformAdmin: profile.is_platform_admin }
}

/** Applies org scoping to a tower_sites query builder. No-op for platform admins. */
export function scopeSitesQuery(query: any, scope: OrgScope): any {
  if (scope.isPlatformAdmin) return query
  return query.eq('organization_id', scope.organizationId ?? NO_ORG)
}

/**
 * Returns the list of tower_sites.id values visible to the current scope, or
 * null if the scope is unrestricted (platform admin). Use this to filter
 * child tables (site_documents, site_licenses, etc.) that don't carry
 * organization_id directly — they're scoped through their site_id.
 */
export async function getVisibleSiteIds(scope: OrgScope): Promise<string[] | null> {
  if (scope.isPlatformAdmin) return null
  const supabase = getSupabase()
  const { data } = await supabase
    .from('tower_sites')
    .select('id')
    .eq('organization_id', scope.organizationId ?? NO_ORG)
  return (data ?? []).map(r => r.id)
}

/** Checks whether a single site_id is visible to the current scope. */
export async function isSiteVisible(siteId: string, scope: OrgScope): Promise<boolean> {
  if (scope.isPlatformAdmin) return true
  const supabase = getSupabase()
  const { data } = await supabase
    .from('tower_sites')
    .select('id')
    .eq('id', siteId)
    .eq('organization_id', scope.organizationId ?? NO_ORG)
    .maybeSingle()
  return !!data
}

/**
 * One-call guard for site-scoped sub-resource routes (documents, media,
 * equipment, surveys, comparables, tenancies, audit, etc.): resolves the
 * caller's profile and checks the given site_id is in their org.
 */
export async function assertSiteVisible(siteId: string): Promise<boolean> {
  const scope = scopeFromProfile(await getProfile())
  return isSiteVisible(siteId, scope)
}

/**
 * Licensees and host agencies (state_agencies) are shared reference tables
 * with no organization_id of their own — visibility is derived from whether
 * they have at least one tenancy/site within the caller's org. A record with
 * zero ties anywhere is treated as visible (new/unlinked record), since it
 * carries no other org's data to leak.
 */
export async function isLicenseeVisible(licenseeId: string, scope: OrgScope): Promise<boolean> {
  if (scope.isPlatformAdmin) return true
  const supabase = getSupabase()
  const { data: rows } = await supabase.from('site_licenses').select('site_id').eq('licensee_id', licenseeId)
  if (!rows || rows.length === 0) return true
  const visibleSiteIds = await getVisibleSiteIds(scope) ?? []
  const visibleSet = new Set(visibleSiteIds)
  return rows.some(r => visibleSet.has(r.site_id))
}

export async function isAgencyVisible(agencyId: string, scope: OrgScope): Promise<boolean> {
  if (scope.isPlatformAdmin) return true
  const supabase = getSupabase()
  const { count } = await supabase.from('tower_sites').select('id', { count: 'exact', head: true }).eq('host_agency_id', agencyId)
  if (!count) return true
  const { count: visibleCount } = await supabase
    .from('tower_sites')
    .select('id', { count: 'exact', head: true })
    .eq('host_agency_id', agencyId)
    .eq('organization_id', scope.organizationId ?? NO_ORG)
  return (visibleCount ?? 0) > 0
}

export async function assertLicenseeVisible(licenseeId: string): Promise<boolean> {
  return isLicenseeVisible(licenseeId, scopeFromProfile(await getProfile()))
}

export async function assertAgencyVisible(agencyId: string): Promise<boolean> {
  return isAgencyVisible(agencyId, scopeFromProfile(await getProfile()))
}
