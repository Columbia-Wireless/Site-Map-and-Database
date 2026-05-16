'use client'

import { useState, useEffect } from 'react'
import { Users, UserPlus, Trash2, Shield, Building2, Mail, Download } from 'lucide-react'

type UserRole = 'super_admin' | 'admin' | 'editor' | 'reporter' | 'viewer'

interface UserRow {
  id: string
  role: UserRole
  full_name: string | null
  organization_id: string | null
  org_name: string | null
  can_export: boolean
  email?: string
}

interface Org { id: string; name: string }

const ROLES: UserRole[] = ['super_admin', 'admin', 'editor', 'reporter', 'viewer']

const ROLE_LABEL: Record<UserRole, string> = {
  super_admin: 'Super Admin',
  admin:       'Admin',
  editor:      'Editor',
  reporter:    'Reporter',
  viewer:      'Viewer',
}

const ROLE_COLOR: Record<UserRole, { bg: string; color: string }> = {
  super_admin: { bg: '#fef3c7', color: '#92400e' },
  admin:       { bg: '#ede9fe', color: '#5b21b6' },
  editor:      { bg: '#dbeafe', color: '#1d4ed8' },
  reporter:    { bg: '#dcfce7', color: '#15803d' },
  viewer:      { bg: '#f1f5f9', color: '#475569' },
}

export default function UsersClient({
  initialUsers,
  orgs,
  currentUserId,
  currentRole,
}: {
  initialUsers: UserRow[]
  orgs: Org[]
  currentUserId: string
  currentRole: UserRole
}) {
  const [users, setUsers] = useState<UserRow[]>(initialUsers)
  const [showInvite, setShowInvite] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<UserRole>('viewer')
  const [inviteOrg, setInviteOrg] = useState('')
  const [inviting, setInviting] = useState(false)
  const [inviteError, setInviteError] = useState('')
  const [inviteSuccess, setInviteSuccess] = useState('')
  const [saving, setSaving] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [globalError, setGlobalError] = useState('')

  const isSuperAdmin = currentRole === 'super_admin'

  // Fetch emails from admin API
  useEffect(() => {
    fetch('/api/admin/users')
      .then(r => r.json())
      .then(data => {
        if (data.users) {
          const emailMap: Record<string, string> = {}
          data.users.forEach((u: { id: string; email: string }) => { emailMap[u.id] = u.email })
          setUsers(prev => prev.map(u => ({ ...u, email: emailMap[u.id] ?? u.email })))
        }
      })
      .catch(() => {})
  }, [])

  async function handleRoleChange(userId: string, role: UserRole) {
    setSaving(userId)
    setGlobalError('')
    const res = await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: userId, role }),
    })
    const data = await res.json()
    setSaving(null)
    if (!res.ok) { setGlobalError(data.error ?? 'Failed to update role'); return }
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, role } : u))
  }

  async function handleOrgChange(userId: string, organization_id: string) {
    setSaving(userId)
    setGlobalError('')
    const res = await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: userId, organization_id: organization_id || null }),
    })
    const data = await res.json()
    setSaving(null)
    if (!res.ok) { setGlobalError(data.error ?? 'Failed to update org'); return }
    const org = orgs.find(o => o.id === organization_id)
    setUsers(prev => prev.map(u =>
      u.id === userId ? { ...u, organization_id: organization_id || null, org_name: org?.name ?? null } : u
    ))
  }

  async function handleExportToggle(userId: string, can_export: boolean) {
    setSaving(userId)
    setGlobalError('')
    const res = await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: userId, can_export }),
    })
    const data = await res.json()
    setSaving(null)
    if (!res.ok) { setGlobalError(data.error ?? 'Failed to update export permission'); return }
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, can_export } : u))
  }

  async function handleDelete(userId: string) {
    if (!confirm('Delete this user? This cannot be undone.')) return
    setDeleting(userId)
    setGlobalError('')
    const res = await fetch(`/api/admin/users?id=${userId}`, { method: 'DELETE' })
    const data = await res.json()
    setDeleting(null)
    if (!res.ok) { setGlobalError(data.error ?? 'Failed to delete user'); return }
    setUsers(prev => prev.filter(u => u.id !== userId))
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    setInviting(true)
    setInviteError('')
    setInviteSuccess('')
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: inviteEmail, role: inviteRole, organization_id: inviteOrg || null }),
    })
    const data = await res.json()
    setInviting(false)
    if (!res.ok) { setInviteError(data.error ?? 'Failed'); return }
    setInviteSuccess(`Invite sent to ${inviteEmail}`)
    setInviteEmail('')
    setInviteRole('viewer')
    setInviteOrg('')
  }

  return (
    <div style={{ padding: '32px', maxWidth: '1200px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ background: '#eff6ff', borderRadius: '10px', padding: '10px' }}>
            <Users size={22} color="#2563eb" />
          </div>
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a', margin: 0 }}>User Management</h1>
            <div style={{ fontSize: '13px', color: '#64748b', marginTop: '2px' }}>
              {users.length} user{users.length !== 1 ? 's' : ''}
            </div>
          </div>
        </div>
        <button
          onClick={() => { setShowInvite(!showInvite); setInviteError(''); setInviteSuccess('') }}
          style={{ display: 'flex', alignItems: 'center', gap: '7px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', padding: '10px 18px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
        >
          <UserPlus size={15} /> Invite User
        </button>
      </div>

      {globalError && (
        <div style={{ background: '#fee2e2', color: '#b91c1c', border: '1px solid #fca5a5', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', marginBottom: '16px' }}>
          {globalError}
        </div>
      )}

      {/* Invite panel */}
      {showInvite && (
        <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '20px', marginBottom: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a', marginBottom: '16px', marginTop: 0 }}>
            Invite New User
          </h2>
          <form onSubmit={handleInvite} style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ flex: '2 1 220px' }}>
              <label style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Email</label>
              <input
                type="email"
                required
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                placeholder="user@example.com"
                style={{ width: '100%', padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: '7px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ flex: '1 1 140px' }}>
              <label style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Role</label>
              <select
                value={inviteRole}
                onChange={e => setInviteRole(e.target.value as UserRole)}
                style={{ width: '100%', padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: '7px', fontSize: '13px', background: 'white', outline: 'none' }}
              >
                {ROLES.filter(r => isSuperAdmin || r !== 'super_admin').map(r => (
                  <option key={r} value={r}>{ROLE_LABEL[r]}</option>
                ))}
              </select>
            </div>
            <div style={{ flex: '1 1 140px' }}>
              <label style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Organization</label>
              <select
                value={inviteOrg}
                onChange={e => setInviteOrg(e.target.value)}
                style={{ width: '100%', padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: '7px', fontSize: '13px', background: 'white', outline: 'none' }}
              >
                <option value="">— none —</option>
                {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </div>
            <button
              type="submit"
              disabled={inviting}
              style={{ padding: '8px 18px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '7px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}
            >
              {inviting ? 'Sending…' : 'Send Invite'}
            </button>
          </form>
          {inviteError && <div style={{ marginTop: '10px', fontSize: '13px', color: '#b91c1c' }}>{inviteError}</div>}
          {inviteSuccess && <div style={{ marginTop: '10px', fontSize: '13px', color: '#15803d' }}>{inviteSuccess}</div>}
        </div>
      )}

      {/* Users table */}
      <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
              {['User', 'Role', 'Organization', 'Export Access', 'Actions'].map(h => (
                <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map((user, i) => {
              const roleStyle = ROLE_COLOR[user.role]
              const isSelf = user.id === currentUserId
              const isBusy = saving === user.id || deleting === user.id
              return (
                <tr key={user.id} style={{ background: i % 2 === 0 ? 'white' : '#fafafa', borderBottom: '1px solid #f1f5f9' }}>
                  {/* User */}
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <span style={{ fontSize: '13px', fontWeight: 700, color: '#2563eb' }}>
                          {(user.full_name || user.email || '?')[0].toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a' }}>
                          {user.full_name || <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>No name</span>}
                          {isSelf && <span style={{ marginLeft: '6px', fontSize: '10px', background: '#dbeafe', color: '#1d4ed8', padding: '2px 6px', borderRadius: '10px', fontWeight: 600 }}>You</span>}
                        </div>
                        <div style={{ fontSize: '12px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Mail size={11} />
                          {user.email ?? <span style={{ fontStyle: 'italic' }}>loading…</span>}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Role */}
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 600, padding: '3px 8px', borderRadius: '12px', background: roleStyle.bg, color: roleStyle.color, whiteSpace: 'nowrap' }}>
                        <Shield size={10} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />
                        {ROLE_LABEL[user.role]}
                      </span>
                      {!isSelf && (
                        <select
                          value={user.role}
                          disabled={isBusy}
                          onChange={e => handleRoleChange(user.id, e.target.value as UserRole)}
                          style={{ fontSize: '12px', padding: '4px 6px', border: '1px solid #e2e8f0', borderRadius: '6px', background: 'white', color: '#334155', cursor: 'pointer', outline: 'none' }}
                        >
                          {ROLES.filter(r => isSuperAdmin || r !== 'super_admin').map(r => (
                            <option key={r} value={r}>{ROLE_LABEL[r]}</option>
                          ))}
                        </select>
                      )}
                    </div>
                  </td>

                  {/* Organization */}
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {user.org_name && (
                        <span style={{ fontSize: '12px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Building2 size={12} />
                          {user.org_name}
                        </span>
                      )}
                      {!isSelf && (
                        <select
                          value={user.organization_id ?? ''}
                          disabled={isBusy}
                          onChange={e => handleOrgChange(user.id, e.target.value)}
                          style={{ fontSize: '12px', padding: '4px 6px', border: '1px solid #e2e8f0', borderRadius: '6px', background: 'white', color: '#334155', cursor: 'pointer', outline: 'none' }}
                        >
                          <option value="">— none —</option>
                          {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                        </select>
                      )}
                    </div>
                  </td>

                  {/* Export Access */}
                  <td style={{ padding: '12px 16px' }}>
                    {!isSelf ? (
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: isBusy ? 'not-allowed' : 'pointer' }}>
                        <div
                          onClick={() => !isBusy && handleExportToggle(user.id, !user.can_export)}
                          style={{
                            width: '36px', height: '20px', borderRadius: '10px',
                            background: user.can_export ? '#16a34a' : '#cbd5e1',
                            position: 'relative', transition: 'background 0.2s', flexShrink: 0,
                            opacity: isBusy ? 0.5 : 1,
                          }}
                        >
                          <div style={{
                            position: 'absolute', top: '2px',
                            left: user.can_export ? '18px' : '2px',
                            width: '16px', height: '16px', borderRadius: '50%',
                            background: 'white', transition: 'left 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
                          }} />
                        </div>
                        {user.can_export ? (
                          <span style={{ fontSize: '12px', color: '#16a34a', display: 'flex', alignItems: 'center', gap: '3px', fontWeight: 500 }}>
                            <Download size={11} /> Enabled
                          </span>
                        ) : (
                          <span style={{ fontSize: '12px', color: '#94a3b8' }}>Disabled</span>
                        )}
                      </label>
                    ) : (
                      <span style={{ fontSize: '12px', color: '#94a3b8' }}>—</span>
                    )}
                  </td>

                  {/* Actions */}
                  <td style={{ padding: '12px 16px' }}>
                    {!isSelf && (
                      <button
                        onClick={() => handleDelete(user.id)}
                        disabled={isBusy}
                        title="Delete user"
                        style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'transparent', border: '1px solid #fca5a5', color: '#dc2626', borderRadius: '6px', padding: '5px 10px', fontSize: '12px', fontWeight: 500, cursor: 'pointer', opacity: isBusy ? 0.5 : 1 }}
                      >
                        <Trash2 size={13} />
                        {deleting === user.id ? 'Deleting…' : 'Delete'}
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {users.length === 0 && (
          <div style={{ padding: '48px', textAlign: 'center', color: '#94a3b8', fontSize: '14px' }}>
            No users found.
          </div>
        )}
      </div>

      {/* Role legend */}
      <div style={{ marginTop: '24px', background: 'white', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px 20px' }}>
        <div style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Role Permissions</div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {[
            { role: 'super_admin' as UserRole, desc: 'Full access + manage all users' },
            { role: 'admin' as UserRole,       desc: 'Manage users in their org' },
            { role: 'editor' as UserRole,      desc: 'Upload, extract, approve, notarize' },
            { role: 'reporter' as UserRole,    desc: 'View reports & export data' },
            { role: 'viewer' as UserRole,      desc: 'Read-only access' },
          ].map(({ role, desc }) => {
            const s = ROLE_COLOR[role]
            return (
              <div key={role} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: s.bg, color: s.color, padding: '5px 10px', borderRadius: '8px', fontSize: '12px' }}>
                <span style={{ fontWeight: 700 }}>{ROLE_LABEL[role]}:</span>
                <span style={{ opacity: 0.8 }}>{desc}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
