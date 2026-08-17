-- Rent calculation engine migration — additive columns only, no new tables,
-- no changes to existing columns. Safe to run against live data.
--
-- Background: generateRentSchedule() (lib/rentEngine/services/timelineEngine.ts,
-- ported from SAM 2.0) needs the full set of documents belonging to one lease
-- chain — base agreement through every amendment — as a single DocumentRecord[]
-- input. site_documents currently links only to site_id, not to an agreement,
-- so that chain can't be queried today. This adds the missing link.
--
-- Consequence for site_licenses: annual_rent, escalation_rate, escalation_detail,
-- license_start, and license_end become a CACHED SNAPSHOT of the latest synced
-- document's terms from here on — still fine for quick display/reports, but no
-- longer the input the engine calculates from. The engine reads the full
-- document chain via license_id instead. schedule_cache/schedule_computed_at
-- below hold the engine's actual output once it's wired in (#41).

-- site_documents: link each document to the internal agreement/lease it
-- belongs to. Nullable — general site-level documents (photos, plots, etc.)
-- that aren't tied to a specific lease won't have one.
alter table site_documents
  add column if not exists license_id uuid references site_licenses(id);

create index if not exists idx_site_documents_license_id
  on site_documents(license_id) where license_id is not null;

-- site_licenses: cache for the engine's last computed schedule, so pages
-- don't recompute a full multi-decade schedule on every render.
alter table site_licenses
  add column if not exists schedule_cache jsonb,          -- { rows, oneTimeCharges, issues } from generateRentSchedule()
  add column if not exists schedule_computed_at timestamptz;

-- One-time backfill: link every already-synced document to its agreement.
-- license_id is only populated going forward by app/api/sam2/sync/route.ts
-- on new syncs — this catches everything synced before that code shipped.
-- Safe to re-run; only touches rows where license_id is still null.
update site_documents sd
set license_id = sl.id
from site_licenses sl
where sd.license_id is null
  and sl.sam2_agreement_id is not null
  and sd.extracted_terms -> '_sam2_raw' ->> 'sam2AgreementId' = sl.sam2_agreement_id;
