-- SAM 2.0 integration — additive columns only, no new tables, no changes to
-- existing columns. Safe to run against live data: every column added here
-- is nullable, so existing rows are untouched and every current query keeps
-- working unchanged.
--
-- Note: supabase/schema.sql is stale (predates site_licenses/licensees/
-- state_agencies/organizations and multi-tenancy) — do not treat it as the
-- source of truth for the live schema. This file targets the real table
-- names confirmed from actual query call sites in the app: tower_sites,
-- site_licenses, site_documents.

-- tower_sites: external reference for idempotent sync from SAM 2.0.
alter table tower_sites
  add column if not exists sam2_site_id text unique;

-- site_licenses: external reference, plus the richer lease-term detail SAM
-- 2.0 extracts that the existing flat columns (escalation_rate, a single
-- numeric) can't represent. Stored as JSONB rather than new relational
-- tables/columns per field, matching the pattern site_documents.extracted_terms
-- already uses elsewhere in this schema for flexible extracted data.
alter table site_licenses
  add column if not exists sam2_agreement_id text unique,
  add column if not exists escalation_detail jsonb,   -- EscalationClause: type, value, frequencyMonths, appliesToInitialTerm, appliesToRenewalTerms, firstEscalationDate
  add column if not exists renewal_detail jsonb,       -- RenewalOptions: count, durationMonths, isAutomatic, noticePeriodMonths
  add column if not exists one_time_fees jsonb;        -- OneTimeFee[]: description, amount, dueDateOffsetDays

-- site_documents: external reference for idempotent sync. extracted_terms
-- (existing column) is reused to hold the SAM 2.0-derived field values,
-- mapped into the same { value, confidence } shape the existing terms
-- review UI (SiteTermsPanel/TermsReviewModal) already knows how to render.
alter table site_documents
  add column if not exists sam2_doc_id text unique;

create index if not exists idx_tower_sites_sam2_site_id on tower_sites(sam2_site_id) where sam2_site_id is not null;
create index if not exists idx_site_licenses_sam2_agreement_id on site_licenses(sam2_agreement_id) where sam2_agreement_id is not null;
create index if not exists idx_site_documents_sam2_doc_id on site_documents(sam2_doc_id) where sam2_doc_id is not null;
