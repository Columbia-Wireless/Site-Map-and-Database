-- Immediate RLS lockdown — stopgap, not the full fix.
--
-- Found 2026-08-21: components/layout/Sidebar.tsx queries `profiles` directly
-- from the browser using the public anon key (shipped in the JS bundle, also
-- hardcoded as a literal fallback in lib/supabase.ts). With RLS off on every
-- table, anyone holding that key can call Supabase's REST API directly and
-- read data, bypassing the app and its login entirely. Confirmed real, not
-- theoretical: this is the actual live posture as of this writing across
-- every table (see docs/API_REFERENCE.md, docs/ARCHITECTURE.md).
--
-- This migration enables RLS with no policies (default-deny) on every real
-- table in the schema (see docs/DATA_MODEL.md), which instantly blocks all
-- anon/authenticated-key access. Service-role key (what almost every API
-- route uses) bypasses RLS regardless of enabled status, so this does not
-- affect the app's own server-side routes.
--
-- ONE exception, added first: Sidebar.tsx's direct client-side read of its
-- own profile row (role, for the sidebar badge). That uses
-- createBrowserClient from @supabase/ssr, which does carry the logged-in
-- user's session/JWT (unlike the plain anon client in lib/supabase.ts), so
-- auth.uid() resolves correctly here. Without this policy, default-deny
-- would break the role badge for every logged-in user.
--
-- This is a stopgap, not the full fix — it does not add per-organization
-- scoping at the database level (that's still enforced only in application
-- code, per lib/orgScope.ts). The full project (org-scoped policies on every
-- table, switching routes to use the caller's own session instead of the
-- service-role key) is tracked separately, sequenced after the backup/reset
-- work.

-- CREATE POLICY has no IF NOT EXISTS clause in Postgres, so drop-then-create
-- to stay idempotent (safe to re-run this file).
drop policy if exists "select_own_profile" on profiles;
create policy "select_own_profile" on profiles
  for select
  using (auth.uid() = id);

alter table if exists organizations enable row level security;
alter table if exists profiles enable row level security;
alter table if exists tower_sites enable row level security;
alter table if exists site_licenses enable row level security;
alter table if exists licensees enable row level security;
alter table if exists state_agencies enable row level security;
alter table if exists site_documents enable row level security;
alter table if exists document_events enable row level security;
alter table if exists site_media enable row level security;
alter table if exists site_change_log enable row level security;
alter table if exists equipment_items enable row level security;
alter table if exists external_comparables enable row level security;
alter table if exists site_surveys enable row level security;
alter table if exists site_photos enable row level security;
alter table if exists saved_reports enable row level security;
alter table if exists contacts enable row level security;
alter table if exists sam2_import_log enable row level security;
alter table if exists management_agreements enable row level security;
alter table if exists management_agreement_sites enable row level security;
