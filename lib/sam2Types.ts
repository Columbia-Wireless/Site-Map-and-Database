/**
 * Shape of the payload SAM 2.0 sends via SAM2_DOCUMENT_PARSED. Mirrors
 * src/types/lease.ts's ExtractedLeaseDoc from the SAM 2.0 repo, plus the
 * identifiers needed for idempotent sync.
 *
 * CONFIRMED 8/13/26 against the real event payload (SAM 2.0 dev). Two notes
 * vs. what was originally assumed here:
 *  - installationType now carries the 6 SCETV tower types directly (there is
 *    no separate towerType field — the old 4-value coarse enum is gone).
 *  - city/state/postal come from the geocoding service under `geocode`, not
 *    from document extraction under `siteIdentity`.
 * Both are null (not guessed) when SAM 2.0 can't extract/geocode them —
 * zero-hallucination extraction rules.
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

export interface Sam2SyncPayload {
  sam2SiteId: string
  sam2AgreementId: string
  sam2DocId: string
  fileName: string
  siteIdentity: Sam2SiteIdentity
  geocode?: Sam2Geocode
  leaseTerms?: Sam2LeaseTerms
  oneTimeFees?: Sam2OneTimeFee[]
  documentMetadata: Sam2DocumentMetadata
}

export interface Sam2SyncResult {
  siteId: string
  licenseId: string
  documentId: string
  hostAgency: { matched: boolean; confidence: string; id: string | null; suggestedName: string | null }
  licensee: { matched: boolean; confidence: string; id: string | null; created: boolean }
  warnings: string[]
}
