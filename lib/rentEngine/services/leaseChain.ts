import {
  AMENDING_ROLES,
  DocType,
  DocumentLineage,
  DocumentRecord,
  HoldoverInfo,
  InstrumentRole,
  InsuranceRequirements,
  LeaseFieldPath,
  LeaseTerms,
  TermChange,
  UtilitiesInfo,
  isInForce,
  roleOf,
} from '../types/lease';
import { NEAR_DUPLICATE_THRESHOLD, textSimilarity } from './documentIdentity';

/**
 * Ordering, lineage and folding for a chain of lease documents.
 *
 * A carrier at an address is rarely one document. It is an original agreement plus a run of
 * amendments, renewals, assignments and sometimes a termination, and the rent actually
 * payable is the result of folding that run in order. This module is the only place that
 * decides what an amendment means; the schedule and the consistency checks both read from
 * here so they cannot disagree.
 */

export type ChainObservationCode =
  | 'NO_BASE_INSTRUMENT'
  | 'BASE_HAS_NO_TERMS'
  | 'MULTIPLE_BASE_INSTRUMENTS'
  | 'AMENDMENT_ORDINAL_GAP'
  | 'AMENDMENT_ORDINAL_DUPLICATE'
  | 'ORDINAL_SOURCE_CONFLICT'
  | 'CHAIN_ORDER_AMBIGUOUS'
  | 'AMENDMENT_TARGET_UNRESOLVED'
  | 'AMENDMENT_APPLIED_WHOLESALE'
  | 'AMENDMENT_STATES_NO_CHANGES'
  | 'UNSUPPORTED_TERM_REMOVAL'
  | 'TERMINATION_DATE_UNKNOWN'
  | 'POST_TERMINATION_AMENDMENT';

export interface ChainObservation {
  code: ChainObservationCode;
  severity: 'error' | 'warning' | 'info';
  message: string;
  docIds: string[];
  details?: Record<string, unknown>;
}

/** Which document, and which words in it, put a value into the folded state. */
export interface ProvenanceEntry {
  docId: string;
  /** Verbatim clause. Null when the instrument was applied whole rather than as named changes. */
  sourceQuote: string | null;
}

export interface FoldedState {
  terms: LeaseTerms;
  lessorName: string;
  lesseeName: string;
  commencementDate: string | null;
  utilities?: UtilitiesInfo;
  holdover?: HoldoverInfo;
  insuranceRequirements?: InsuranceRequirements;
}

/** A span over which one set of terms was in force. */
export interface TermEpoch extends FoldedState {
  /** YYYY-MM-DD, inclusive. */
  from: string;
  /** YYYY-MM-DD, inclusive. Null means the epoch runs to the end of the schedule. */
  to: string | null;
  sourceDocId: string;
  sourceDocReference: string;
  sourceDocType: DocType;
  provenance: Partial<Record<LeaseFieldPath, ProvenanceEntry>>;
}

export interface LeaseChain {
  base: DocumentRecord | null;
  /** In-force instruments in chain order, base first, termination last. */
  ordered: DocumentRecord[];
  /** Documents held out of the fold, with the reason. */
  excluded: { doc: DocumentRecord; reason: string }[];
  observations: ChainObservation[];
}

export interface ChainFold {
  epochs: TermEpoch[];
  /** YYYY-MM-DD the agreement was terminated, when a termination instrument is in force. */
  terminationDate: string | null;
  observations: ChainObservation[];
}

/** Roles that establish or wholly replace the term set. */
const REPLACING_ROLES: readonly InstrumentRole[] = ['base', 'master', 'restatement'];

function effectiveDateOf(doc: DocumentRecord): string {
  return doc.effectiveDate || doc.executionDate || '';
}

function referenceOf(doc: DocumentRecord): string {
  return doc.data.documentMetadata.referenceNumber || doc.fileName;
}

function ordinalOf(doc: DocumentRecord): number | null {
  const value = doc.lineage?.ordinal?.value;
  return typeof value === 'number' ? value : null;
}

/** base sorts first, terminations last, everything else in between. */
function roleRank(role: InstrumentRole): number {
  if (role === 'base' || role === 'master') return 0;
  if (role === 'termination') return 2;
  return 1;
}

function compareByDate(a: DocumentRecord, b: DocumentRecord): number {
  const rank = roleRank(roleOf(a)) - roleRank(roleOf(b));
  if (rank !== 0) return rank;

  const effA = effectiveDateOf(a);
  const effB = effectiveDateOf(b);
  if (effA !== effB) return effA < effB ? -1 : 1;

  const exeA = a.executionDate || '';
  const exeB = b.executionDate || '';
  if (exeA !== exeB) return exeA < exeB ? -1 : 1;

  // Deterministic tiebreak, so two documents dated identically never reorder between runs.
  return a.docId < b.docId ? -1 : a.docId > b.docId ? 1 : 0;
}

/**
 * Orders one agreement's documents into a chain.
 *
 * Dates give a total order that always exists. Where every amending instrument states its
 * own ordinal, that ordering governs instead — an instrument that calls itself the Fourth
 * Amendment is the fourth regardless of the date someone wrote on it — and a disagreement
 * between the two is reported rather than silently resolved.
 */
export function buildChain(documents: DocumentRecord[]): LeaseChain {
  const observations: ChainObservation[] = [];
  const excluded: { doc: DocumentRecord; reason: string }[] = [];
  const inForce: DocumentRecord[] = [];

  for (const doc of documents) {
    if (isInForce(doc)) {
      inForce.push(doc);
      continue;
    }
    excluded.push({ doc, reason: exclusionReason(doc) });
  }

  const byDate = [...inForce].sort(compareByDate);

  // Re-order the amending instruments by ordinal when all of them state one.
  const amending = byDate.filter((d) => AMENDING_ROLES.includes(roleOf(d)));
  const allHaveOrdinals = amending.length > 0 && amending.every((d) => ordinalOf(d) !== null);

  let ordered = byDate;
  if (allHaveOrdinals) {
    const byOrdinal = [...amending].sort((a, b) => {
      const diff = (ordinalOf(a) as number) - (ordinalOf(b) as number);
      return diff !== 0 ? diff : compareByDate(a, b);
    });

    const reordered = amending.some((doc, i) => doc.docId !== byOrdinal[i].docId);
    if (reordered) {
      observations.push({
        code: 'CHAIN_ORDER_AMBIGUOUS',
        severity: 'warning',
        message:
          'The amendment numbering and the effective dates put these instruments in ' +
          'different orders. The stated numbering governs, because the instruments assert it.',
        docIds: amending.map((d) => d.docId),
      });
    }

    let next = 0;
    ordered = byDate.map((doc) =>
      AMENDING_ROLES.includes(roleOf(doc)) ? byOrdinal[next++] : doc
    );
  }

  observations.push(...inspectOrdinals(amending));

  const bases = ordered.filter((d) => roleOf(d) === 'base');
  const base = ordered.find((d) => REPLACING_ROLES.includes(roleOf(d))) ?? null;

  if (!base) {
    observations.push({
      code: 'NO_BASE_INSTRUMENT',
      severity: 'error',
      message:
        'No original agreement is present for this tenant. Amendments modify terms they do ' +
        'not restate, so a schedule cannot be built from amendments alone.',
      docIds: ordered.map((d) => d.docId),
    });
  } else if (bases.length > 1) {
    observations.push({
      code: 'MULTIPLE_BASE_INSTRUMENTS',
      severity: 'warning',
      message:
        `${bases.length} original agreements are filed against this tenant. They may be ` +
        'separate agreements rather than one chain.',
      docIds: bases.map((d) => d.docId),
    });
  }

  return { base, ordered, excluded, observations };
}

function exclusionReason(doc: DocumentRecord): string {
  if (doc.status !== 'confirmed') return `Not confirmed (${doc.status}).`;

  const classification = doc.data.classification;
  if (classification) {
    if (classification.executionStatus === 'draft') return 'Not executed — a draft.';
    if (classification.executionStatus === 'unknown') {
      return 'No signature evidence found, so it is not treated as executed.';
    }
    if (classification.role === 'non_instrument') {
      return `Not a contract (${classification.nonInstrumentKind ?? 'other'}).`;
    }
    if (classification.role === 'exhibit') return 'An exhibit to another instrument.';
  }

  if (doc.lineage?.duplicateOfDocId) return 'A duplicate of another filed document.';
  if (doc.lineage?.supersededByDocId) return 'Superseded by a later revision.';
  return 'Excluded from the chain.';
}

function inspectOrdinals(amending: DocumentRecord[]): ChainObservation[] {
  const observations: ChainObservation[] = [];
  const numbered = amending.filter((d) => ordinalOf(d) !== null);
  if (numbered.length === 0) return observations;

  const seen = new Map<number, DocumentRecord[]>();
  for (const doc of numbered) {
    const value = ordinalOf(doc) as number;
    const list = seen.get(value) ?? [];
    list.push(doc);
    seen.set(value, list);
  }

  for (const [value, docs] of seen) {
    if (docs.length > 1) {
      observations.push({
        code: 'AMENDMENT_ORDINAL_DUPLICATE',
        severity: 'error',
        message: `${docs.length} different instruments each call themselves amendment ${value}.`,
        docIds: docs.map((d) => d.docId),
        details: { ordinal: value },
      });
    }
  }

  const highest = Math.max(...seen.keys());
  const missing: number[] = [];
  for (let n = 1; n <= highest; n++) {
    if (!seen.has(n)) missing.push(n);
  }

  if (missing.length > 0) {
    observations.push({
      code: 'AMENDMENT_ORDINAL_GAP',
      severity: 'error',
      message:
        `Amendment${missing.length > 1 ? 's' : ''} ${missing.join(', ')} ` +
        `${missing.length > 1 ? 'are' : 'is'} not in this record set, but amendment ${highest} ` +
        'is. The missing instruments may change terms the later ones assume, so any schedule ' +
        'built from what is here could be wrong.',
      docIds: numbered.map((d) => d.docId),
      details: { missing, highest },
    });
  }

  for (const doc of numbered) {
    const hint = doc.lineage?.fileNameOrdinalHint;
    const stated = ordinalOf(doc) as number;
    if (typeof hint === 'number' && hint !== stated) {
      observations.push({
        code: 'ORDINAL_SOURCE_CONFLICT',
        severity: 'warning',
        message:
          `The file is named as amendment ${hint} but the document text says amendment ` +
          `${stated}. The text governs.`,
        docIds: [doc.docId],
        details: { fileNameOrdinal: hint, statedOrdinal: stated },
      });
    }
  }

  return observations;
}

function cloneTerms(terms: LeaseTerms): LeaseTerms {
  return {
    ...terms,
    renewalOptions: { ...terms.renewalOptions },
    escalation: { ...terms.escalation },
  };
}

function cloneState(state: FoldedState): FoldedState {
  return {
    terms: cloneTerms(state.terms),
    lessorName: state.lessorName,
    lesseeName: state.lesseeName,
    commencementDate: state.commencementDate,
    utilities: state.utilities ? { ...state.utilities } : undefined,
    holdover: state.holdover ? { ...state.holdover } : undefined,
    insuranceRequirements: state.insuranceRequirements
      ? { ...state.insuranceRequirements }
      : undefined,
  };
}

function stateFromDocument(doc: DocumentRecord, terms: LeaseTerms): FoldedState {
  return {
    terms: cloneTerms(terms),
    lessorName: doc.data.siteIdentity.lessorName,
    lesseeName: doc.data.siteIdentity.lesseeName,
    commencementDate: doc.data.documentMetadata.commencementDate ?? null,
    utilities: doc.data.utilities ? { ...doc.data.utilities } : undefined,
    holdover: doc.data.holdover ? { ...doc.data.holdover } : undefined,
    insuranceRequirements: doc.data.insuranceRequirements
      ? { ...doc.data.insuranceRequirements }
      : undefined,
  };
}

/**
 * Applies one named change to the folded state.
 *
 * Returns an observation when the instrument asks for something the model cannot express —
 * removing a rent, for instance. Such a change is skipped and reported, never approximated.
 */
function applyChange(
  state: FoldedState,
  change: TermChange,
  docId: string
): ChainObservation | null {
  const { path, operation, value } = change;

  if (operation === 'remove') {
    switch (path) {
      case 'leaseTerms.escalation':
        state.terms.escalation = {
          type: 'none',
          value: 0,
          frequencyMonths: 0,
          appliesToInitialTerm: false,
          appliesToRenewalTerms: false,
        };
        break;
      case 'leaseTerms.renewalOptions':
        state.terms.renewalOptions = {
          count: 0,
          durationMonths: 0,
          isAutomatic: false,
          noticePeriodMonths: 0,
        };
        break;
      case 'leaseTerms.expirationDate':
        delete state.terms.expirationDate;
        break;
      case 'leaseTerms.isMonthToMonth':
        state.terms.isMonthToMonth = false;
        break;
      case 'utilities':
        state.utilities = undefined;
        break;
      case 'holdover':
        state.holdover = undefined;
        break;
      case 'insuranceRequirements':
        state.insuranceRequirements = undefined;
        break;
      default:
        return {
          code: 'UNSUPPORTED_TERM_REMOVAL',
          severity: 'error',
          message:
            `An instrument strikes "${path}", which leaves no value in its place. The ` +
            'resulting terms would be incomplete, so the change has not been applied.',
          docIds: [docId],
          details: { path },
        };
    }
    return null;
  }

  switch (path) {
    case 'leaseTerms.baseRent':
      state.terms.baseRent = value as number;
      break;
    case 'leaseTerms.paymentFrequency':
      state.terms.paymentFrequency = value as LeaseTerms['paymentFrequency'];
      break;
    case 'leaseTerms.currency':
      state.terms.currency = value as string;
      break;
    case 'leaseTerms.initialTermMonths':
      state.terms.initialTermMonths = value as number;
      break;
    case 'leaseTerms.expirationDate':
      state.terms.expirationDate = value as string;
      break;
    case 'leaseTerms.isMonthToMonth':
      state.terms.isMonthToMonth = value as boolean;
      break;
    case 'leaseTerms.escalation':
      state.terms.escalation = { ...(value as LeaseTerms['escalation']) };
      break;
    case 'leaseTerms.renewalOptions':
      state.terms.renewalOptions = { ...(value as LeaseTerms['renewalOptions']) };
      break;
    case 'utilities':
      state.utilities = value as UtilitiesInfo;
      break;
    case 'holdover':
      state.holdover = value as HoldoverInfo;
      break;
    case 'insuranceRequirements':
      state.insuranceRequirements = value as InsuranceRequirements;
      break;
    case 'siteIdentity.lesseeName':
      state.lesseeName = value as string;
      break;
    case 'siteIdentity.lessorName':
      state.lessorName = value as string;
      break;
    case 'documentMetadata.commencementDate':
      state.commencementDate = value as string;
      break;
  }

  return null;
}

interface Mutation {
  at: string;
  order: number;
  doc: DocumentRecord;
  changes: TermChange[] | null;
}

/**
 * Folds the chain into the successive sets of terms that were in force.
 *
 * An amendment carrying a `delta` is applied field by field: terms it does not name are
 * inherited untouched. An older record with no delta but a full term set is applied whole,
 * which is what it meant when it was written, and that is recorded so the difference is
 * visible rather than assumed away.
 */
export function computeEpochs(chain: LeaseChain): ChainFold {
  const observations: ChainObservation[] = [];
  const epochs: TermEpoch[] = [];

  const base = chain.base;
  if (!base) return { epochs, terminationDate: null, observations };

  const baseTerms = base.data.leaseTerms;
  if (!baseTerms) {
    observations.push({
      code: 'BASE_HAS_NO_TERMS',
      severity: 'error',
      message:
        'The original agreement carries no rent terms, so there is nothing for later ' +
        'instruments to modify.',
      docIds: [base.docId],
    });
    return { epochs, terminationDate: null, observations };
  }

  // --- Termination ---------------------------------------------------------------------
  let terminationDate: string | null = null;
  const termination = chain.ordered.find((d) => roleOf(d) === 'termination');
  if (termination) {
    const stated = effectiveDateOf(termination);
    if (!stated) {
      observations.push({
        code: 'TERMINATION_DATE_UNKNOWN',
        severity: 'error',
        message:
          'A termination is filed against this agreement but states no effective date, so ' +
          'the date rent stopped is unknown.',
        docIds: [termination.docId],
      });
      return { epochs, terminationDate: null, observations };
    }
    terminationDate = stated;
  }

  // --- Mutations, in chain order then by the date each takes effect ---------------------
  const mutations: Mutation[] = [];
  chain.ordered.forEach((doc, order) => {
    const role = roleOf(doc);
    if (role === 'termination') return;

    const docEffective = effectiveDateOf(doc);

    if (REPLACING_ROLES.includes(role)) {
      if (!doc.data.leaseTerms) {
        if (doc.docId !== base.docId) {
          observations.push({
            code: 'BASE_HAS_NO_TERMS',
            severity: 'error',
            message: 'A restatement carries no rent terms, so it cannot replace the agreement.',
            docIds: [doc.docId],
          });
        }
        return;
      }
      mutations.push({ at: docEffective, order, doc, changes: null });
      return;
    }

    if (terminationDate && docEffective > terminationDate) {
      observations.push({
        code: 'POST_TERMINATION_AMENDMENT',
        severity: 'error',
        message:
          `An instrument takes effect on ${docEffective}, after the agreement was terminated ` +
          `on ${terminationDate}.`,
        docIds: [doc.docId],
      });
    }

    const delta = doc.data.delta;
    if (delta && delta.changes.length > 0) {
      const groups = new Map<string, TermChange[]>();
      for (const change of delta.changes) {
        const at = change.changeEffectiveDate || docEffective;
        const list = groups.get(at) ?? [];
        list.push(change);
        groups.set(at, list);
      }
      for (const [at, changes] of groups) {
        mutations.push({ at, order, doc, changes });
      }
      return;
    }

    if (doc.data.leaseTerms) {
      // Written before instruments recorded what they changed. Applying it whole is what it
      // meant at the time; the alternative is discarding a real amendment.
      observations.push({
        code: 'AMENDMENT_APPLIED_WHOLESALE',
        severity: 'info',
        message:
          'This instrument does not record which terms it changes, so its full term set has ' +
          'been applied. Terms the instrument is silent on are taken from it, not inherited.',
        docIds: [doc.docId],
      });
      mutations.push({ at: docEffective, order, doc, changes: null });
      return;
    }

    observations.push({
      code: 'AMENDMENT_STATES_NO_CHANGES',
      severity: 'warning',
      message:
        'This instrument names no changed terms and carries no term set, so it does not ' +
        'affect the rent.',
      docIds: [doc.docId],
    });
  });

  mutations.sort((a, b) => {
    if (a.at !== b.at) return a.at < b.at ? -1 : 1;
    return a.order - b.order;
  });

  // --- Fold ----------------------------------------------------------------------------
  let state = stateFromDocument(base, baseTerms);
  let provenance: Partial<Record<LeaseFieldPath, ProvenanceEntry>> = {};

  let index = 0;
  while (index < mutations.length) {
    const at = mutations[index].at;
    let last = mutations[index];

    while (index < mutations.length && mutations[index].at === at) {
      const mutation = mutations[index];
      last = mutation;

      if (mutation.changes === null) {
        const terms = mutation.doc.data.leaseTerms as LeaseTerms;
        state = stateFromDocument(mutation.doc, terms);
        provenance = {};
        for (const path of WHOLE_INSTRUMENT_PATHS) {
          provenance[path] = { docId: mutation.doc.docId, sourceQuote: null };
        }
      } else {
        state = cloneState(state);
        for (const change of mutation.changes) {
          const problem = applyChange(state, change, mutation.doc.docId);
          if (problem) {
            observations.push(problem);
            continue;
          }
          provenance = {
            ...provenance,
            [change.path]: { docId: mutation.doc.docId, sourceQuote: change.sourceQuote },
          };
        }
      }
      index++;
    }

    epochs.push({
      ...cloneState(state),
      from: at,
      to: null,
      sourceDocId: last.doc.docId,
      sourceDocReference: referenceOf(last.doc),
      sourceDocType: last.doc.docType,
      provenance: { ...provenance },
    });
  }

  // Close each epoch the day before the next one opens.
  for (let i = 0; i < epochs.length - 1; i++) {
    epochs[i].to = dayBefore(epochs[i + 1].from);
  }
  if (epochs.length > 0 && terminationDate) {
    epochs[epochs.length - 1].to = terminationDate;
  }

  return { epochs, terminationDate, observations };
}

/** Paths a wholly-applied instrument is the source of. */
const WHOLE_INSTRUMENT_PATHS: LeaseFieldPath[] = [
  'leaseTerms.baseRent',
  'leaseTerms.paymentFrequency',
  'leaseTerms.currency',
  'leaseTerms.initialTermMonths',
  'leaseTerms.expirationDate',
  'leaseTerms.isMonthToMonth',
  'leaseTerms.escalation',
  'leaseTerms.renewalOptions',
  'siteIdentity.lesseeName',
  'siteIdentity.lessorName',
];

function dayBefore(dateStr: string): string {
  const [y, m, d] = dateStr.split('T')[0].split('-').map(Number);
  const date = new Date(y, (m || 1) - 1, (d || 1) - 1);
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Fills in the lineage links that can be established from the documents themselves.
 *
 * Idempotent and independent of the order the documents arrived in, so re-running it after
 * every batch produces the same chain no matter which file was uploaded first. Returns new
 * records rather than mutating, and only sets links it can evidence:
 *
 * - identical file bytes make one record a duplicate of the other;
 * - near-identical text makes them the same instrument: filed on the same day it is a copy,
 *   filed later it is a revision that supersedes the earlier one;
 * - an ordinal one higher than another instrument's makes that instrument the one amended.
 */
export function resolveLineage(documents: DocumentRecord[]): DocumentRecord[] {
  const ordered = [...documents].sort(compareByDate);

  const primaryByHash = new Map<string, DocumentRecord>();
  for (const doc of ordered) {
    if (!doc.contentHash) continue;
    if (!primaryByHash.has(doc.contentHash)) primaryByHash.set(doc.contentHash, doc);
  }

  const { duplicateOf, supersededBy, supersedes } = resolveSameInstrument(ordered);

  const byOrdinal = new Map<number, DocumentRecord>();
  for (const doc of ordered) {
    const value = ordinalOf(doc);
    if (value !== null && !byOrdinal.has(value)) byOrdinal.set(value, doc);
  }

  const base = ordered.find((d) => roleOf(d) === 'base') ?? null;

  return documents.map((doc) => {
    const lineage: DocumentLineage = {
      ordinal: doc.lineage?.ordinal ?? null,
      fileNameOrdinalHint: doc.lineage?.fileNameOrdinalHint ?? null,
      amendsDocId: doc.lineage?.amendsDocId ?? null,
      supersedesDocId: doc.lineage?.supersedesDocId ?? null,
      supersededByDocId: doc.lineage?.supersededByDocId ?? null,
      duplicateOfDocId: doc.lineage?.duplicateOfDocId ?? null,
      terminatesDocId: doc.lineage?.terminatesDocId ?? null,
    };

    if (doc.contentHash) {
      const primary = primaryByHash.get(doc.contentHash);
      lineage.duplicateOfDocId = primary && primary.docId !== doc.docId ? primary.docId : null;
    }

    lineage.duplicateOfDocId = lineage.duplicateOfDocId ?? duplicateOf.get(doc.docId) ?? null;
    lineage.supersededByDocId = supersededBy.get(doc.docId) ?? lineage.supersededByDocId;
    lineage.supersedesDocId = supersedes.get(doc.docId) ?? lineage.supersedesDocId;

    const value = ordinalOf(doc);
    if (value !== null && !lineage.amendsDocId) {
      const previous = value > 1 ? byOrdinal.get(value - 1) : base;
      lineage.amendsDocId = previous && previous.docId !== doc.docId ? previous.docId : null;
    }

    if (roleOf(doc) === 'termination' && !lineage.terminatesDocId && base) {
      lineage.terminatesDocId = base.docId;
    }

    return { ...doc, lineage };
  });
}

/**
 * Groups documents whose text is near-identical and decides which one stands for the group.
 *
 * The distinction the folder structure forces on us is between a copy and a revision. Three
 * scans of one amendment, all bearing the same execution date, are copies — one instrument
 * filed three times. A document with the same text but a later execution date is a revision
 * that replaced the earlier one, which is what `1st Amend 3.4.26` and `1st Amend REV 3.18.26`
 * are. Copies are excluded as duplicates; a superseded revision is excluded as history.
 *
 * Documents with no parsed text are left alone: silence is not similarity.
 */
function resolveSameInstrument(ordered: DocumentRecord[]): {
  duplicateOf: Map<string, string>;
  supersededBy: Map<string, string>;
  supersedes: Map<string, string>;
} {
  const duplicateOf = new Map<string, string>();
  const supersededBy = new Map<string, string>();
  const supersedes = new Map<string, string>();

  const comparable = ordered.filter((doc) => (doc.rawMarkdown ?? '').trim().length > 0);
  const clusterOf = new Map<string, number>();
  const clusters: DocumentRecord[][] = [];

  for (const doc of comparable) {
    let joined = false;
    for (let i = 0; i < clusters.length && !joined; i++) {
      // Comparing against the cluster's first member is enough: membership already means
      // near-identity, so anything matching one member matches the representative.
      if (textSimilarity(doc.rawMarkdown, clusters[i][0].rawMarkdown) >= NEAR_DUPLICATE_THRESHOLD) {
        clusters[i].push(doc);
        clusterOf.set(doc.docId, i);
        joined = true;
      }
    }
    if (!joined) {
      clusterOf.set(doc.docId, clusters.length);
      clusters.push([doc]);
    }
  }

  for (const cluster of clusters) {
    if (cluster.length < 2) continue;

    const byRecency = [...cluster].sort((a, b) => {
      const exeA = a.executionDate || '';
      const exeB = b.executionDate || '';
      if (exeA !== exeB) return exeA < exeB ? 1 : -1;
      return a.docId < b.docId ? -1 : 1;
    });

    const primary = byRecency[0];
    for (const doc of byRecency.slice(1)) {
      if ((doc.executionDate || '') === (primary.executionDate || '')) {
        duplicateOf.set(doc.docId, primary.docId);
      } else {
        supersededBy.set(doc.docId, primary.docId);
        supersedes.set(primary.docId, doc.docId);
      }
    }
  }

  return { duplicateOf, supersededBy, supersedes };
}

/**
 * The terms in force on a given day.
 *
 * A date before the first epoch resolves to the first epoch: the original agreement governs
 * from commencement, which routinely precedes the date written on the document.
 */
export function resolveTermsAt(epochs: TermEpoch[], date: string): TermEpoch | null {
  if (epochs.length === 0) return null;
  if (date < epochs[0].from) return epochs[0];

  let found = epochs[0];
  for (const epoch of epochs) {
    if (epoch.from <= date) found = epoch;
    else break;
  }
  return found;
}
