# SAM 2.0 Integration

How Columbia Wireless Site Asset Management integrates with SAM 2.0 (Onno Stienen's document-parsing/lease-intelligence module). Written to be shareable with the SAM 2.0 side as-is, the "Contract" and "Known gaps / open questions" sections describe the interface between the two systems, not our internal implementation. The "Internal notes" section at the end is us-only.

Last reviewed: 2026-08-14.

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

Confirmed against a real event, 2026-08-13. Full TypeScript shape in `lib/sam2Types.ts`.

```
Sam2SyncPayload {
  sam2SiteId: string          // idempotency key, our tower_sites.sam2_site_id
  sam2AgreementId: string     // idempotency key, our site_licenses.sam2_agreement_id
  sam2DocId: string           // idempotency key, our site_documents.sam2_doc_id
  fileName: string
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
                  appliesToInitialTerm, appliesToRenewalTerms, firstEscalationDate? }
  }
  oneTimeFees?: [{ description, amount, dueDateOffsetDays? }]
  documentMetadata: {
    docType: 'lease'|'addendum'|'amendment'|'termination'|'assignment'|'commencement_agreement'|'management_agreement',
    referenceNumber?, executionDate: string, effectiveDate?, commencementDate?
  }
}
```

Two things worth calling out explicitly since they weren't obvious from the field names alone:
- `installationType` carries the tower type directly, there's no separate `towerType` field despite what an earlier integration draft assumed.
- `city`/`state`/`zip` should be read from `geocode` (SAM 2.0's own geocoding service), not from `siteIdentity`, the latter is rarely populated by extraction.
- Both are `null`/absent (never guessed) when SAM 2.0 can't determine them, this is deliberate zero-hallucination behavior on SAM 2.0's side and we rely on it.

### What we do with it

`app/api/sam2/sync/route.ts`, POST, called by our frontend (`components/sam2/Sam2ImportModal.tsx`) immediately on receiving `SAM2_DOCUMENT_PARSED`.

1. Resolve or create the site by `sam2_site_id`.
2. Fuzzy-match `lessorName` against existing owners (`lib/sam2Match.ts`), link if high-confidence, otherwise leave unlinked and surface a warning.
3. Fuzzy-match `lesseeName` against existing licensees, auto-create if no confident match (new carriers appearing is expected and not treated as an error the way an unmatched owner is).
4. Upsert `site_documents` by `sam2_doc_id`.
5. Upsert `site_licenses` by `sam2_agreement_id`, computing `annual_rent` from `leaseTerms.baseRent × frequency multiplier`, and flattening `leaseTerms.escalation` into a legacy flat `escalation_rate` percentage (full detail kept separately in `escalation_detail`, see "Known gaps" below for why this matters).
6. Return `{ siteId, licenseId, documentId, hostAgency, licensee, warnings[] }`. `warnings` surfaces anything that needs manual follow-up (owner not confidently matched, tower type defaulted, geocode missing, etc.), shown in our UI as a "Needs review" list.

All three sync keys (`sam2_site_id`, `sam2_agreement_id`, `sam2_doc_id`) are unique and looked up before insert, so re-POSTing the same document is safe and idempotent.

### Confirmed behavior: undefined terms on amendments

Per Onno (2026-08): when an amendment/addendum doesn't restate a term, the previously-valid document's value carries forward, it isn't treated as zero or blank. This matters directly for `annual_rent`, if an addendum only states a changed escalation rate and doesn't restate the base rent, SAM 2.0 fills in the last-known base rent rather than sending us a value that would zero out the rent on sync.

## Known gaps / open questions

These were raised with Onno on 2026-08-13/14, tracked here so the state is visible without digging through email.

1. **Server-to-server intake.** SAM 2.0 today only accepts documents through the interactive iframe, there's no API for our backend to push a file and get a result back asynchronously. We've asked whether SAM 2.0 could expose an upload endpoint plus a webhook or status-poll, so our own upload panel can become the single intake point (saving the source file immediately, forwarding to SAM 2.0 for parsing) instead of running a separate extraction pipeline. Not yet answered.

2. **Source file retention.** SAM 2.0 syncs extracted data but never writes the original file to our Storage, and the payload carries no file reference we could fetch by. Documents processed through SAM 2.0 have no retrievable source file in our platform today; documents uploaded through our own per-site Documents tab do. Not yet resolved.

3. **Correcting flagged fields.** SAM 2.0 flags uncertain fields for accept/deny, there's no way to edit a value there today. Three options are on the table with Onno, to be discussed on a call rather than decided over email: (A) SAM 2.0 sends us the flagged fields (value/confidence/reason) instead of only the final resolved payload, and correction happens in our existing edit-and-save interface; (B) same as A, but the correction is also sent back to SAM 2.0 so both systems stay in sync; (C) SAM 2.0 builds its own edit capability, unchanged on our end. SAM 2.0's validation itself is the valuable part in all three options, the question is only where the correction gets entered.

4. **Addendum-to-existing-lease behavior, unverified end to end.** We know undefined-term carry-forward works as described above, but we haven't yet confirmed whether an addendum for an existing lease lands against the same `sam2AgreementId` (updating the existing `site_licenses` row) or generates a new one (creating a duplicate we'd have to reconcile manually). A live test with a real addendum is planned, see the SAM 2.0 Batch Import Test Guide.

5. **Escalation types beyond fixed-percentage/flat-dollar.** `simplifyEscalationRate()` on our side flattens CPI-indexed and other non-fixed-percentage escalation clauses to `escalation_rate: 0` (with a warning) because our legacy rent calculator only ever reads that flat column. The full clause is preserved in `escalation_detail`, but nothing currently computes rent from it. This is a gap on our side, not SAM 2.0's, flagged here because it directly affects how useful SAM 2.0's richer escalation data actually is to us today.

## Internal notes (not for external sharing)

- Env var: `NEXT_PUBLIC_SAM2_URL`. Not passed as a Docker build arg (see `ARCHITECTURE.md`), which is why `Sam2LeaseModule.tsx` has a hardcoded production-URL fallback rather than relying on the env var alone.
- CSP: SAM 2.0's `frame-ancestors` header controls whether our iframe embed is allowed, this is Onno's server config, not ours. Has broken and been re-fixed on his side before, if the iframe silently shows a blank/blocked frame, check the browser console for a CSP error before assuming it's our bug.
- `DOC_TYPE_MAP` in `sync/route.ts` maps SAM 2.0's `docType` enum to our own `site_documents.doc_type` enum, `addendum` and `amendment` both collapse to our `amendment` type; `termination`/`assignment`/`commencement_agreement`/`management_agreement` all collapse to `other`. If a new SAM 2.0 doc type shows up unmapped, it'll fall through to `other` silently, worth an occasional check.
- `/api/sam2/sync` is one of the few routes in the app with real role enforcement (`canEdit`, editor+), see `API_REFERENCE.md`. Don't weaken this when touching the route.
