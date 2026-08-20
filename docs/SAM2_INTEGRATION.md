# SAM 2.0 Integration

How Columbia Wireless Site Asset Management integrates with SAM 2.0 (Onno Stienen's document-parsing/lease-intelligence module). Written to be shareable with the SAM 2.0 side as-is, the "Contract" and "Known gaps / open questions" sections describe the interface between the two systems, not our internal implementation. The "Internal notes" section at the end is us-only.

Last reviewed: 2026-08-18.

**Sync mechanism decision (2026-08-18): moving from the iframe event to a server-side webhook.** The iframe `SAM2_DOCUMENT_PARSED` event only fires while a panel is open and connected — no replay on connect, and it can't distinguish "new to the world" from "new to this browser session." That's fundamentally incompatible with unattended/batch/onboarding sync. We're building against a webhook instead. As of this writing none of the following exist yet on SAM 2.0's side: the webhook itself, its auth, retry policy, a backfill endpoint, a multi-tenancy identifier on the payload, the correction-intake endpoint + auth, or a test/staging trigger — all requested from Onno, unanswered as of 2026-08-18. The iframe pathway described below still works today and is what task #16 (first live end-to-end test) uses in the meantime.

## Overview

SAM 2.0 is embedded as an iframe inside our Site Portfolio page ("Batch Import (SAM 2.0)"). It handles document upload, AI extraction, and a review/flagging step, then hands a parsed result back to us via `postMessage`, which we sync into our own database.

## Contract

### Embed and handshake

Component: `components/sam2/Sam2LeaseModule.tsx`. The iframe loads `NEXT_PUBLIC_SAM2_URL` (production: `https://sam2-74901225976.us-central1.run.app`). Handshake sequence over `window.postMessage`:

1. Iframe loads, SAM 2.0 posts `SAM2_READY` to the parent.
2. Parent responds with `SAM2_INIT`, payload `{ token, siteId, user: { id, email } | null }`, `token` is the caller's Supabase auth access token, `siteId` is set only when scoping SAM 2.0 to a single site (omitted for the batch/portfolio-wide import flow).
3. When a document finishes processing, SAM 2.0 posts `SAM2_DOCUMENT_PARSED` with the extracted record (see Payload below).
4. SAM 2.0 may also post `SAM2_RECONCILIATION_UPDATED` (received, currently not acted on beyond passing through to a callback).

The parent only accepts messages whose `event.origin` matches the configured SAM 2.0 URL's origin.

### Payload shape (`SAM2_DOCUMENT_PARSED`)

**Corrected 2026-08-18.** The shape documented here as "confirmed 8/13/26" was wrong — it had never actually been exercised against a real payload (the one live end-to-end test, task #16, hadn't been run yet), so the error went undetected and every real sync call would have 400'd. Confirmed directly against SAM 2.0's live code with Onno (citing `App.tsx` and `iframeBridge.ts`). Full TypeScript shape in `lib/sam2Types.ts`.

```
Sam2SyncPayload {
  documentId: string           // idempotency key, our site_documents.sam2_doc_id
  siteId: string                // idempotency key, our tower_sites.sam2_site_id
  agreementId: string           // idempotency key, our site_licenses.sam2_agreement_id
  fileName: string
  documentType: 'lease'|'addendum'|'amendment'|'unknown'
  extractedData: {
    siteIdentity: {
      siteName?, siteCode?, rawAddress: string,
      lessorName: string, lesseeName: string,
      installationType: 'monopole'|'lattice'|'rooftop'|'water_tower'|'guyed'|'small_cell'|null,
      heightFt?, city?, state?, zip?   // city/state/zip here are rarely populated, see geocode below
    }
    geocode?: { latitude, longitude, formattedAddress?, city?, state?, postalCode? }
    leaseTerms?: {
      baseRent: number, paymentFrequency: 'monthly'|'quarterly'|'annually', currency: string,
      initialTermMonths: number, expirationDate?, isMonthToMonth?,
      renewalOptions: { count, durationMonths, isAutomatic, noticePeriodMonths },
      escalation: { type: 'fixed_percentage'|'fixed_amount'|'cpi'|'none', value, frequencyMonths,
                    appliesToInitialTerm, appliesToRenewalTerms, firstEscalationDate?,
                    cpiRateOverride?, cpiSeries? }
    }
    oneTimeFees?: [{ description, amount, dueDateOffsetDays? }]
    documentMetadata: {
      docType: 'lease'|'addendum'|'amendment'|'termination'|'assignment'|'commencement_agreement'|'management_agreement',
      referenceNumber?, executionDate: string, effectiveDate?, commencementDate?
    }
    classification?: { role, nonInstrumentKind?, executionStatus, executionEvidence[], signatures[] }
    delta?: { changes[], ratifiesRemainder, recitedCurrentRent?, amendsReference? }
    utilities?: { billingType, baseMonthlyAmount?, powerLimitKw?, meterInstallationResponsibility?: 'lessor'|'lessee' }
    holdover?: { multiplier: number, maxHoldoverDays? }
    insuranceRequirements?: { generalLiabilityLimit: number, aggregateLimit: number, requiresAdditionalInsured: boolean }
    legalTerms?: { /* NEW 2026-08-20, exact field names not yet confirmed against source — see note below */ }
  }
  lineage: { ordinal, fileNameOrdinalHint, amendsDocId, supersedesDocId, supersededByDocId,
             duplicateOfDocId, terminatesDocId } | null
  validationFlags: [{ code, message, severity, status, details? }]
  timestamp: string
}
```

Things worth calling out explicitly since they weren't obvious from the field names/nesting alone:
- Only `documentId`/`siteId`/`agreementId`/`fileName`/`documentType`/`lineage`/`validationFlags`/`timestamp` are top-level. Everything else — `siteIdentity`, `leaseTerms`, `documentMetadata`, `oneTimeFees`, `geocode`, `classification`, `delta` — is nested under `extractedData`.
- `installationType` carries the tower type directly, there's no separate `towerType` field despite what an earlier integration draft assumed.
- `city`/`state`/`zip` should be read from `geocode` (SAM 2.0's own geocoding service), not from `siteIdentity`, the latter is rarely populated by extraction.
- Both are `null`/absent (never guessed) when SAM 2.0 can't determine them, this is deliberate zero-hallucination behavior on SAM 2.0's side and we rely on it.
- `lineage` is `null` until SAM 2.0's cross-document lineage pass resolves it, not the same as "resolved, no relationship." SAM 2.0 re-announces `SAM2_DOCUMENT_PARSED` (same `documentId`) when lineage changes, so treat incoming events as an upsert keyed on `documentId`, not a one-shot creation event. Our sync route is idempotent this way already.
- `classification.role` of `non_instrument` or `exhibit` marks documents that aren't lease instruments (tax forms, insurance certs, correspondence, etc.) — see "Non-instrument documents" below.
- CPI escalation (`type: 'cpi'`) is now fully supported on our side, see "CPI escalation" below — no longer flattened away.
- **2026-08-20 field parity update.** We compared the legacy in-house extractor's field list against this payload and sent Onno a gap list (`utilities`/`holdover`/`insuranceRequirements` turned out to already exist, just undocumented here — now added above and wired into `extracted_terms` as `utilities`/`holdover_provisions`/`insurance_per_occurrence`/`insurance_aggregate`/`insurance_liability`). Onno also shipped a brand-new `legalTerms` block the same day (premises description, governing law, permitted use, assignment allowed, termination notice days, relocation provisions, equipment description, catch-all notes) — **not yet wired into our sync route**, because our local SAM 2.0 checkout predates it and we don't have the confirmed field names/types. Waiting on Onno's exact TS shape before mapping it (same "never guess a field path" rule as everything else here). Forward-only: documents already filed before this change keep their old extraction, no bulk reprocessing tool exists yet.

### What we do with it

`app/api/sam2/sync/route.ts`, POST, called by our frontend (`components/sam2/Sam2ImportModal.tsx`) immediately on receiving `SAM2_DOCUMENT_PARSED`.

1. Check `extractedData.classification?.role` — if `non_instrument` or `exhibit`, branch to the non-instrument path (below) instead of the normal flow.
2. Resolve or create the site by `siteId`.
3. Fuzzy-match `lessorName` against existing owners (`lib/sam2Match.ts`), link if high-confidence, otherwise leave unlinked and surface a warning.
4. Fuzzy-match `lesseeName` against existing licensees, auto-create if no confident match (new carriers appearing is expected and not treated as an error the way an unmatched owner is).
5. Upsert `site_documents` by `sam2_doc_id`, including `lineage` and `validationFlags` (previously dropped/hardcoded to `[]`, now stored).
6. Upsert `site_licenses` by `sam2_agreement_id`, computing `annual_rent` from `leaseTerms.baseRent × frequency multiplier`. CPI escalation clauses are no longer flattened away, see "CPI escalation" below.
7. Return `{ siteId, licenseId, documentId, hostAgency, licensee, warnings[] }`. `licenseId` is `null` for non-instrument documents. `warnings` surfaces anything that needs manual follow-up (owner not confidently matched, tower type defaulted, geocode missing, etc.), shown in our UI as a "Needs review" list.

All three sync keys (`siteId`, `agreementId`, `documentId`) are unique and looked up before insert, so re-POSTing the same document (including a lineage re-announce) is safe and idempotent.

### Review/approval happens in our UI, never in SAM 2.0's

**2026-08-18 decision.** The SAM 2.0 iframe (and its future webhook replacement) is drop-and-parse only — it is not where a user accepts, edits, or ignores an extracted field. That happens entirely in our own UI, reusing the same `TermsReviewModal` component (colored confidence dots, click-to-edit, "Approve All") already built for the legacy in-house Anthropic-extraction flow.

Mechanics: every lease-family document synced through `/api/sam2/sync` lands with `site_documents.doc_status = 'review_required'` (already-approved documents are left alone on re-sync). This isn't just a UI label — `lib/rentEngine/adapter.ts` maps anything other than `approved`/`notarized` to the engine's `pending_review` status, and `leaseChain.ts` excludes non-`confirmed` documents from the schedule fold outright. So an unreviewed SAM 2.0 document cannot affect a rent number until a human clicks "Approve All," which is real, pre-existing engine behavior, not something built new for this. Non-instrument documents get `extracted` directly since there's no lease term to approve.

`Sam2ImportModal.tsx` surfaces a "Review now" prompt for each document that comes back `needsReview: true` and opens `TermsReviewModal` right there, so the reviewer never needs to go near SAM 2.0's own interface. SAM 2.0's per-field confidence signal is narrower than the legacy modal's four-level scale (SAM 2.0 gives value-or-null plus a separate `validationFlags` array, not a graded score) — flags are surfaced as a note rather than mapped onto a specific term.

### Non-instrument documents

Some documents filed into SAM 2.0 aren't lease instruments at all — tax forms, insurance certificates, ledgers/invoices, correspondence, photos/plans. SAM 2.0 flags these via `extractedData.classification.role === 'non_instrument'` (or `'exhibit'`). Per our own decision (2026-08-18, not something asked of Onno — this is entirely our-side handling): these are stored and attached to their site but must never fabricate a licensee or license record, since they don't name real lease parties.

- Existing site: the document is stored and attached; licensee/license resolution is skipped entirely (`licenseeId`/`licenseId` both `null`). The site itself is never touched — no field updates from a non-instrument document's sparse extraction, to avoid clobbering good lease-derived data.
- No matching site yet: a minimal shell site is created (address/geocode only, no owner match, tower type defaulted) and flagged with a warning for later completion, still no licensee/license.
- The rent engine (`lib/rentEngine/services/leaseChain.ts`) independently already excludes `role === 'non_instrument'`/`'exhibit'` documents from the schedule fold with a human-readable exclusion reason — this was already correct before the sync-route fix above.

### CPI escalation

As of 2026-08-18 the engine (`lib/rentEngine/services/cpiService.ts`, ported from SAM 2.0's `SAM2.0_ingest` branch) fully supports `type: 'cpi'` escalation clauses via a three-tier resolution: manual `cpiRateOverride` (set via SAM 2.0's HITL review drawer) → SAM 2.0's own extracted rate → a BLS historical CPI-U lookup table by year (2000–2026, 3% default outside that range). This replaces an earlier stale local engine snapshot that refused to schedule CPI leases at all (`CPI_INDEX_UNAVAILABLE`) — that was a bug in our ported copy, not a SAM 2.0 limitation; the real `SAM2.0_ingest` branch had CPI support from commit `824bd35` (Aug 11) onward.

### Confirmed behavior: undefined terms on amendments

Per Onno (2026-08): when an amendment/addendum doesn't restate a term, the previously-valid document's value carries forward, it isn't treated as zero or blank. This matters directly for `annual_rent`, if an addendum only states a changed escalation rate and doesn't restate the base rent, SAM 2.0 fills in the last-known base rent rather than sending us a value that would zero out the rent on sync.

## Known gaps / open questions

Items 1-4 below (webhook, correction write-back) were sent to Onno as `sam2-webhook-and-correction-ask.md` on 2026-08-18; none were built yet as of his last reply that day. Item 5 is resolved (see CPI escalation above).

1. **Webhook (SAM 2.0 to us) — none of this exists yet.** The webhook itself, an auth/signing method, retry behavior (does SAM 2.0 retry failed deliveries, how many times, what backoff), a backfill endpoint ("what's changed since X," for historical documents and downtime gaps), and a multi-tenancy identifier on the payload (a server-to-server call has no logged-in user, so we need a way to know which of our organizations a document belongs to).

2. **Correction write-back (us to SAM 2.0) — live as of 2026-08-19.** `lib/sam2Corrections.ts` sends corrections to `POST https://sam2-ppwakvoaoa-uc.a.run.app/api/corrections` (overridable via `SAM2_CORRECTIONS_URL`), auth via an `X-Correction-Secret` header checked against `SAM2_CORRECTION_SECRET`. Payload: `{ documentId, siteId, agreementId, fieldPath, oldValue, newValue, correctedBy, correctedAt }`. SAM 2.0 does a three-way check against the value we claim is current (matches new → confirms, safe to resend; matches old → applies and logs; matches neither → rejects with the real current value) and re-validates the document afterward, only adding new flags. Wired into `app/api/sites/[id]/documents/[docId]/terms/route.ts` — a correction made in `TermsReviewModal` for a SAM 2.0-sourced document now also gets sent to SAM 2.0, for the same field set `applyCorrectionToSam2Raw()` knows how to patch locally (`FIELD_TO_SAM2_PATH` in `lib/sam2Corrections.ts`). **`SAM2_CORRECTION_SECRET` is not set yet** — Onno deliberately didn't send it over plain email; exchange channel still needs to be agreed. Until it's set, `sendCorrectionToSam2()` no-ops (logs a warning, returns `ok:false`) rather than blocking the local save — the correction always lands in our database either way.

3. **Open operational questions, answered in part by Onno on 2026-08-18:** bulk onboarding fires one webhook event per document, no throttling, back-to-back — Onno agrees this workload belongs on the backfill endpoint (item 1), not live webhook deliveries. Lineage re-announces happen right after a batch finishes filing, not on a fixed schedule (near-immediate for one document, could be minutes for a large batch — design for "arrives sometime after the first event," not a fixed window). Ordering: filing is sequential on SAM 2.0's side today so order is predictable within a run, but that doesn't automatically hold once it's a real HTTP webhook with retries — Onno describes this as "a real design decision, not something current code already answers," still open. Test/staging trigger (a way to validate our receiver without a real client document) — asked, not yet answered.

4. **Source file retention.** SAM 2.0 syncs extracted data but never writes the original file to our Storage, and the payload carries no file reference we could fetch by. Documents processed through SAM 2.0 have no retrievable source file in our platform today; documents uploaded through our own per-site Documents tab do. Not yet resolved.

5. **Addendum-to-existing-lease behavior, unverified end to end.** We know undefined-term carry-forward works as described above, but we haven't yet confirmed whether an addendum for an existing lease lands against the same `agreementId` (updating the existing `site_licenses` row) or generates a new one (creating a duplicate we'd have to reconcile manually). This is exactly what the live end-to-end test (task #16, blocked only on redeploying the payload-shape fix) will confirm.

## Internal notes (not for external sharing)

- Env var: `NEXT_PUBLIC_SAM2_URL`. Not passed as a Docker build arg (see `ARCHITECTURE.md`), which is why `Sam2LeaseModule.tsx` has a hardcoded production-URL fallback rather than relying on the env var alone.
- CSP: SAM 2.0's `frame-ancestors` header controls whether our iframe embed is allowed, this is Onno's server config, not ours. Has broken and been re-fixed on his side before, if the iframe silently shows a blank/blocked frame, check the browser console for a CSP error before assuming it's our bug.
- `DOC_TYPE_MAP` in `sync/route.ts` maps SAM 2.0's `docType` enum to our own `site_documents.doc_type` enum, `addendum` and `amendment` both collapse to our `amendment` type; `termination`/`assignment`/`commencement_agreement`/`management_agreement` all collapse to `other`. Non-instrument documents are forced to `other` regardless of any `docType` value. If a new SAM 2.0 doc type shows up unmapped, it'll fall through to `other` silently, worth an occasional check.
- `/api/sam2/sync` is one of the few routes in the app with real role enforcement (`canEdit`, editor+), see `API_REFERENCE.md`. Don't weaken this when touching the route.
- `lib/rentEngine/adapter.ts` maps this payload into the rent engine's own types (`ExtractedLeaseDoc`, `DocumentRecord`). `SAM2_TOWER_TO_INSTALLATION` is a direct identity mapping now (all 6 `Sam2TowerType` values match the engine's `InstallationType` 1:1) — it used to be a lossy 4-value fold, widened 2026-08-18.
- `countLinkedDocuments(licenseId)` (adapter.ts) backs the Rent Schedule tab's distinction between "no documents linked yet" and "documents linked but none came through SAM 2.0 sync" — see `linkedDocumentCount` in `app/api/rent-schedule/[licenseId]/route.ts`.
