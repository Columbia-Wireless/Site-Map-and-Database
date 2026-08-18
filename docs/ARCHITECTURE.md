# Architecture

Internal technical reference for Columbia Wireless Site Asset Management. Audience: developers working on this codebase (VeriPura, and SAM 2.0 integration partners). For the client-facing feature walkthrough, see `Columbia_Wireless_User_Guide.docx` in the project root instead, this document assumes familiarity with the code.

Last reviewed: 2026-08-18. This file is covered by the weekly scheduled documentation review, if it looks stale, that job may have lapsed, check with Thomas.

## Stack

- **Framework**: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4.
- **Backend**: Supabase (Postgres + Auth + Storage). No separate backend service, Next.js API routes (`app/api/**/route.ts`) talk to Supabase directly.
- **Hosting**: Google Cloud Run, project `scetv-towers-2025`, region `us-east1`, service name `tower-demo`.
- **Deploy command**: `gcloud run deploy tower-demo --source "." --region us-east1 --project scetv-towers-2025` (Dockerfile-based, no CI pipeline yet, deploys are manual from a developer's machine).
- **AI extraction**: Anthropic API (`@anthropic-ai/sdk`), used directly by the legacy document-extraction routes (`app/api/sites/[id]/documents/[docId]/extract`, `app/api/sites/extract-from-lease`, `app/api/sites/[id]/comparables/extract`). Requires `ANTHROPIC_API_KEY`.
- **External integration**: SAM 2.0 (separate app, built by Onno Stienen), embedded via iframe. Sync mechanism is transitioning from the iframe event to a server-side webhook (infrastructure not yet built on SAM 2.0's side as of 2026-08-18). See `SAM2_INTEGRATION.md`.
- **Blockchain notarization**: IOTA SDK (`@iota/iota-sdk`), used by the document notarization flow (`app/api/sites/[id]/documents/[docId]/notarize`) to anchor a document's SHA-256 hash on-chain.
- **Mapping**: Leaflet / react-leaflet.
- **PDF/report generation**: `@react-pdf/renderer`, `pdf-parse`.

## Deployment

The Dockerfile is a 3-stage build (deps → build → runner) producing a Next.js standalone server. Two things worth knowing if you're debugging a deploy:

1. **Only `NEXT_PUBLIC_*` vars are baked in at build time** (passed as Docker `ARG`s: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`). `NEXT_PUBLIC_SAM2_URL` is *not* passed as a build arg, which is why `components/sam2/Sam2LeaseModule.tsx` has a hardcoded production-URL fallback instead of relying on the env var alone, see the comment there before "fixing" it by just setting the env var, that won't survive a rebuild.
2. **Cloud Run's internal container address (`0.0.0.0:8080`) can leak into user-facing redirects** if code builds an absolute URL from `request.url`/`request.nextUrl.origin` naively. This has bitten this codebase twice (`proxy.ts`, then `app/auth/callback/route.ts`). The fix pattern used in both places: resolve the public origin from, in order, the `SITE_URL` env var, then `x-forwarded-host`, then the `host` header (rejecting anything starting with `0.0.0.0`), then fall back to `request.nextUrl.origin` as a last resort. Copy this pattern rather than reinventing it if a third place needs it.

## Multi-tenancy: organization scoping

Every organization (`organizations` table) sees only its own data. The pattern lives in `lib/orgScope.ts`:

- `scopeFromProfile(profile)` → `{ organizationId, isPlatformAdmin }`.
- `scopeSitesQuery(query, scope)` → appends `.eq('organization_id', ...)` to a `tower_sites` query builder, no-ops for platform admins.
- `getVisibleSiteIds(scope)` → resolves the list of visible site IDs, used to scope child tables (documents, licenses, equipment, etc.) that don't carry `organization_id` directly, they're scoped transitively through `site_id`.
- `assertSiteVisible(siteId)` → the one-call guard used at the top of nearly every site-scoped API route.
- `isLicenseeVisible` / `isAgencyVisible` → licensees and owners (`state_agencies`) are *shared reference tables* with no `organization_id` of their own. Visibility is derived: a licensee/owner is visible if it has at least one tenancy/site inside the caller's org, or if it has zero ties anywhere (a new/unlinked record can't leak another org's data).

**`is_platform_admin`** on the `organizations` row bypasses all of the above. This is how VeriPura's own super-admin accounts see every client's data. Only the `VeriPura` organization should ever have this set, see `RESTRICTED_ORG_DOMAINS` in `app/api/admin/users/route.ts`, which hard-restricts that org to `@veripura.com` emails specifically because of this bypass.

**Important limitation**: this pattern is only as good as each route's discipline about calling it. It is not enforced by Postgres Row-Level Security, most routes use the Supabase **service-role key**, which bypasses RLS entirely, so there's no backstop if a route forgets the check. See `API_REFERENCE.md` for which routes actually call it and which don't.

## Auth

- **Providers**: Google OAuth, Microsoft OAuth, Supabase email/password (invite-based), magic link / password recovery.
- **Session handling**: `@supabase/ssr`, cookie-based sessions, refreshed on every request by `proxy.ts`.
- **Roles**: `super_admin > admin > editor > reporter > viewer`, stored on `profiles.role`. Rank comparison lives in `lib/profile.ts` (`ROLE_RANK`, `hasRole`, `canEdit`, `canReport`, `isAdmin`, `isSuperAdmin`, `canExport`). `canExport` is special, it's true for admin+ *or* any user with the separate `profiles.can_export` flag set, independent of role.
- **Invite flow**: `admin.auth.admin.inviteUserByEmail`, redirects through `/auth/callback?next=/reset-password`, this specific route is exempt from the proxy.ts auth-wall so the one-time invite session survives the redirect chain.
- **MFA**: TOTP via Supabase Auth. Enforced (not optional) for `admin`/`super_admin` roles, see `proxy.ts`, if such a user has no TOTP factor enrolled, every route redirects them to `/settings?mfaRequired=1` until they enroll.
- **"Not provisioned" handling**: Google/Microsoft OAuth authenticates anyone with a valid account on that provider, it does *not* require an admin to have created a `profiles` row first. `proxy.ts` explicitly checks for this (`profileRow` lookup) and signs the user back out with `?error=not_provisioned` if their profile is missing, rather than letting them reach an empty, org-scoped-to-nothing dashboard.

### `proxy.ts`'s blind spot: API routes are not covered

The middleware `matcher` explicitly excludes `api/`:

```
'/((?!_next/static|_next/image|favicon.ico|api/|...).*)'
```

None of the login-wall, MFA enforcement, or not-provisioned checks in `proxy.ts` run for anything under `/api/`. Every API route is individually responsible for its own auth. This is by design (route handlers need fine-grained control, e.g. public OGC endpoints), but it means a route that forgets to call `getProfile()` is reachable by anyone, logged in or not. See `API_REFERENCE.md` for the current, route-by-route state of this, several routes currently have no check at all.

## Key library files

| File | Purpose |
|---|---|
| `lib/profile.ts` | `getProfile()` (current user + role + org), role/permission helper functions. |
| `lib/orgScope.ts` | Multi-tenant scoping helpers, see above. |
| `lib/supabase.ts` | Supabase client factories (`getSupabase()` browser/server client, `getServiceClient()` service-role client). |
| `lib/audit.ts` | `logChange()` — writes to `site_change_log` via a dedicated service-role client so RLS can't silently swallow an audit write. |
| `lib/logDocEvent.ts` | Writes to `document_events` (document lifecycle log, separate from the general audit log). |
| `lib/sam2Match.ts` | Fuzzy-matching logic for resolving a SAM 2.0-extracted owner/licensee name against existing `state_agencies`/`licensees` rows. |
| `lib/sam2Types.ts` | TypeScript types for the SAM 2.0 sync payload. See `SAM2_INTEGRATION.md`. |
| `lib/report-fields.ts` | Column/label definitions shared by the report builder and report runner. |
| `proxy.ts` | Next.js middleware, session refresh, login wall, MFA enforcement, not-provisioned check. |

## Known architectural debt

- `supabase/schema.sql` is stale and does not reflect the live database. Don't trust it, see `DATA_MODEL.md`, which was reconstructed from actual code usage instead.
- No CI/test pipeline. Deploys are manual (`gcloud run deploy --source .`) from a developer's machine, with no automated check in between.
- No staging environment, `tower-demo` on Cloud Run is the only deployed environment.
- Several API routes have no auth/permission checks (see `API_REFERENCE.md`, "Known gaps" section). Role-based UI restrictions (viewer vs. editor, etc.) are enforced almost entirely client-side, not on the server.
