import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://vfntpdpneusqgcwxwkix.supabase.co'
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZmbnRwZHBuZXVzcWdjd3h3a2l4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5NTg2MzEsImV4cCI6MjA5MzUzNDYzMX0.kFZ6b2WKAl7GVsEQZeO33qcxhyBruQlTfW0eZfkcg1c'

export type UserRole = 'super_admin' | 'admin' | 'editor' | 'reporter' | 'viewer'

export interface UserProfile {
  id: string
  role: UserRole
  full_name: string | null
  organization_id: string | null
  org_name: string | null
  can_export: boolean
}

/** Get the profile of the currently logged-in user (server component / route handler). */
export async function getProfile(): Promise<UserProfile | null> {
  const cookieStore = await cookies()

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() { return cookieStore.getAll() },
      setAll() { /* read-only in server components */ },
    },
  })

  // getSession() reads the JWT from cookies without a network round-trip.
  // The middleware (proxy.ts) already verified the JWT, so this is safe.
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user) return null
  const user = session.user

  const { data } = await supabase
    .from('profiles')
    .select('id, role, full_name, organization_id, can_export, organizations(name)')
    .eq('id', user.id)
    .single()

  if (!data) return null

  return {
    id: data.id,
    role: data.role as UserRole,
    full_name: data.full_name,
    organization_id: data.organization_id,
    org_name: (data.organizations as any)?.name ?? null,
    can_export: (data as any).can_export ?? false,
  }
}

// ─── Permission helpers ───────────────────────────────────────────────────────

const ROLE_RANK: Record<UserRole, number> = {
  super_admin: 5,
  admin:       4,
  editor:      3,
  reporter:    2,
  viewer:      1,
}

export function hasRole(profile: UserProfile | null, min: UserRole): boolean {
  if (!profile) return false
  return ROLE_RANK[profile.role] >= ROLE_RANK[min]
}

/** Can upload, extract, approve, notarize documents */
export function canEdit(profile: UserProfile | null): boolean {
  return hasRole(profile, 'editor')
}

/** Can view reports and export data */
export function canReport(profile: UserProfile | null): boolean {
  return hasRole(profile, 'reporter')
}

/** Can manage users */
export function isAdmin(profile: UserProfile | null): boolean {
  return hasRole(profile, 'admin')
}

export function isSuperAdmin(profile: UserProfile | null): boolean {
  return profile?.role === 'super_admin'
}

export function canExport(profile: UserProfile | null): boolean {
  if (!profile) return false
  return profile.can_export || hasRole(profile, 'admin')
}
