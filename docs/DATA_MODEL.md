# Data Model

Reconstructed from actual `.from()` / `.select()` / `.insert()` / `.update()` call sites across `app/api/**`, `app/**/page.tsx`, `components/**`, and `lib/**`, not from `supabase/schema.sql`.

**`supabase/schema.sql` is stale and should not be trusted.** It reflects an early, pre-multi-tenant shape (flat `tenant_name`/`owner_name`/`annual_rent` columns directly on `tower_sites`, no `organization_id`, no `site_licenses`, no `licensees` as a separate table). `supabase/sam2_integration.sql` is a partial, more current diff (adds the SAM 2.0 columns below) but doesn't cover the schema as a whole. If you need the real, current schema, either read this document or query Supabase directly, don't regenerate documentation from `schema.sql` without checking it against actual usage first. Regenerating a real `schema.sql` from a live `pg_dump` is worth doing at some point, it isn't done today.

Last reviewed: 2026-08-14.

## Tables

### `organizations`
Multi-tenant root.

| Column | Notes |
|---|---|
| `id` | PK |
| `name` | e.g. `CWF`, `VeriPura` |
| `is_platform_admin` | bool. Bypasses org scoping entirely, see `ARCHITECTURE.md`. Should only ever be true for VeriPura. |
| `owner_label_singular` / `owner_label_plural` | Per-org UI label override for "Owner"/"Owners" (client-configurable display term for `state_agencies`). |

No API route writes this table, changes are made directly in Supabase.

### `profiles`
PK `id` = Supabase auth user id.

| Column | Notes |
|---|---|
| `id` | FK → auth.users |
| `role` | `super_admin \| admin \| editor \| reporter \| viewer` |
| `full_name` | |
| `organization_id` | FK → `organizations.id` |
| `can_export` | bool, independent of role, see `canExport()` in `lib/profile.ts` |

Written by `app/api/admin/users/route.ts` (upsert on invite, patch on role/org/export change).

### `tower_sites`
Core site table.

| Column | Notes |
|---|---|
| `id`, `site_code`, `name` | |
| `address`, `city`, `state`, `zip`, `county` | |
| `lat`, `lng` | Default to `0` (not null) when SAM 2.0 sync has no geocode. |
| `host_agency_id` | FK → `state_agencies.id` (the "Owner" in UI) |
| `tower_type` | `monopole \| lattice \| rooftop \| water_tower \| guyed \| small_cell` |
| `height_ft` | |
| `status` | `operational \| offline \| under_construction \| decommissioned` |
| `tenant_slots`, `notes` | |
| `organization_id` | FK → `organizations.id` |
| `sam2_site_id` | unique, SAM 2.0 idempotency key |
| `created_at` / `updated_at` | |

No more `tenant_name`/`owner_name`/`lease_start`/`annual_rent` on this table, those live on `site_licenses` now.

### `site_licenses`
The actual tenancy/lease-term table (`SiteTenancy` in `lib/types.ts`).

**As of the rent engine migration (see `supabase/rent_engine_schema.sql`), `annual_rent`, `escalation_rate`, `escalation_detail`, `license_start`, and `license_end` are a CACHED SNAPSHOT of the latest synced document's terms — fine for quick display/reports, but no longer the calculation input.** The real rent calculator (`lib/rentEngine/`) reads the full document chain instead, via `site_documents.license_id`. `schedule_cache`/`schedule_computed_at` hold the engine's actual last-computed output.

| Column | Notes |
|---|---|
| `id`, `site_id` (FK → `tower_sites`), `licensee_id` (FK → `licensees`) | |
| `contract_type`, `invoice_method`, `mount_type`, `antenna_height_ft` | |
| `annual_rent` | numeric. Cached snapshot only — see note above. |
| `escalation_rate` | numeric, percent. Cached snapshot only — see note above. |
| `license_start`, `license_end` | Cached snapshot only — see note above. |
| `schedule_cache` | jsonb. `{ rows, oneTimeCharges, issues }` from `generateRentSchedule()`. |
| `schedule_computed_at` | timestamptz. When `schedule_cache` was last computed. |
| `status` | `active \| pending \| expiring_soon \| expired \| terminated` |
| `notes` | |
| `document_id` | FK → `site_documents.id`, nullable, links the backing lease PDF |
| `sam2_agreement_id` | unique, SAM 2.0 idempotency key |
| `escalation_detail` | jsonb: `{type, value, frequencyMonths, appliesToInitialTerm, appliesToRenewalTerms, firstEscalationDate}` |
| `renewal_detail` | jsonb: `{count, durationMonths, isAutomatic, noticePeriodMonths}` |
| `one_time_fees` | jsonb array |
| `created_at` / `updated_at` | |

**Legacy rent calculator (being replaced, see `lib/rentEngine/`)**: `components/reports/ReportsClient.tsx` computes projected/current rent client-side, at report-run time, as:

```
annual_rent * (1 + escalation_rate / 100) ^ years_elapsed
```

(`ReportsClient.tsx:1192`, and repeated at `:513`, `:750`, `:753`; same pattern in `components/reports/ImpactSimulator.tsx:103/107`.) Nothing else feeds this. Critically, **`escalation_detail` is not read by the calculator**, only the flat `annual_rent`/`escalation_rate` pair is. `app/api/sam2/sync/route.ts`'s `simplifyEscalationRate()` exists specifically to flatten any non-fixed-percentage SAM 2.0 escalation clause down to `escalation_rate: 0` (with a warning) so this legacy calculator keeps working, this is also why CPI-indexed and mixed escalation types don't calculate correctly today, see `SAM2_INTEGRATION.md`.

### `licensees`
Carriers/tenants (`Tenant` in `lib/types.ts`). Shared reference table, not org-scoped directly, visibility is derived (see `ARCHITECTURE.md`).

| Column |
|---|
| `id`, `name`, `status` |
| `hq_address`, `hq_city`, `hq_state`, `hq_zip` |
| `account_manager_name`, `account_manager_email`, `account_manager_phone` |
| `notes`, `created_at`, `updated_at` |

### `state_agencies`
Owners/host agencies (UI label "Owner", client-configurable). Same shared/derived-visibility pattern as `licensees`, via `tower_sites.host_agency_id`.

| Column |
|---|
| `id`, `name` |
| `type`: `municipality \| federal \| state \| utility \| private \| corporate \| nonprofit \| other` |
| `contact_name`, `contact_email`, `contact_phone` |
| `address`, `city`, `state`, `zip`, `notes` |
| `status`: `active \| inactive` |
| `created_at`, `updated_at` |

### `site_documents`

| Column | Notes |
|---|---|
| `id`, `site_id` (FK) | |
| `name` | |
| `doc_type` | `lease \| amendment \| addendum \| coi \| fcc_license \| structural \| title \| survey \| correspondence \| other` |
| `uploaded_by`, `uploaded_at` | |
| `file_size_kb` | |
| `storage_path` | Supabase Storage key, bucket `lease-documents` |
| `file_hash` | SHA-256, used for notarization |
| `parent_document_id` | self-FK, amendment chains (legacy upload path) |
| `license_id` | FK → `site_licenses.id`, added by `rent_engine_schema.sql`. Links a document to the agreement it belongs to, so the rent engine can pull every document for one lease chain as a single `DocumentRecord[]`. Populated by `app/api/sam2/sync/route.ts` on sync; nullable for documents not tied to a specific lease (photos, plots, etc.). |
| `doc_status` | `uploaded \| extracting \| review_required \| extracted \| approved \| notarized` |
| `extracted_terms` | jsonb, `{field: {value, confidence, note?}}` shape. Also holds `_address_check` and `_sam2_raw` meta keys. |
| `iota_block_id`, `iota_explorer_url` | blockchain notarization receipt |
| `sam2_doc_id` | unique, SAM 2.0 idempotency key |

### `document_events`
Append-only lifecycle log for a document, separate from the general audit log. `id`, `document_id` (FK), `event_type` (`uploaded \| terms_extracted \| field_edited \| approved \| notarized`), `user_name`, `details` (jsonb), `created_at`. Written via `lib/logDocEvent.ts`.

### `site_media`
`id`, `site_id` (FK), `name`, `media_type` (`photo \| video \| document`), `file_path` (bucket `site-media`), `mime_type`, `file_size_kb`, `description`, `uploaded_by`, `uploaded_at`.

### `site_change_log`
The general audit trail, dual-purpose for site edits and owner/licensee/report/auth events. `id`, `site_id` (nullable), `entity_id` (nullable), `entity_type` (`site \| owner \| licensee \| auth \| report \| system`), `field_name`, `old_value`, `new_value`, `changed_by`, `user_id` (nullable), `ip_address`, `changed_at`. All writes go through `lib/audit.ts: logChange()` on a dedicated service-role client.

### `equipment_items`
`id`, `site_id` (FK), `license_id` (FK → `site_licenses`, nullable), `equipment_type`, `manufacturer`, `model`, `quantity`, `install_date`, `location_description`, `fcc_id`, `notes`, `created_at`.

### `external_comparables`
`id`, `site_id` (FK), `created_by`, `status` (`pending \| approved`), `approved_by`, `approved_at`, `updated_at`, plus free-form comparable fields spread from the request body (no fixed column list enforced server-side beyond the ones listed).

### `site_surveys`
Field module survey drafts/results. `id`, `site_id` (FK), `surveyor_id`, `surveyor_name`, `status` (`in_progress \| completed`), `gps_lat`, `gps_lng`, `gps_accuracy_meters`, `gps_delta_meters`, `gps_matched`, `tower_data`, `security_data`, `infrastructure_data`, `generator_data`, `maintenance_data` (all jsonb), `notes`, `completed_at`, `created_at`.

### `site_photos`
`id`, `site_id` (FK), `survey_id` (FK → `site_surveys`, nullable), `uploaded_by` (nullable), `uploaded_by_name`, `storage_path` (bucket `site-media`, prefix `photos/{siteId}/...`), `public_url`, `category`, `caption`, `file_size_bytes`, `mime_type`, `created_at`.

### `saved_reports`
Admin-configured custom reports. `id`, `name`, `description`, `data_source` (`sites \| licensees \| agencies \| licenses \| audit`), `columns` (text[]), `filters` (jsonb array of `{field, op, value}`), `sort_field`, `sort_dir`, `min_role` (viewers below this role don't see it), `created_by`, `created_at`, `updated_at`.

### `contacts`
`id`, `entity_type` (`owner \| licensee`), `entity_id` (FK → `state_agencies` or `licensees`), `contact_type`, `name`, `email`, `phone`, `notes`. **Read-only in the current app**, no route or component inserts/updates/deletes this table, it's populated out-of-band (seed data or direct DB access).

## SAM 2.0-specific columns (idempotency keys)

- `tower_sites.sam2_site_id` (unique)
- `site_licenses.sam2_agreement_id` (unique), plus `.escalation_detail`, `.renewal_detail`, `.one_time_fees` (jsonb)
- `site_documents.sam2_doc_id` (unique)

All three are looked up with `.maybeSingle()` in `app/api/sam2/sync/route.ts` to decide insert-vs-update, safe to re-POST the same SAM 2.0 payload. See `SAM2_INTEGRATION.md` for the full sync contract.

## Storage buckets

- `lease-documents`, `site_documents` files, signed-URL access only.
- `site-media`, photos/video/general docs, including field-survey photos under `photos/{siteId}/`.
