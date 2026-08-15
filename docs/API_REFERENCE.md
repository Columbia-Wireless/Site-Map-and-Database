# API Reference

Every route under `app/api/**/route.ts` (49 files), what it does, and its actual permission gating as of this review. Read this alongside `ARCHITECTURE.md`'s note on `proxy.ts` excluding `/api/` from its auth wall, every route below is responsible for its own protection, there is no implicit login-wall or role check unless the route calls for one itself. Most routes use the Supabase **service-role key**, which bypasses Postgres RLS, so RLS is not a backstop either.

Last reviewed: 2026-08-14.

**Legend**
- **Role-gated**: checks `role` / `ROLE_RANK` / `canEdit` / `canExport` / `isSuperAdmin`.
- **Org/visibility-gated**: checks `assertSiteVisible` / `assertLicenseeVisible` / `assertAgencyVisible` / `isSiteVisible` / `scopeSitesQuery` (organization match), but not role.
- **Auth-only**: requires a logged-in session, nothing more.
- **None**: no check of any kind. Reachable by anyone, logged in or not.

## Admin

| Route | Methods | Description | Permission check |
|---|---|---|---|
| `/api/admin/reset` | POST | Wipes all sites/owners/licensees/licenses/documents/media + storage | **Role-gated**: `isSuperAdmin`. Fixed 2026-08-14, previously had no check at all. |
| `/api/admin/users` | GET, POST, PATCH, DELETE | List/invite/update-role/delete platform users | **Role-gated**: admin+ (`ROLE_RANK >= 4`). Super-admin-only to grant `super_admin`. `assertOrgEmailAllowed` enforces the `@veripura.com` restriction on the VeriPura org. Self-delete blocked. |

## Audit

| Route | Methods | Description | Permission check |
|---|---|---|---|
| `/api/audit` | GET | Query `site_change_log` with filters | **Role-gated**: admin+. |
| `/api/audit/mfa-event` | POST | Log MFA enroll/unenroll/challenge event | **Auth-only**. |
| `/api/audit/report-event` | POST | Log `report_downloaded` event | **Auth-only**. |

## Auth

| Route | Methods | Description | Permission check |
|---|---|---|---|
| `/api/auth/logout` | POST | Sign out + audit log | No check required to call; logs an event only if a session exists. |

## Sites

| Route | Methods | Description | Permission check |
|---|---|---|---|
| `/api/sites` | POST | Create a site | **Auth-only.** Any logged-in user, any role, can create a site. |
| `/api/sites/[id]` | GET, PATCH | Read/update a site + per-field audit diff | **Org/visibility-gated** only. No role check on PATCH. |
| `/api/sites/[id]/audit` | GET | Site's change history | **Org/visibility-gated.** |
| `/api/sites/geojson` | GET | GeoJSON of visible sites | Org-scoped via `scopeSitesQuery`; unauthenticated callers get an empty result rather than an explicit 401 (fails closed, but not explicitly). |
| `/api/sites/extract-from-lease` | POST | Claude-based PDF lease extraction (pre-site-creation) | **None.** Unauthenticated, and it spends Anthropic API credits per call. |
| `/api/sites/[id]/tenancies` | GET, POST | List/create `site_licenses` rows | **Org/visibility-gated** only. |
| `/api/sites/[id]/tenancies/[tenancyId]` | PATCH, DELETE | Update/delete a `site_licenses` row | **Org/visibility-gated** only. |
| `/api/sites/[id]/equipment` | GET, POST | List/create equipment | **Org/visibility-gated** only. |
| `/api/sites/[id]/equipment/[itemId]` | PATCH, DELETE | Update/delete equipment | **Org/visibility-gated** only. |
| `/api/sites/[id]/media` | GET, POST | List/upload media | **Org/visibility-gated** only. |
| `/api/sites/[id]/media/[mediaId]` | PATCH, DELETE | Update/delete media | **Org/visibility-gated** only. |
| `/api/sites/[id]/media/sign` | GET | Issue a signed Storage upload URL | **None.** No visibility or auth check, any caller can get a signed upload URL for any site ID. |
| `/api/sites/[id]/comparables` | GET | Distance-ranked internal comparables | **Org/visibility-gated** only. |
| `/api/sites/[id]/comparables/external` | GET, POST | List/create manual comparables | **Org/visibility-gated** + auth-only on POST. No role check. |
| `/api/sites/[id]/comparables/external/[extId]` | PATCH, DELETE | Update (incl. approve) / delete a comparable | Same as above, any logged-in org member can "approve" a comparable. |
| `/api/sites/[id]/comparables/extract` | POST | Claude-based PDF comparable extraction | **None.** No visibility check, no auth check at all. |
| `/api/sites/[id]/documents` | GET, POST | List/create document metadata | **Org/visibility-gated** only. |
| `/api/sites/[id]/documents/[docId]` | GET, DELETE | Signed view URL / delete doc + storage file | **Org/visibility-gated** only. |
| `/api/sites/[id]/documents/[docId]/approve` | POST | Mark a document approved | **Org/visibility-gated** only. No role check on this sensitive action. |
| `/api/sites/[id]/documents/[docId]/events` | GET | List document lifecycle events | **Org/visibility-gated** only. |
| `/api/sites/[id]/documents/[docId]/extract` | POST | Claude PDF/image term extraction | **Org/visibility-gated** only. No role check on an LLM call + DB write. |
| `/api/sites/[id]/documents/[docId]/notarize` | POST | Submit document hash to IOTA | **Org/visibility-gated** only. No role check on a blockchain write. Requires `doc_status === 'approved'` first (a workflow gate, not a permission gate). |
| `/api/sites/[id]/documents/[docId]/terms` | PATCH | Edit one extracted-term field | **Org/visibility-gated** only. |

## Owners (`state_agencies`)

| Route | Methods | Description | Permission check |
|---|---|---|---|
| `/api/owners` | POST | Create an owner | **None.** No auth, no role, no org check at all. |
| `/api/owners/[id]` | PATCH, DELETE | Update/delete an owner | **Org/visibility-gated** only. Delete blocked if sites still reference it. |
| `/api/owners/[id]/audit` | GET | Owner's change history | **Org/visibility-gated** only. |

## Licensees

| Route | Methods | Description | Permission check |
|---|---|---|---|
| `/api/tenants` | POST | Create a licensee | **None.** Same as owners, no check at all. |
| `/api/tenants/[id]` | PATCH, DELETE | Update/delete a licensee | **Org/visibility-gated** only. Delete blocked if active licenses exist. |
| `/api/tenants/[id]/audit` | GET | Licensee's change history | **Org/visibility-gated** only. |

## Reports

| Route | Methods | Description | Permission check |
|---|---|---|---|
| `/api/reports/run` | POST | Ad-hoc report runner | **Auth-only**, plus enforces the *client-submitted* `min_role` against the caller's rank. No org scoping on the underlying queries, see gap below. |
| `/api/reports/saved` | GET, POST | List (role-filtered)/create saved reports | GET: auth-only. POST: **role-gated**, admin+. |
| `/api/reports/saved/[id]` | PATCH, DELETE | Update/delete a saved report | **Role-gated**, admin+. |

## Export

| Route | Methods | Description | Permission check |
|---|---|---|---|
| `/api/export/agency/[id]` | GET | CSV export of one owner's sites+licenses | **Role-gated** (`canExport`) + org/visibility-gated. |
| `/api/export/sites` | GET | CSV export of all visible sites | **Role-gated** (`canExport`), org-scoped. |

## Field module

| Route | Methods | Description | Permission check |
|---|---|---|---|
| `/api/field/photos` | GET, POST, DELETE | List/upload/delete survey photos | **Org/visibility-gated** only. No role check. |
| `/api/field/surveys` | GET, POST | List/create-or-update surveys | **Org/visibility-gated** only. |

## SAM 2.0 / Search

| Route | Methods | Description | Permission check |
|---|---|---|---|
| `/api/sam2/sync` | POST | Idempotent upsert from a SAM 2.0 payload | **Role-gated** (`canEdit`, editor+), requires `organization_id` on the caller's profile. The most consistently-gated write route in the app outside admin/reports. |
| `/api/search` | GET | Global search across sites/licensees/agencies/users | **Auth-only** for sites/licensees/agencies, and **these three are not org-scoped at all**, any logged-in user of any org sees hits from every org. `users` results are separately role- and org-gated. |

## OGC (public geospatial feed)

| Route | Methods | Description | Permission check |
|---|---|---|---|
| `/api/ogc`, `/api/ogc/conformance`, `/api/ogc/collections`, `/api/ogc/collections/sites` | GET | Static API metadata | **None**, intentionally public (`Access-Control-Allow-Origin: *`), implements the public OGC API-Features spec. |
| `/api/ogc/collections/sites/items` | GET | GeoJSON of **all** `tower_sites`, every organization | **None.** No auth, no org scoping. |
| `/api/ogc/collections/sites/items/[featureId]` | GET | Single site as a GeoJSON Feature | **None.** No auth, no org scoping. |

The public-feed pattern is likely intentional (it's implementing a public spec), but as built it means every organization's site data, not just the operator's own, is reachable anonymously with no filtering. Worth explicitly confirming this is intended rather than assuming it.

## Misc

| Route | Methods | Description | Permission check |
|---|---|---|---|
| `/api/log-error` | POST | Forward client error reports to Cloud Error Reporting | **None**, intentionally open telemetry sink. |

---

## Known gaps, prioritized

**No check at all (reachable by anyone, logged in or not):**
- `POST /api/owners`, `POST /api/tenants`, no login required to create records.
- `GET /api/sites/[id]/media/sign`, hands out a Storage signed-upload URL for any site ID.
- `POST /api/sites/[id]/comparables/extract`, `POST /api/sites/extract-from-lease`, unauthenticated, and both burn Anthropic API credits per call.
- The two OGC item routes, all organizations' site data, not just the operator's own, exposed with no auth.

**Logged in, but no role or org check (any authenticated user, any org, can act):**
- `/api/search`, sites/licensees/agencies results leak across organizations.

**Logged in and org-scoped, but no role check (a viewer-role account can do editor-level things if they reach the endpoint directly):**
- Site create/edit, tenancy/equipment/media CRUD, document approve/extract/notarize/terms-edit, external-comparable approval, field photos/surveys. This mirrors the pattern `/api/admin/reset` used to have before it was fixed, the frontend hides the buttons, but the API never checks.

`/api/sam2/sync`, the two export routes, `/api/admin/users`, `/api/admin/reset`, `/api/audit`, and `/api/reports/saved*` are the only write/sensitive routes with real role enforcement today.
