import { getSupabase } from '@/lib/supabase'
import type { Sam2SyncPayload, Sam2TowerType } from '@/lib/sam2Types'
import type {
  Site,
  Agreement,
  DocumentRecord,
  ExtractedLeaseDoc,
  InstallationType,
  DocType,
} from './types/lease'

/**
 * Maps our stored data into the Site / Agreement / DocumentRecord[] shapes
 * generateRentSchedule() needs (lib/rentEngine/services/timelineEngine.ts).
 *
 * IMPORTANT SCOPE NOTE: this only builds DocumentRecords from documents that
 * came through the SAM 2.0 sync (site_documents.extracted_terms._sam2_raw
 * present — see app/api/sam2/sync/route.ts). Documents from the legacy
 * upload path (app/api/sites/extract-from-lease) use a different, flatter
 * extracted_terms shape and are not mapped here — feeding those into the
 * engine is separate, unscoped work, not silently guessed at.
 *
 * KNOWN GAP, not fixable on our side alone: the real DocumentRecord type
 * carries `classification` (execution status, instrument role), `lineage`,
 * `delta` (amendment-specific field changes), `validationFlags`, and
 * `rawMarkdown` — none of which SAM2_DOCUMENT_PARSED currently sends us
 * (see lib/sam2Types.ts). This adapter degrades gracefully rather than
 * guessing at any of them:
 *   - classification: left undefined. isInForce() does not exclude a
 *     record with no classification (see types/lease.ts) — absence is
 *     safe, invention would not be.
 *   - lineage: left undefined. buildChain()/resolveLineage() fall back to
 *     date-based ordering when lineage isn't supplied.
 *   - delta: left undefined for amendments, since our payload only ever
 *     carries a full leaseTerms snapshot, never field-level changes. The
 *     engine's documented fallback applies the full term set wholesale and
 *     raises an info-level AMENDMENT_APPLIED_WHOLESALE flag — correct,
 *     visible behavior, just not the precise selective fold a real delta
 *     would give. This is exactly the "document data contract" gap flagged
 *     to Onno on 8/17 — closing it requires SAM 2.0 to start sending delta/
 *     classification/lineage, not a fix on our end.
 *   - status: mapped from our own site_documents.doc_status ('approved' or
 *     'notarized' -> 'confirmed', everything else -> 'pending_review').
 *     This is a real fact we hold, not a guess.
 */

type DbSite = {
  id: string
  site_code: string
  name: string
  address: string
  lat: number | null
  lng: number | null
  created_at?: string | null
}

type DbLicense = {
  id: string
  site_id: string
  licensee_id: string
  status: string
  license_start: string | null
  created_at?: string | null
  tower_sites: DbSite | null
  licensees: { name: string } | null
}

type DbDocument = {
  id: string
  name: string
  doc_type: string
  doc_status: string | null
  file_hash: string | null
  uploaded_at: string | null
  extracted_terms: Record<string, unknown> | null
}

// As of the 2026-08-17 SAM2.0_ingest pull, the engine's InstallationType was
// widened to the same 6 structure values Sam2TowerType already uses — this
// is now a straight identity mapping, not the coarse 4-bucket fold the
// previous engine snapshot required.
const SAM2_TOWER_TO_INSTALLATION: Record<Sam2TowerType, InstallationType> = {
  monopole: 'monopole',
  lattice: 'lattice',
  rooftop: 'rooftop',
  water_tower: 'water_tower',
  guyed: 'guyed',
  small_cell: 'small_cell',
}

const OUR_DOC_TYPE_TO_ENGINE: Record<string, DocType> = {
  lease: 'lease',
  amendment: 'amendment',
  addendum: 'addendum',
  // Our doc_type enum (site_documents.doc_type) is broader than the
  // engine's DocType — anything outside the lease-family set falls back to
  // 'lease' to avoid silently dropping it. In practice these should never
  // reach here: getSam2Payload() below already filters to documents that
  // carry a Sam2SyncPayload, which only ever states one of the 7 engine
  // doc types via documentMetadata.docType.
}

function mapDocStatus(docStatus: string | null): DocumentRecord['status'] {
  if (docStatus === 'approved' || docStatus === 'notarized') return 'confirmed'
  return 'pending_review'
}

function getSam2Payload(extractedTerms: Record<string, unknown> | null): Sam2SyncPayload | null {
  const raw = extractedTerms?.['_sam2_raw']
  if (!raw || typeof raw !== 'object') return null
  return raw as Sam2SyncPayload
}

function toExtractedLeaseDoc(payload: Sam2SyncPayload): ExtractedLeaseDoc {
  return {
    documentMetadata: {
      docType: payload.documentMetadata.docType,
      referenceNumber: payload.documentMetadata.referenceNumber,
      executionDate: payload.documentMetadata.executionDate,
      effectiveDate: payload.documentMetadata.effectiveDate,
      commencementDate: payload.documentMetadata.commencementDate,
      // Not carried by Sam2SyncPayload today — defaults to false (not
      // conditional) rather than guessing at conditional language. Real
      // conditional-commencement leases will need this added to the sync
      // contract to be represented correctly.
      isCommencementConditional: false,
    },
    siteIdentity: {
      siteName: payload.siteIdentity.siteName,
      siteCode: payload.siteIdentity.siteCode,
      rawAddress: payload.siteIdentity.rawAddress,
      lessorName: payload.siteIdentity.lessorName,
      lesseeName: payload.siteIdentity.lesseeName,
      installationType: payload.siteIdentity.installationType
        ? SAM2_TOWER_TO_INSTALLATION[payload.siteIdentity.installationType]
        : 'other',
      // Real fact from the SAM 2.0 payload, not previously mapped because
      // the engine's SiteIdentity had no field for it before this pull.
      heightFt: payload.siteIdentity.heightFt ?? undefined,
    },
    oneTimeFees: (payload.oneTimeFees ?? []).map(f => ({
      description: f.description,
      amount: f.amount,
      dueDateOffsetDays: f.dueDateOffsetDays,
    })),
    // leaseTerms is always a full snapshot in our current payload, never a
    // delta — see the module doc comment above for what this means for
    // amendments in the fold.
    leaseTerms: payload.leaseTerms
      ? {
          baseRent: payload.leaseTerms.baseRent,
          paymentFrequency: payload.leaseTerms.paymentFrequency,
          currency: payload.leaseTerms.currency,
          initialTermMonths: payload.leaseTerms.initialTermMonths,
          expirationDate: payload.leaseTerms.expirationDate,
          isMonthToMonth: payload.leaseTerms.isMonthToMonth,
          renewalOptions: payload.leaseTerms.renewalOptions,
          escalation: payload.leaseTerms.escalation,
        }
      : undefined,
    // delta intentionally omitted — see module doc comment.
  }
}

/** Builds the Site + Agreement pair for one of our internal license IDs. */
export async function buildSiteAndAgreement(
  licenseId: string
): Promise<{ site: Site; agreement: Agreement } | null> {
  const supabase = getSupabase()

  const { data: license, error } = await supabase
    .from('site_licenses')
    .select(`
      id, site_id, licensee_id, status, license_start, created_at,
      tower_sites ( id, site_code, name, address, lat, lng, created_at ),
      licensees ( name )
    `)
    .eq('id', licenseId)
    .single<DbLicense>()

  if (error || !license || !license.tower_sites) return null

  const dbSite = license.tower_sites

  const site: Site = {
    siteId: dbSite.id,
    siteCode: dbSite.site_code,
    siteName: dbSite.name,
    address: dbSite.address,
    geocode: dbSite.lat && dbSite.lng ? { latitude: dbSite.lat, longitude: dbSite.lng } : undefined,
    createdAt: dbSite.created_at ?? new Date(0).toISOString(),
  }

  const agreement: Agreement = {
    agreementId: license.id,
    siteId: dbSite.id,
    tenantName: license.licensees?.name ?? 'Unknown',
    status: (['active', 'pending', 'expired', 'terminated'] as const).includes(license.status as any)
      ? (license.status as Agreement['status'])
      : 'active',
    commencementDate: license.license_start,
    isCommencementConditional: false,
    createdAt: license.created_at ?? new Date(0).toISOString(),
  }

  return { site, agreement }
}

/**
 * Builds the DocumentRecord[] for one agreement — every SAM 2.0-sourced
 * document linked via site_documents.license_id, in the shape the engine
 * expects. See the module doc comment for what's degraded and why.
 */
export async function buildDocumentRecords(licenseId: string): Promise<DocumentRecord[]> {
  const supabase = getSupabase()

  const { data: docs, error } = await supabase
    .from('site_documents')
    .select('id, name, doc_type, doc_status, file_hash, uploaded_at, extracted_terms')
    .eq('license_id', licenseId)
    .returns<DbDocument[]>()

  if (error || !docs) return []

  const records: DocumentRecord[] = []
  for (const doc of docs) {
    const payload = getSam2Payload(doc.extracted_terms)
    if (!payload) continue // legacy-path document — out of scope, see module doc comment

    records.push({
      docId: doc.id,
      agreementId: licenseId,
      siteId: payload.sam2SiteId,
      fileName: doc.name,
      docType: OUR_DOC_TYPE_TO_ENGINE[doc.doc_type] ?? payload.documentMetadata.docType,
      effectiveDate:
        payload.documentMetadata.effectiveDate ?? payload.documentMetadata.executionDate,
      executionDate: payload.documentMetadata.executionDate,
      status: mapDocStatus(doc.doc_status),
      rawMarkdown: '', // not stored — see module doc comment; only used for near-duplicate text comparison, harmless empty
      data: toExtractedLeaseDoc(payload),
      validationFlags: [], // not carried by our sync payload today
      createdAt: doc.uploaded_at ?? new Date(0).toISOString(),
      contentHash: doc.file_hash ?? undefined, // real value — we already compute this for notarization
    })
  }
  return records
}

/**
 * Raw count of site_documents linked to this license (license_id = licenseId),
 * regardless of whether they carry usable SAM 2.0 payload. Lets callers tell
 * "nothing is linked to this license" apart from "documents are linked but
 * predate the SAM 2.0 sync" — buildDocumentRecords() silently drops the
 * latter (see its module doc comment), which otherwise looks identical to
 * zero documents at all once it reaches the engine.
 */
export async function countLinkedDocuments(licenseId: string): Promise<number> {
  const supabase = getSupabase()
  const { count } = await supabase
    .from('site_documents')
    .select('id', { count: 'exact', head: true })
    .eq('license_id', licenseId)
  return count ?? 0
}

/**
 * Full input bundle for generateRentSchedule(), for one of our internal
 * license IDs. Returns null if the license/site can't be resolved.
 */
export async function loadRentScheduleInputs(licenseId: string): Promise<{
  site: Site
  agreement: Agreement
  documents: DocumentRecord[]
} | null> {
  const base = await buildSiteAndAgreement(licenseId)
  if (!base) return null
  const documents = await buildDocumentRecords(licenseId)
  return { ...base, documents }
}
