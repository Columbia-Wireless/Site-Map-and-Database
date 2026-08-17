export type DocType =
  | 'lease'
  | 'addendum'
  | 'amendment'
  | 'termination'
  | 'assignment'
  | 'commencement_agreement'
  | 'management_agreement';

export type InstallationType = 
  | 'rooftop' 
  | 'tower' 
  | 'in-building_fiber' 
  | 'other';

export type PaymentFrequency = 'monthly' | 'quarterly' | 'annually';

export type EscalationType = 'fixed_percentage' | 'fixed_amount' | 'cpi' | 'none';

export type UtilityBillingType = 
  | 'fixed_rate' 
  | 'submetered' 
  | 'shared_allocation' 
  | 'included' 
  | 'direct_to_utility';

export interface DocumentMetadata {
  docType: DocType;
  referenceNumber?: string;
  executionDate: string; // YYYY-MM-DD
  effectiveDate?: string; // YYYY-MM-DD
  commencementDate?: string; // YYYY-MM-DD
  isCommencementConditional: boolean;
  commencementConditionText?: string;
}

export interface SiteIdentity {
  siteName?: string;
  siteCode?: string;
  rawAddress: string;
  lessorName: string;
  lesseeName: string;
  installationType: InstallationType;
}

export interface OneTimeFee {
  description: string;
  amount: number;
  dueDateOffsetDays?: number;
}

export interface RenewalOptions {
  count: number;
  durationMonths: number;
  isAutomatic: boolean;
  noticePeriodMonths: number;
}

export interface EscalationClause {
  type: EscalationType;
  value: number; // e.g. 0.03 for 3% or dollar amount
  frequencyMonths: number; // e.g. 12
  appliesToInitialTerm: boolean;
  appliesToRenewalTerms: boolean;
  /**
   * Date the FIRST escalation takes effect (YYYY-MM-DD), when the contract states one.
   * Escalations recur from here at `frequencyMonths`.
   *
   * Leases do not always escalate on their commencement anniversary — the reference lease
   * system carries an explicit "First Escalation Date", and real agreements escalate on
   * dates such as 3/19 or 7/1 regardless of when they commenced. Absent this, the engine
   * derives commencement + frequencyMonths and reports which basis it used.
   */
  firstEscalationDate?: string;
}

export interface LeaseTerms {
  baseRent: number;
  paymentFrequency: PaymentFrequency;
  currency: string;
  initialTermMonths: number;
  expirationDate?: string;
  /** True when the agreement continues month to month with no fixed end date. */
  isMonthToMonth?: boolean;
  renewalOptions: RenewalOptions;
  escalation: EscalationClause;
}

export interface UtilitiesInfo {
  billingType: UtilityBillingType;
  baseMonthlyAmount?: number;
  powerLimitKw?: number;
  meterInstallationResponsibility?: 'lessor' | 'lessee';
}

export interface HoldoverInfo {
  multiplier: number; // e.g. 1.5 for 150%
  maxHoldoverDays?: number;
}

export interface InsuranceRequirements {
  generalLiabilityLimit: number;
  aggregateLimit: number;
  requiresAdditionalInsured: boolean;
}

/**
 * What kind of instrument a document is, independent of what it calls itself.
 *
 * `docType` records the label on the page; this records the role the instrument plays in a
 * chain, which is what the fold needs. The distinction that matters most is `restatement`:
 * an "Amended and Restated" agreement genuinely replaces everything before it, whereas an
 * amendment only changes what it names.
 */
export type InstrumentRole =
  | 'base'
  /**
   * A master agreement: a framework with one counterparty covering many properties, with
   * site-specific schedules attached. It is keyed to the party rather than to a location, so
   * filing it at a single address misplaces it and every site that hangs off it.
   */
  | 'master'
  | 'restatement'
  | 'amendment'
  | 'addendum'
  | 'renewal'
  | 'assignment'
  | 'commencement'
  | 'termination'
  /** An attachment to another instrument; carries no standalone terms. */
  | 'exhibit'
  /** Not a contract at all — a tax form, insurance certificate, ledger, photo, email. */
  | 'non_instrument'
  /**
   * Between the property owner and a manager/consultant engaged to market and manage the
   * property's telecom sites and negotiate carrier leases on the owner's behalf — not a
   * lease with a carrier itself. Has no rent terms. Alongside the base lease, it is one of
   * the two oracle documents for the site's address (both should agree); a site with no
   * management agreement on file raises NO_MANAGEMENT_AGREEMENT rather than resolving the
   * address from the base lease alone.
   */
  | 'management_agreement';

/**
 * Whether the document is signed.
 *
 * Defaults to `unknown` and is NEVER promoted to `executed` by the absence of contrary
 * evidence. Carrier folders hold redlines, "need signature" drafts and executed originals
 * side by side; billing from a draft is the failure this exists to prevent.
 */
export type ExecutionStatus = 'executed' | 'draft' | 'unknown';

export interface SignatureBlock {
  party: string;
  signed: boolean;
  /** Date written on the signature block, or null when none is written. Never inferred. */
  dateStated: string | null;
}

export type NonInstrumentKind =
  | 'tax_form'
  | 'insurance_certificate'
  | 'ledger_or_invoice'
  | 'correspondence'
  | 'photo_or_plan'
  | 'other';

/**
 * What a piece of handwriting is doing on the page.
 *
 * The distinction decides everything. An initial in a signature block is evidence the
 * agreement was signed. A figure struck through with a different one written beside it and
 * initialled is a binding change that overrides the printed term — and a system reading only
 * the typed layer will bill the printed figure and be confidently wrong.
 */
export type HandwritingKind =
  /** Typed text struck through with a replacement written in. Overrides the print. */
  | 'interlineation'
  /** A blank line completed by hand, e.g. "Commencement Date: ______". */
  | 'fill_in'
  | 'margin_note'
  | 'signature'
  | 'initials'
  | 'date_written';

export interface HandwrittenRegion {
  kind: HandwritingKind;
  /** Page it appears on, when the parse reports one. */
  page: number | null;
  /** The typed text around it, verbatim, so a reviewer can find it on the page. */
  nearbyText: string;
  /**
   * What the handwriting appears to say.
   *
   * Never used to set a value. A transcription of handwriting is a guess about ink, and a
   * guess must not become a rent. It exists to show a reviewer what to look at.
   */
  apparentText: string | null;
  /** The typed text that was struck through, when this is an interlineation. */
  struckText: string | null;
}

export interface DocumentClassification {
  role: InstrumentRole;
  nonInstrumentKind?: NonInstrumentKind;
  executionStatus: ExecutionStatus;
  /** Verbatim text supporting `executionStatus`. Empty means the status must be 'unknown'. */
  executionEvidence: string[];
  signatures: SignatureBlock[];
  /** Handwritten and struck-through regions found on the page. See {@link HandwrittenRegion}. */
  handwriting?: HandwrittenRegion[];
}

/**
 * Which amendment this is — 4 for a "Fourth Amendment".
 *
 * Read from the document text, never from the filename: folders contain files named
 * `...1st Amend952.pdf`, `...A1.pdf` and `...1st Amend REV 3.18.26.pdf` for instruments whose
 * actual ordinals only the text can settle. A filename ordinal is kept separately as a hint
 * and used solely to raise a conflict.
 */
export interface AmendmentOrdinal {
  value: number;
  sourceQuote: string;
  source: 'document_text' | 'reviewer';
}

/** A term an amendment is capable of changing. */
export type LeaseFieldPath =
  | 'leaseTerms.baseRent'
  | 'leaseTerms.paymentFrequency'
  | 'leaseTerms.currency'
  | 'leaseTerms.initialTermMonths'
  | 'leaseTerms.expirationDate'
  | 'leaseTerms.isMonthToMonth'
  | 'leaseTerms.escalation'
  | 'leaseTerms.renewalOptions'
  | 'utilities'
  | 'holdover'
  | 'insuranceRequirements'
  | 'siteIdentity.lesseeName'
  | 'siteIdentity.lessorName'
  | 'documentMetadata.commencementDate';

export interface TermChange {
  path: LeaseFieldPath;
  /** 'remove' means the instrument expressly strikes the clause, e.g. deletes escalation. */
  operation: 'set' | 'remove';
  value: unknown | null;
  /**
   * When THIS change takes effect, if the instrument states a date separate from its own
   * effective date. Null means it takes effect with the document.
   */
  changeEffectiveDate: string | null;
  /** Verbatim clause text. Mandatory — a change with no quote is rejected, not stored. */
  sourceQuote: string;
}

/**
 * What an amendment actually changes.
 *
 * Three states are distinct and all three occur: a term absent from `changes` is unchanged
 * and inherited, a `set` replaces it, a `remove` deletes the clause. The previous model could
 * express only "replace everything", so an amendment that raised the rent silently discarded
 * the escalation and renewal clauses it never mentioned.
 */
export interface AmendmentDelta {
  changes: TermChange[];
  /** "All other terms remain in full force and effect" was stated. */
  ratifiesRemainder: boolean;
  /**
   * Rent the instrument RECITES as currently payable, when it recites one. This is the
   * strongest cross-document check available: the contract itself states what the running
   * total should be on that date.
   */
  recitedCurrentRent: { amount: number; sourceQuote: string } | null;
  /** How the instrument identifies what it amends, verbatim. */
  amendsReference: {
    instrumentName: string | null;
    executionDate: string | null;
    parties: string[];
  } | null;
}

/** How a document relates to the others in its agreement. Resolved, never guessed at ingest. */
export interface DocumentLineage {
  ordinal: AmendmentOrdinal | null;
  /** Ordinal parsed from the filename. Advisory only; disagreement with the text is a flag. */
  fileNameOrdinalHint: number | null;
  amendsDocId: string | null;
  /** This document is a later revision of that one. */
  supersedesDocId: string | null;
  supersededByDocId: string | null;
  /** This document is a copy of that one; excluded from every fold. */
  duplicateOfDocId: string | null;
  terminatesDocId: string | null;
}

export interface ExtractedLeaseDoc {
  documentMetadata: DocumentMetadata;
  siteIdentity: SiteIdentity;
  oneTimeFees: OneTimeFee[];
  /**
   * Complete terms. Present on base agreements and restatements; absent on amendments, which
   * carry a `delta` instead. Optional because forcing an amendment to emit a full term set
   * would require inventing the terms it does not mention.
   */
  leaseTerms?: LeaseTerms;
  /** Present on amendment-family instruments. See {@link AmendmentDelta}. */
  delta?: AmendmentDelta;
  classification?: DocumentClassification;
  utilities?: UtilitiesInfo;
  holdover?: HoldoverInfo;
  insuranceRequirements?: InsuranceRequirements;
}

export type InconsistencyCode =
  | 'COMMENCEMENT_DATE_PENDING'
  | 'OWNER_NAME_MISMATCH'
  | 'ADDRESS_MISMATCH'
  | 'TIMELINE_GAP'
  | 'OVERLAPPING_TERMS'
  | 'GEOCODE_MISMATCH'
  | 'MISSING_SITE_CODE'
  /** Part of the extraction was not supported by the document and was left out. */
  | 'EXTRACTION_REJECTED'
  /** Handwriting sits on or beside a term this system extracted. A person must adjudicate. */
  | 'HANDWRITTEN_TERM_UNVERIFIED'
  /** A printed term is struck through. The print no longer says what the agreement says. */
  | 'STRUCK_THROUGH_TERM'
  /** A handwritten signature date disagrees with the typed execution date. */
  | 'HANDWRITTEN_DATE_CONFLICT'
  /** The address is close to more than one property on file, or to none decisively. */
  | 'SITE_MATCH_AMBIGUOUS'
  /** The tenant name is close to an agreement on file, but not clearly it. */
  | 'AGREEMENT_MATCH_AMBIGUOUS'
  /** A second original agreement for a tenant that already has one at this property. */
  | 'SECOND_BASE_INSTRUMENT_SAME_TENANT'
  /** Another file with the same name but a different extension has not been parsed. */
  | 'NEAR_DUPLICATE_CANDIDATE_BY_NAME'
  /** The folder the file came from disagrees with where its content places it. */
  | 'FOLDER_GROUPING_CONFLICT'
  /** The site has filed documents but no management agreement is on file for it. */
  | 'NO_MANAGEMENT_AGREEMENT'
  /**
   * This document was moved here by a duplicate-site merge (`siteMerge.ts`) that a developer
   * confirmed from the data, not the end client — e.g. two site records were both "Reston"
   * under different names/addresses and got consolidated. The physical-property judgment
   * behind the merge should still get the client's own confirmation.
   */
  | 'SITE_MERGED_PENDING_CLIENT_REVIEW';

export type FlagSeverity = 'critical' | 'warning' | 'info';
export type FlagStatus = 'active' | 'resolved' | 'acknowledged';

export interface ValidationFlag {
  code: InconsistencyCode;
  message: string;
  severity: FlagSeverity;
  status: FlagStatus;
  details?: string;
}

export interface GeocodeLocation {
  latitude: number;
  longitude: number;
  formattedAddress?: string;
}

export interface Site {
  siteId: string;
  siteCode: string;
  siteName: string;
  address: string;
  geocode?: GeocodeLocation;
  createdAt: string;
  /**
   * Lessor / ownership / partnership, as resolved by `resolveOwnership`: the most recent
   * *executed* document that actually states it — an amendment whose delta expressly changes
   * `siteIdentity.lessorName`, or (absent any such amendment) the base lease's own statement.
   * Never the most recently ingested document merely because it is newest, and never the
   * management agreement (client-confirmed 2026-08-04). The OWNER_NAME_MISMATCH rule compares
   * newly-arriving documents against this. Optional because sites created before this field
   * existed do not have it — the rule skips rather than guessing.
   */
  lessorName?: string;
  /** Which document `lessorName` was resolved from, for the auditable "resolved from X" trail. */
  lessorNameSourceDocId?: string;
  /** The verbatim clause that stated it, when the source was an amendment's delta change. */
  lessorNameSourceQuote?: string;
  /**
   * Other ways this property is named, each confirmed by a person.
   *
   * A building is not its address. Rockville Metro Plaza I is reached from 111 Rockville
   * Pike and from 111 Hungerford Drive, and its documents use all three names; without an
   * alias set each spelling becomes a separate property and the carrier chains split across
   * them. Aliases are only ever added by confirmation, never inferred from a near match.
   */
  addressAliases?: string[];
  /**
   * Set by a human confirming a handshake-based management arrangement for this property:
   * no document exists for it by design ("some buildings we have management agreements,
   * others letters of engagement, others just a handshake deal" — client, 2026-08-04), so
   * `NO_MANAGEMENT_AGREEMENT` should stop asking about it. A letter of engagement is not this
   * — it is a real document and classifies as `management_agreement` like any other.
   */
  handshakeManagementConfirmed?: {
    note?: string;
    confirmedAt: string;
  };
  /**
   * Set when this site record was folded into another during a duplicate-address merge
   * (`siteMerge.ts`) — its agreements and documents were re-homed to `mergedIntoSiteId` by
   * updating their `siteId`/`agreementId` fields in place, never by moving or deleting
   * anything. The record itself is kept, not deleted (audit trail); UI listings should treat
   * it as inactive. A site with this set should never appear as a merge target itself.
   */
  mergedIntoSiteId?: string;
  mergedAt?: string;
}

export interface Agreement {
  agreementId: string;
  siteId: string;
  tenantName: string;
  /**
   * Management commission as a fraction of gross rent (0.2 = 20%), when one applies.
   * Set per agreement, not per site: the reference projections show 20% at two properties
   * and a blended 15.2% at a third, which only resolves as differing rates per carrier.
   */
  commissionRate?: number;
  status: 'active' | 'pending' | 'expired' | 'terminated';
  commencementDate?: string | null;
  isCommencementConditional: boolean;
  commencementConditionText?: string;
  createdAt: string;
}

export interface DocumentRecord {
  docId: string;
  agreementId: string;
  siteId: string;
  fileName: string;
  docType: DocType;
  effectiveDate: string;
  executionDate: string;
  status: 'pending_review' | 'confirmed' | 'rejected';
  rawMarkdown: string;
  data: ExtractedLeaseDoc;
  validationFlags: ValidationFlag[];
  createdAt: string;
  /** Verbatim JSON the model returned, kept as an audit trail against `data`. */
  rawExtractionJson?: string;
  /** Model actually served for this extraction. */
  extractionModel?: string;
  /** Links back to the /ingestions run that produced this record. */
  ingestionId?: string;
  /**
   * SHA-256 of the source file's bytes. Identifies the file itself, so the same contract
   * arriving twice under different names is parsed once and linked, not billed twice.
   */
  contentHash?: string;
  /** Folder the file came from, relative to the dropped root. Evidence for grouping, not authority. */
  sourceFolder?: string;
  /**
   * Name of the top-level folder a batch was ingested from — which property's folder tree a
   * document was dropped into.
   *
   * Unlike an address extracted from the text, this is a certain fact rather than a guess:
   * every file in one `npm run ingest` run came from one property folder by construction. It
   * is still only a suggestion for filing, never an override — a document can be misfiled by a
   * person before it is ever ingested, and the folder does not know that.
   */
  siteFolderHint?: string;
  /** How this document relates to the others in its agreement. */
  lineage?: DocumentLineage;
  /** Batch this document was ingested in. */
  batchId?: string;
  /**
   * True when the original file's bytes (compressed) are stored in Firestore under
   * `sourceFiles/{contentHash}` — retrievable and downloadable exactly as uploaded.
   * Absent/false means it wasn't stored (storage is best-effort, never blocks filing).
   */
  sourceFileStored?: boolean;
}

/**
 * True when a document should contribute to the rent schedule and the consistency checks.
 *
 * Exported from here rather than duplicated at each call site so the schedule and the flag
 * engine can never disagree about which documents count.
 *
 * A record without a `classification` is not excluded: classification arrived after the
 * review workflow did, and a human confirming a document is itself the gate those records
 * passed through. What is present is trusted; what is absent is not invented.
 */
export function isInForce(doc: DocumentRecord): boolean {
  if (doc.status !== 'confirmed') return false;

  const classification = doc.data.classification;
  if (classification) {
    if (classification.executionStatus !== 'executed') return false;
    if (classification.role === 'exhibit' || classification.role === 'non_instrument') return false;
  }

  const lineage = doc.lineage;
  if (lineage) {
    if (lineage.duplicateOfDocId) return false;
    if (lineage.supersededByDocId) return false;
  }

  return true;
}

/**
 * The role an instrument plays, falling back to its stated `docType`.
 *
 * The mapping is a translation of extracted data, not an inference: `docType` is read from
 * the document by the same extraction that would otherwise set `role`.
 */
export function roleOf(doc: DocumentRecord): InstrumentRole {
  const stated = doc.data.classification?.role;
  if (stated) return stated;

  switch (doc.docType) {
    case 'lease':
      return 'base';
    case 'amendment':
      return 'amendment';
    case 'addendum':
      return 'addendum';
    case 'termination':
      return 'termination';
    case 'assignment':
      return 'assignment';
    case 'commencement_agreement':
      return 'commencement';
    default:
      return 'base';
  }
}

/**
 * Roles whose instrument is not tied to one property.
 *
 * A master agreement covers a portfolio; the properties attach to it through schedules. It
 * must not be matched to a site by address.
 */
export const PORTFOLIO_ROLES: readonly InstrumentRole[] = ['master'];

/** Roles that modify an existing agreement rather than establishing or replacing one. */
export const AMENDING_ROLES: readonly InstrumentRole[] = [
  'amendment',
  'addendum',
  'renewal',
  'assignment',
  'commencement',
];

/**
 * One ingestion attempt, written to a top-level `/ingestions` collection as the pipeline
 * progresses. Its purpose is to retain paid API output (LlamaParse markdown, model JSON)
 * even when a later stage fails, so a retry need not re-parse and re-extract.
 *
 * This is an audit record of real work, not sample lease data — it never appears in the
 * sites/agreements/documents views, so HARD RULE #1's empty-state requirement is unaffected.
 */
export interface IngestionRun {
  ingestionId: string;
  fileName: string;
  fileSize: number;
  provider: string;
  status: 'parsing' | 'extracting' | 'extracted' | 'completed' | 'failed';
  startedAt: string;
  updatedAt: string;
  rawMarkdown?: string;
  rawExtractionJson?: string;
  extractionModel?: string;
  errorMessage?: string;
  siteId?: string;
  agreementId?: string;
  docId?: string;
}

export interface RentScheduleItem {
  periodIndex: number;
  year: number;
  month: number;
  formattedPeriod: string; // YYYY-MM
  siteId: string;
  siteCode: string;
  siteName: string;
  tenantName: string;
  address: string;
  /** Monthly obligation, normalised from the contract's payment frequency. */
  baseRent: number;
  escalationAmount: number;
  /** Recurring monthly charge that does NOT escalate (e.g. a fixed utility rate). */
  fixedMonthlyCharge: number;
  /** baseRent + escalationAmount + fixedMonthlyCharge. Gross, before commission. */
  totalMonthlyRent: number;
  /** Commission on the gross, when the agreement carries a rate. */
  commissionAmount?: number;
  /** Gross less commission. */
  netMonthlyRent?: number;
  /** Rent exactly as written in the contract, before monthly normalisation. */
  contractRent: number;
  /** Frequency the contract states, so a quarterly charge is visibly quarterly. */
  paymentFrequency: PaymentFrequency;
  activeDocReference: string;
  docType: DocType;
  isConditionalCommencement: boolean;
  status: 'active' | 'projected' | 'pending_resolution';
}
