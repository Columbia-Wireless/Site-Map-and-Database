-- Management agreements — additive only, two new tables, no changes to
-- existing columns. Safe to run against live data.
--
-- Background: management agreements (site owner <-> Columbia Wireless, not a
-- carrier lease) were being misread by /api/sam2/sync as ordinary leases,
-- creating a phantom licensee record and a $0 site_licenses row for each one
-- (fixed 2026-08-20, see docs/SAM2_INTEGRATION.md "Management agreements").
-- That fix stops the bad data, but the real fields we want from these
-- documents (commission, billing practices, term dates, exclusivity) still
-- need somewhere real to live — a JSONB blob on site_documents can't be
-- summed across sites for a portfolio-wide commission-revenue view, and
-- can't cleanly represent one agreement covering several sites.
--
-- One agreement can cover one site or several (client-confirmed 2026-08-20),
-- hence the join table rather than a single site_id column.
--
-- Field shapes confirmed by Onno 2026-08-20 (managementTerms block, live on
-- his side). Multi-site question answered too: SAM 2.0 never files a
-- management agreement against more than one site today — a document that
-- names multiple properties stays stuck in his review inbox for a person to
-- sort out manually (same behavior a portfolio-wide lease already gets), so
-- we will only ever receive single-site payloads here despite the join
-- table below. coversMultipleSites is his early-warning flag for that case,
-- stored but not expected to ever be true in a payload we actually get.

create table if not exists management_agreements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id),

  -- Idempotency key, mirrors site_licenses.sam2_agreement_id — same document
  -- re-synced (e.g. a lineage re-announce) updates this row, never duplicates.
  sam2_agreement_id text unique,
  document_id uuid references site_documents(id),

  -- Informational only. Never used to set/overwrite tower_sites.host_agency_id
  -- — a management agreement's stated owner is never trusted for site
  -- ownership resolution (client-confirmed 2026-08-04, see
  -- lib/rentEngine/types/lease.ts's TowerSite.lessorName doc comment).
  -- References state_agencies — that's the real table name behind the
  -- "Site Owner" UI label (renamed in the UI only, task #19).
  host_agency_id uuid references state_agencies(id),
  site_owner_name text,
  manager_entity_name text,

  -- commission_rate is a fraction (0.20 = 20%), matches Onno's
  -- commissionPercentage exactly. IMPORTANT: this is what the document
  -- states, extracted for display/cross-check only. It is never
  -- auto-applied as the operational commission rate — that's a separate,
  -- manually-confirmed number the rent engine actually uses (Onno's
  -- explicit warning, 2026-08-20). Nothing in the sync route writes this
  -- column into any calculation input.
  commission_type text check (commission_type in ('percentage', 'flat_fee', 'hybrid', 'other')),
  commission_rate numeric,
  flat_fee_amount numeric,
  -- Always populated for hybrid/other per Onno's spec; free text for the
  -- rest of the commission structure that doesn't fit rate/flat_fee_amount.
  commission_description text,

  billing_practices text,
  start_date date,
  -- Only set when the document explicitly states an end date — never
  -- computed from term length (Onno caught and fixed this exact bug before
  -- shipping: end date was being calculated, not read, on his first pass).
  end_date date,
  -- Fallback when there's no explicit end_date, e.g. "five years".
  initial_term_description text,
  renewal_terms text,
  termination_notice_days integer,

  exclusivity text check (exclusivity in ('exclusive', 'non_exclusive')),

  -- Onno's model always sets this (never null), defaulting to true when
  -- genuinely unclear. In practice we should never see true here, since a
  -- multi-site document never reaches us as a payload at all (see header
  -- comment) — kept for completeness / future-proofing, not actively used.
  covers_multiple_sites boolean not null default false,

  governing_law text,
  notes text,

  status text not null default 'active' check (status in ('active', 'expired', 'terminated')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_management_agreements_org
  on management_agreements(organization_id);

create index if not exists idx_management_agreements_host_agency
  on management_agreements(host_agency_id) where host_agency_id is not null;

-- One agreement <-> many sites. A site could in principle have more than one
-- management agreement over time (renewals, a new one after a prior one
-- ended) — status on the parent row plus start_date/end_date distinguish
-- current from historical, this table doesn't enforce "only one active."
create table if not exists management_agreement_sites (
  id uuid primary key default gen_random_uuid(),
  management_agreement_id uuid not null references management_agreements(id) on delete cascade,
  site_id uuid not null references tower_sites(id) on delete cascade,
  unique (management_agreement_id, site_id)
);

create index if not exists idx_management_agreement_sites_site
  on management_agreement_sites(site_id);

create index if not exists idx_management_agreement_sites_agreement
  on management_agreement_sites(management_agreement_id);
