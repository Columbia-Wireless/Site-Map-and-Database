-- SAM 2.0 import log — additive only, one new table, no changes to existing
-- columns. Safe to run against live data.
--
-- Background: the SAM 2.0 batch import modal (Sam2ImportModal.tsx) only ever
-- showed counts for the current session — close the modal and that history
-- is gone. This gives it somewhere to persist to, so "recent SAM 2.0 imports"
-- and a per-file outcome (synced / needs review / non-instrument / error)
-- survive after the modal closes. One row per document sync attempt (not one
-- row per "batch" — SAM 2.0 has no batch boundary of its own, documents
-- arrive one SAM2_DOCUMENT_PARSED event at a time).

create table if not exists sam2_import_log (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id),
  occurred_at timestamptz not null default now(),
  file_name text not null,
  site_id uuid references tower_sites(id),
  document_id uuid references site_documents(id),
  outcome text not null check (outcome in ('synced', 'needs_review', 'non_instrument', 'error')),
  warnings jsonb not null default '[]'::jsonb,
  error_message text,
  actor_name text not null,
  actor_id uuid
);

create index if not exists idx_sam2_import_log_org_occurred
  on sam2_import_log(organization_id, occurred_at desc);

create index if not exists idx_sam2_import_log_site
  on sam2_import_log(site_id) where site_id is not null;
