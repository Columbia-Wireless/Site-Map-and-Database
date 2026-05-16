export const dynamic = 'force-dynamic'

import { getSupabase } from '@/lib/supabase'
import { getProfile, isAdmin } from '@/lib/profile'
import { redirect } from 'next/navigation'
import UsersClient from '@/components/admin/UsersClient'

export default async function UsersPage() {
  const profile = await getProfile()
  if (!isAdmin(profile)) redirect('/dashboard')

  const supabase = getSupabase()

  const [{ data: users }, { data: orgs }] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, role, full_name, organization_id, can_export, organizations(name)')
      .order('created_at'),
    supabase.from('organizations').select('id, name').order('name'),
  ])

  return (
    <UsersClient
      initialUsers={(users ?? []).map((u: any) => ({
        id: u.id,
        role: u.role,
        full_name: u.full_name,
        organization_id: u.organization_id,
        org_name: u.organizations?.name ?? null,
        can_export: u.can_export ?? false,
      }))}
      orgs={orgs ?? []}
      currentUserId={profile!.id}
      currentRole={profile!.role}
    />
  )
}
