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
-- Field shapes (commission_type enum, billing_practices structure, how SAM
-- 2.0 represents multi-site coverage on the wire) are still pending Onno's
-- reply as of 2026-08-20 — this table is deliberately loose (nullable, free
-- text) so it can receive whatever comes back without a second migration.
-- The sync-route mapping into this table is NOT built yet; this is schema
-- only.

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

  -- Commission: percentage as a fraction (0.20 = 20%) and/or a flat fee — a
  -- document may state either, both, or neither. commission_type is left as
  -- free text (not a check constraint) until Onno confirms the real enum.
  commission_type text,
  commission_rate numeric,
  flat_fee_amount numeric,

  billing_practices text,
  start_date date,
  end_date date,
  termination_notice_days integer,

  -- Free text until Onno confirms whether this comes back as an enum
  -- ('exclusive'/'non_exclusive'/'conditional', mirroring legalTerms.
  -- assignmentAllowed's shape) or something else.
  exclusivity text,

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
