/**
 * Shape of the payload SAM 2.0 sends via SAM2_DOCUMENT_PARSED. Mirrors
 * src/services/iframeBridge.ts's Sam2DocumentParsedPayload + src/types/lease.ts's
 * ExtractedLeaseDoc from the SAM 2.0 repo.
 *
 * CORRECTED 2026-08-18 — the shape "confirmed 8/13/26" here previously was
 * wrong: it assumed siteIdentity/leaseTerms/documentMetadata/oneTimeFees were
 * top-level fields on the payload, and that the id fields were named
 * sam2SiteId/sam2AgreementId/sam2DocId. Neither is true. Confirmed directly
 * against SAM 2.0's live code (Onno, 2026-08-18, citing App.tsx and
 * iframeBridge.ts):
 *   - Only documentId, siteId, agreementId, fileName, documentType, lineage,
 *     validationFlags, and timestamp are top-level.
 *   - siteIdentity, leaseTerms, documentMetadata, oneTimeFees, classification,
 *     delta, and geocode are all nested under `extractedData`.
 * The previous shape had never been exercised against a real payload — the
 * one real end-to-end sync test (task #16) hadn't been run yet, so this went
 * undetected. /api/sam2/sync would have 400'd on every real document.
 *
 * Zero-hallucination extraction rules apply throughout: a field is null/
 * absent when SAM 2.0 can't extract/geocode it, never guessed.
 */

export type Sam2TowerType = 'monopole' | 'lattice' | 'rooftop' | 'water_tower' | 'guyed' | 'small_cell'
export type Sam2DocType =
  | 'lease' | 'addendum' | 'amendment' | 'termination' | 'assignment'
  | 'commencement_agreement' | 'management_agreement'
export type Sam2EscalationType = 'fixed_percentage' | 'fixed_amount' | 'cpi' | 'none'
export type Sam2PaymentFrequency = 'monthly' | 'quarterly' | 'annually'

export interface Sam2SiteIdentity {
  siteName?: string
  siteCode?: string
  rawAddress: string
  lessorName: string
  lesseeName: string
  /** One of 6 SCETV tower types. Null when not explicitly stated in the document. */
  installationType: Sam2TowerType | null
  /** Mounting/structure height in feet. Null when not explicitly stated. */
  heightFt?: number | null
  /** Rarely populated by extraction — prefer geocode.city/state/postalCode below. */
  city?: string
  state?: string
  zip?: string
}

export interface Sam2Geocode {
  latitude: number
  longitude: number
  formattedAddress?: string
  /** From SAM 2.0's geocoding service (Nominatim/OSM). Preferred source for
   *  city/state/zip — siteIdentity's versions are typically empty. */
  city?: string
  state?: string
  /** Note the name difference from our `zip` column — map on sync. */
  postalCode?: string
}

export interface Sam2EscalationClause {
  type: Sam2EscalationType
  value: number
  frequencyMonths: number
  appliesToInitialTerm: boolean
  appliesToRenewalTerms: boolean
  firstEscalationDate?: string
  /** Manual CPI rate override (e.g. 0.032 for 3.2%), set via SAM 2.0's HITL review drawer. */
  cpiRateOverride?: number
  /** CPI series identifier, e.g. 'CPI-U'. */
  cpiSeries?: string
}

export interface Sam2RenewalOptions {
  count: number
  durationMonths: number
  isAutomatic: boolean
  noticePeriodMonths: number
}

export interface Sam2LeaseTerms {
  baseRent: number
  paymentFrequency: Sam2PaymentFrequency
  currency: string
  initialTermMonths: number
  expirationDate?: string
  isMonthToMonth?: boolean
  renewalOptions: Sam2RenewalOptions
  escalation: Sam2EscalationClause
}

export interface Sam2OneTimeFee {
  description: string
  amount: number
  dueDateOffsetDays?: number
}

export interface Sam2DocumentMetadata {
  docType: Sam2DocType
  referenceNumber?: string
  executionDate: string
  effectiveDate?: string
  commencementDate?: string
}

// ── Utilities / holdover / insurance (confirmed against SAM 2.0 repo source,
// src/types/lease.ts, 2026-08-20 — top-level siblings of siteIdentity/leaseTerms
// on extractedData, not nested under leaseTerms) ────────────────────────────

export type Sam2UtilityBillingType = string // loose — mirrors SAM 2.0's own UtilityBillingType union, kept loose here since we only display it

export interface Sam2UtilitiesInfo {
  billingType: Sam2UtilityBillingType
  baseMonthlyAmount?: number
  powerLimitKw?: number
  meterInstallationResponsibility?: 'lessor' | 'lessee'
}

export interface Sam2HoldoverInfo {
  multiplier: number
  maxHoldoverDays?: number
}

export interface Sam2InsuranceRequirements {
  generalLiabilityLimit: number
  aggregateLimit: number
  requiresAdditionalInsured: boolean
}

// ── Classification (execution status, instrument role) ──────────────────────

export type Sam2InstrumentRole =
  | 'base' | 'master' | 'restatement' | 'amendment' | 'addendum' | 'renewal'
  | 'assignment' | 'commencement' | 'termination' | 'exhibit' | 'non_instrument'
  | 'management_agreement'

export type Sam2NonInstrumentKind =
  | 'tax_form' | 'insurance_certificate' | 'ledger_or_invoice' | 'correspondence'
  | 'photo_or_plan' | 'other'

export type Sam2ExecutionStatus = 'executed' | 'draft' | 'unknown'

export interface Sam2SignatureBlock {
  party: string
  signed: boolean
  dateStated: string | null
}

export interface Sam2DocumentClassification {
  role: Sam2InstrumentRole
  nonInstrumentKind?: Sam2NonInstrumentKind
  executionStatus: Sam2ExecutionStatus
  executionEvidence: string[]
  signatures: Sam2SignatureBlock[]
}

// ── Delta (field-level amendment changes) ────────────────────────────────────

export type Sam2LeaseFieldPath =
  | 'leaseTerms.baseRent' | 'leaseTerms.paymentFrequency' | 'leaseTerms.currency'
  | 'leaseTerms.initialTermMonths' | 'leaseTerms.expirationDate' | 'leaseTerms.isMonthToMonth'
  | 'leaseTerms.escalation' | 'leaseTerms.renewalOptions' | 'utilities' | 'holdover'
  | 'insuranceRequirements' | 'siteIdentity.lesseeName' | 'siteIdentity.lessorName'
  | 'documentMetadata.commencementDate'

export interface Sam2TermChange {
  path: Sam2LeaseFieldPath
  /** 'remove' means the instrument expressly strikes the clause. */
  operation: 'set' | 'remove'
  value: unknown | null
  changeEffectiveDate: string | null
  sourceQuote: string
}

export interface Sam2AmendmentDelta {
  changes: Sam2TermChange[]
  ratifiesRemainder: boolean
  recitedCurrentRent: { amount: number; sourceQuote: string } | null
  amendsReference: { instrumentName: string | null; executionDate: string | null; parties: string[] } | null
}

// ── Lineage (position in the amendment chain, resolved cross-document) ──────

export interface Sam2AmendmentOrdinal {
  value: number
  sourceQuote: string
  source: 'document_text' | 'reviewer'
}

export interface Sam2DocumentLineage {
  ordinal: Sam2AmendmentOrdinal | null
  fileNameOrdinalHint: number | null
  amendsDocId: string | null
  supersedesDocId: string | null
  supersededByDocId: string | null
  duplicateOfDocId: string | null
  terminatesDocId: string | null
}

// ── Validation flags ─────────────────────────────────────────────────────────

export interface Sam2ValidationFlag {
  /** SAM 2.0's inconsistency code, e.g. 'OWNER_NAME_MISMATCH'. Kept as a loose
   *  string rather than mirroring their full union — used for display only,
   *  never branched on here. */
  code: string
  message: string
  severity: 'critical' | 'warning' | 'info'
  status: 'active' | 'resolved' | 'acknowledged'
  details?: string
}

// ── extractedData: per-document extraction, nested under the envelope ───────

export interface Sam2ExtractedData {
  documentMetadata: Sam2DocumentMetadata
  siteIdentity: Sam2SiteIdentity
  /** Present when the site's location has been geocoded. Not part of the
   *  top-level envelope — the only place it can live, per Onno's exhaustive
   *  list of top-level fields (2026-08-18), which didn't include it. */
  geocode?: Sam2Geocode
  oneTimeFees?: Sam2OneTimeFee[]
  /** Present on base agreements and restatements; absent on amendments. */
  leaseTerms?: Sam2LeaseTerms
  /** Present on amendment-family instruments instead of a full leaseTerms snapshot. */
  delta?: Sam2AmendmentDelta
  classification?: Sam2DocumentClassification
  /** Confirmed present in the payload 2026-08-20 (Onno) — top-level, not nested
   *  under leaseTerms. Absent when the lease doesn't state utility terms. */
  utilities?: Sam2UtilitiesInfo
  /** Confirmed present in the payload 2026-08-20 (Onno). Absent when the lease
   *  doesn't state a holdover clause. */
  holdover?: Sam2HoldoverInfo
  /** Confirmed present in the payload 2026-08-20 (Onno). Absent when the lease
   *  doesn't state insurance requirements. */
  insuranceRequirements?: Sam2InsuranceRequirements
  /** NEW as of 2026-08-20. Shape confirmed by Onno directly from src/types/lease.ts.
   *  Note terminationNoticeDays is in DAYS, unlike renewalOptions.noticePeriodMonths
   *  which is in months — different unit on purpose, don't conflate them. */
  legalTerms?: Sam2LegalTerms
  /** NEW as of 2026-08-20 (Onno) — only present on documents classified
   *  role === 'management_agreement'. Confirmed shape, live on his side. */
  managementTerms?: Sam2ManagementTerms
}

export interface Sam2LegalTerms {
  premisesDescription?: string
  governingLaw?: string
  permittedUse?: string
  assignmentAllowed?: 'yes' | 'no' | 'conditional'
  /** Days, not months — distinct from leaseTerms.renewalOptions.noticePeriodMonths. */
  terminationNoticeDays?: number
  relocationProvisions?: string
  equipmentDescription?: string
  notes?: string
}

export interface Sam2ManagementTerms {
  commissionStructure?: 'percentage' | 'flat_fee' | 'hybrid' | 'other'
  /** Fraction — 0.2 for 20%, not 20. Display/cross-check only, see
   *  supabase/management_agreements.sql's commission_rate column comment —
   *  never auto-applied as the operational commission rate the rent engine
   *  actually uses (Onno's explicit warning, 2026-08-20). */
  commissionPercentage?: number
  commissionFlatFeeAmount?: number
  /** Always filled for hybrid/other structures. */
  commissionDescription?: string
  billingPractices?: string
  /** Only present if explicitly stated in the document — never computed
   *  from term length (Onno caught and fixed exactly this bug pre-ship). */
  termEndDate?: string
  /** Fallback prose when there's no explicit termEndDate, e.g. "five years". */
  initialTermDescription?: string
  renewalTerms?: string
  terminationNoticeDays?: number
  exclusivity?: 'exclusive' | 'non_exclusive'
  /** Not optional on Onno's side — always set, defaults true when genuinely
   *  unclear. In practice we should never receive a payload with this true:
   *  a document naming more than one site never gets filed by SAM 2.0 today,
   *  it stays in his review inbox for a person to sort out manually. */
  coversMultipleSites: boolean
}

// ── The actual wire envelope ─────────────────────────────────────────────────

export interface Sam2SyncPayload {
  documentId: string
  siteId: string
  agreementId: string
  fileName: string
  documentType: 'lease' | 'addendum' | 'amendment' | 'unknown'
  extractedData: Sam2ExtractedData
  /** Null until SAM 2.0's cross-document lineage pass resolves it — not the
   *  same as "resolved, no relationship". Re-announced (same documentId, new
   *  SAM2_DOCUMENT_PARSED event) when it changes, so treat incoming events as
   *  an upsert keyed on documentId, not a one-shot creation event. */
  lineage: Sam2DocumentLineage | null
  validationFlags: Sam2ValidationFlag[]
  timestamp: string
}

export interface Sam2SyncResult {
  siteId: string
  /** Null for non-instrument documents (tax forms, insurance certs, exhibits,
   *  etc.) — these are stored and attached to the site, but never get a
   *  licensee or license record, since they don't name real lease parties. */
  licenseId: string | null
  documentId: string
  hostAgency: { matched: boolean; confidence: string; id: string | null; suggestedName: string | null }
  licensee: { matched: boolean; confidence: string; id: string | null; created: boolean }
  warnings: string[]
  /** True when this document landed as site_documents.doc_status = 'review_required'
   *  — i.e. it's a lease-family instrument that hasn't been approved yet, so the
   *  rent engine excludes it from the schedule fold. False for non-instrument
   *  documents (nothing to approve) and for re-syncs of an already-approved doc. */
  needsReview: boolean
}
