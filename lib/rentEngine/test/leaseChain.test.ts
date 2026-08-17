import { describe, it, expect } from 'vitest';
import {
  buildChain,
  computeEpochs,
  resolveLineage,
  resolveTermsAt,
} from '../services/leaseChain';
import {
  AmendmentDelta,
  DocumentClassification,
  DocumentRecord,
  LeaseTerms,
  TermChange,
} from '../types/lease';

const BASE_TERMS: LeaseTerms = {
  baseRent: 1000,
  paymentFrequency: 'monthly',
  currency: 'USD',
  initialTermMonths: 120,
  expirationDate: '2029-12-31',
  renewalOptions: { count: 2, durationMonths: 60, isAutomatic: true, noticePeriodMonths: 90 },
  escalation: {
    type: 'fixed_percentage',
    value: 0.03,
    frequencyMonths: 12,
    appliesToInitialTerm: true,
    appliesToRenewalTerms: true,
    firstEscalationDate: '2021-01-01',
  },
};

interface DocOptions {
  docId: string;
  docType: DocumentRecord['docType'];
  effectiveDate: string;
  executionDate?: string;
  terms?: LeaseTerms;
  delta?: AmendmentDelta;
  classification?: Partial<DocumentClassification>;
  ordinal?: number;
  fileNameOrdinalHint?: number;
  contentHash?: string;
  rawMarkdown?: string;
  lesseeName?: string;
  status?: DocumentRecord['status'];
}

function doc(options: DocOptions): DocumentRecord {
  const {
    docId,
    docType,
    effectiveDate,
    executionDate = effectiveDate,
    terms,
    delta,
    classification,
    ordinal,
    fileNameOrdinalHint,
    contentHash,
    rawMarkdown = '',
    lesseeName = 'Carrier Mobile LLC',
    status = 'confirmed',
  } = options;

  return {
    docId,
    agreementId: 'agr-1',
    siteId: 'site-1',
    fileName: `${docId}.pdf`,
    docType,
    effectiveDate,
    executionDate,
    status,
    rawMarkdown,
    contentHash,
    lineage:
      ordinal !== undefined || fileNameOrdinalHint !== undefined
        ? {
            ordinal:
              ordinal !== undefined
                ? { value: ordinal, sourceQuote: `Amendment ${ordinal}`, source: 'document_text' }
                : null,
            fileNameOrdinalHint: fileNameOrdinalHint ?? null,
            amendsDocId: null,
            supersedesDocId: null,
            supersededByDocId: null,
            duplicateOfDocId: null,
            terminatesDocId: null,
          }
        : undefined,
    data: {
      documentMetadata: {
        docType,
        executionDate,
        effectiveDate,
        commencementDate: docType === 'lease' ? effectiveDate : undefined,
        isCommencementConditional: false,
      },
      siteIdentity: {
        rawAddress: '100 Main St',
        lessorName: 'Landlord Inc',
        lesseeName,
        installationType: 'rooftop',
      },
      oneTimeFees: [],
      leaseTerms: terms,
      delta,
      classification: classification
        ? {
            role: 'amendment',
            executionStatus: 'executed',
            executionEvidence: [],
            signatures: [],
            ...classification,
          }
        : undefined,
    },
    validationFlags: [],
    createdAt: '2026-01-01T00:00:00Z',
  };
}

function change(overrides: Partial<TermChange> & Pick<TermChange, 'path'>): TermChange {
  return {
    operation: 'set',
    value: null,
    changeEffectiveDate: null,
    sourceQuote: 'stated in the instrument',
    ...overrides,
  };
}

function delta(changes: TermChange[]): AmendmentDelta {
  return { changes, ratifiesRemainder: true, recitedCurrentRent: null, amendsReference: null };
}

describe('leaseChain — folding an amendment as a delta', () => {
  it('keeps terms an amendment does not mention', () => {
    const base = doc({ docId: 'base', docType: 'lease', effectiveDate: '2020-01-01', terms: BASE_TERMS });
    const raise = doc({
      docId: 'amend-1',
      docType: 'amendment',
      effectiveDate: '2022-01-01',
      delta: delta([change({ path: 'leaseTerms.baseRent', value: 1500 })]),
    });

    const { epochs } = computeEpochs(buildChain([base, raise]));

    expect(epochs).toHaveLength(2);
    expect(epochs[1].terms.baseRent).toBe(1500);

    // The instrument raised the rent and said nothing else. Everything it did not name is
    // inherited — the wholesale replacement this replaces silently discarded all of it.
    expect(epochs[1].terms.escalation.value).toBe(0.03);
    expect(epochs[1].terms.escalation.frequencyMonths).toBe(12);
    expect(epochs[1].terms.escalation.firstEscalationDate).toBe('2021-01-01');
    expect(epochs[1].terms.renewalOptions.count).toBe(2);
    expect(epochs[1].terms.expirationDate).toBe('2029-12-31');
    expect(epochs[1].terms.initialTermMonths).toBe(120);
  });

  it('records which document and which words set each value', () => {
    const base = doc({ docId: 'base', docType: 'lease', effectiveDate: '2020-01-01', terms: BASE_TERMS });
    const raise = doc({
      docId: 'amend-1',
      docType: 'amendment',
      effectiveDate: '2022-01-01',
      delta: delta([
        change({
          path: 'leaseTerms.baseRent',
          value: 1500,
          sourceQuote: 'Base Rent shall be One Thousand Five Hundred Dollars ($1,500.00) per month',
        }),
      ]),
    });

    const { epochs } = computeEpochs(buildChain([base, raise]));

    expect(epochs[1].provenance['leaseTerms.baseRent']).toEqual({
      docId: 'amend-1',
      sourceQuote: 'Base Rent shall be One Thousand Five Hundred Dollars ($1,500.00) per month',
    });
    // Inherited from the original, which was applied whole and so quotes nothing.
    expect(epochs[1].provenance['leaseTerms.escalation']?.docId).toBe('base');
  });

  it('applies a restatement wholesale, because that is what it does', () => {
    const base = doc({ docId: 'base', docType: 'lease', effectiveDate: '2020-01-01', terms: BASE_TERMS });
    const restated = doc({
      docId: 'restate',
      docType: 'amendment',
      effectiveDate: '2023-01-01',
      classification: { role: 'restatement' },
      terms: {
        ...BASE_TERMS,
        baseRent: 2000,
        escalation: {
          type: 'none',
          value: 0,
          frequencyMonths: 0,
          appliesToInitialTerm: false,
          appliesToRenewalTerms: false,
        },
        renewalOptions: { count: 0, durationMonths: 0, isAutomatic: false, noticePeriodMonths: 0 },
      },
    });

    const { epochs } = computeEpochs(buildChain([base, restated]));

    expect(epochs[1].terms.baseRent).toBe(2000);
    // An amended and restated agreement supersedes everything before it, so the escalation
    // and renewals really are gone — the opposite of the delta case above.
    expect(epochs[1].terms.escalation.type).toBe('none');
    expect(epochs[1].terms.renewalOptions.count).toBe(0);
  });

  it('deletes a clause an instrument expressly strikes', () => {
    const base = doc({ docId: 'base', docType: 'lease', effectiveDate: '2020-01-01', terms: BASE_TERMS });
    const strike = doc({
      docId: 'amend-1',
      docType: 'amendment',
      effectiveDate: '2022-01-01',
      delta: delta([change({ path: 'leaseTerms.escalation', operation: 'remove', value: null })]),
    });

    const { epochs } = computeEpochs(buildChain([base, strike]));

    expect(epochs[1].terms.escalation.type).toBe('none');
    expect(epochs[1].terms.baseRent).toBe(1000);
  });

  it('refuses a removal that would leave no value in its place', () => {
    const base = doc({ docId: 'base', docType: 'lease', effectiveDate: '2020-01-01', terms: BASE_TERMS });
    const strike = doc({
      docId: 'amend-1',
      docType: 'amendment',
      effectiveDate: '2022-01-01',
      delta: delta([change({ path: 'leaseTerms.baseRent', operation: 'remove', value: null })]),
    });

    const { epochs, observations } = computeEpochs(buildChain([base, strike]));

    expect(observations.map((o) => o.code)).toContain('UNSUPPORTED_TERM_REMOVAL');
    expect(epochs[epochs.length - 1].terms.baseRent).toBe(1000);
  });

  it('opens a separate epoch for a change with its own effective date', () => {
    const base = doc({ docId: 'base', docType: 'lease', effectiveDate: '2020-01-01', terms: BASE_TERMS });
    const staged = doc({
      docId: 'amend-1',
      docType: 'amendment',
      effectiveDate: '2022-01-01',
      delta: delta([
        change({ path: 'leaseTerms.baseRent', value: 1500 }),
        change({
          path: 'leaseTerms.expirationDate',
          value: '2032-12-31',
          changeEffectiveDate: '2023-07-01',
        }),
      ]),
    });

    const { epochs } = computeEpochs(buildChain([base, staged]));

    expect(epochs.map((e) => e.from)).toEqual(['2020-01-01', '2022-01-01', '2023-07-01']);
    expect(epochs[1].terms.expirationDate).toBe('2029-12-31');
    expect(epochs[2].terms.expirationDate).toBe('2032-12-31');
    expect(epochs[2].terms.baseRent).toBe(1500);
  });
});

describe('leaseChain — ordering and lineage', () => {
  it('orders by the stated amendment numbers when the dates disagree', () => {
    const base = doc({ docId: 'base', docType: 'lease', effectiveDate: '2020-01-01', terms: BASE_TERMS });
    // The Second Amendment carries an earlier effective date than the First.
    const second = doc({
      docId: 'a2',
      docType: 'amendment',
      effectiveDate: '2021-01-01',
      ordinal: 2,
      delta: delta([change({ path: 'leaseTerms.baseRent', value: 2000 })]),
    });
    const first = doc({
      docId: 'a1',
      docType: 'amendment',
      effectiveDate: '2022-01-01',
      ordinal: 1,
      delta: delta([change({ path: 'leaseTerms.baseRent', value: 1500 })]),
    });

    const chain = buildChain([base, second, first]);

    expect(chain.ordered.map((d) => d.docId)).toEqual(['base', 'a1', 'a2']);
    expect(chain.observations.map((o) => o.code)).toContain('CHAIN_ORDER_AMBIGUOUS');
  });

  it('names the amendments that are missing from the record set', () => {
    const base = doc({ docId: 'base', docType: 'lease', effectiveDate: '2020-01-01', terms: BASE_TERMS });
    const docs = [1, 3, 5].map((n) =>
      doc({
        docId: `a${n}`,
        docType: 'amendment',
        effectiveDate: `202${n}-01-01`,
        ordinal: n,
        delta: delta([change({ path: 'leaseTerms.baseRent', value: 1000 + n })]),
      })
    );

    const chain = buildChain([base, ...docs]);
    const gap = chain.observations.find((o) => o.code === 'AMENDMENT_ORDINAL_GAP');

    expect(gap).toBeDefined();
    expect(gap?.details?.missing).toEqual([2, 4]);
  });

  it('flags a filename that disagrees with the amendment number in the text', () => {
    const base = doc({ docId: 'base', docType: 'lease', effectiveDate: '2020-01-01', terms: BASE_TERMS });
    const amendment = doc({
      docId: 'a1',
      docType: 'amendment',
      effectiveDate: '2021-01-01',
      ordinal: 1,
      fileNameOrdinalHint: 4,
      delta: delta([change({ path: 'leaseTerms.baseRent', value: 1200 })]),
    });

    const chain = buildChain([base, amendment]);
    expect(chain.observations.map((o) => o.code)).toContain('ORDINAL_SOURCE_CONFLICT');
  });

  it('reports an agreement made only of amendments rather than treating one as the original', () => {
    const amendment = doc({
      docId: 'a1',
      docType: 'amendment',
      effectiveDate: '2021-01-01',
      delta: delta([change({ path: 'leaseTerms.baseRent', value: 1200 })]),
    });

    const chain = buildChain([amendment]);

    expect(chain.base).toBeNull();
    expect(chain.observations.map((o) => o.code)).toContain('NO_BASE_INSTRUMENT');
    expect(computeEpochs(chain).epochs).toHaveLength(0);
  });

  it('links a byte-identical copy to the document it duplicates, whatever order they arrive in', () => {
    const original = doc({
      docId: 'scan-a',
      docType: 'amendment',
      effectiveDate: '2021-01-01',
      contentHash: 'abc123',
    });
    const copy = doc({
      docId: 'scan-b',
      docType: 'amendment',
      effectiveDate: '2021-01-01',
      contentHash: 'abc123',
    });

    const forward = resolveLineage([original, copy]);
    const reverse = resolveLineage([copy, original]);

    const primaries = forward.filter((d) => !d.lineage?.duplicateOfDocId);
    expect(primaries).toHaveLength(1);

    // Order-independent: whichever way the files arrive, the same one is the primary.
    const primaryForward = primaries[0].docId;
    const primaryReverse = reverse.filter((d) => !d.lineage?.duplicateOfDocId)[0].docId;
    expect(primaryReverse).toBe(primaryForward);
  });

  it('holds drafts and non-contracts out of the chain, with the reason', () => {
    const base = doc({ docId: 'base', docType: 'lease', effectiveDate: '2020-01-01', terms: BASE_TERMS });
    const redline = doc({
      docId: 'redline',
      docType: 'amendment',
      effectiveDate: '2022-01-01',
      classification: { role: 'amendment', executionStatus: 'draft' },
      delta: delta([change({ path: 'leaseTerms.baseRent', value: 9999 })]),
    });
    const w9 = doc({
      docId: 'w9',
      docType: 'lease',
      effectiveDate: '2022-01-01',
      classification: { role: 'non_instrument', nonInstrumentKind: 'tax_form' },
    });

    const chain = buildChain([base, redline, w9]);

    expect(chain.ordered.map((d) => d.docId)).toEqual(['base']);
    expect(chain.excluded.map((e) => e.doc.docId).sort()).toEqual(['redline', 'w9']);
    expect(chain.excluded.find((e) => e.doc.docId === 'redline')?.reason).toMatch(/draft/i);
  });
});

describe('leaseChain — terms in force on a date', () => {
  const base = doc({ docId: 'base', docType: 'lease', effectiveDate: '2020-01-01', terms: BASE_TERMS });
  const raise = doc({
    docId: 'amend-1',
    docType: 'amendment',
    effectiveDate: '2022-06-15',
    delta: delta([change({ path: 'leaseTerms.baseRent', value: 1500 })]),
  });
  const { epochs } = computeEpochs(buildChain([base, raise]));

  it('resolves the original agreement before its own effective date', () => {
    // Commencement routinely precedes the date written on the document.
    expect(resolveTermsAt(epochs, '2019-11-01')?.terms.baseRent).toBe(1000);
  });

  it('changes on the stated day, not the day after', () => {
    expect(resolveTermsAt(epochs, '2022-06-14')?.terms.baseRent).toBe(1000);
    expect(resolveTermsAt(epochs, '2022-06-15')?.terms.baseRent).toBe(1500);
  });

  it('closes an epoch the day before the next one opens', () => {
    expect(epochs[0].to).toBe('2022-06-14');
    expect(epochs[1].to).toBeNull();
  });
});

describe('leaseChain — the same instrument filed more than once', () => {
  // A realistic amendment: the threshold is calibrated for documents of this length, so a
  // fixture of a few lines would prove nothing about how the clustering behaves.
  const AMENDMENT_TEXT = `
    FIRST AMENDMENT TO LICENSE AGREEMENT
    This First Amendment is made between RMP I LLC, a Maryland limited liability company,
    and Zayo Group LLC, a Delaware limited liability company.
    WHEREAS the parties entered into that certain License Agreement dated October 2, 2012
    for the installation and operation of telecommunications equipment at the property
    commonly known as 111 Rockville Pike, Rockville, Maryland; and
    WHEREAS the parties desire to amend the Agreement as set forth below.
    1. Term. The Term is extended for one additional period of five years commencing on
    May 1, 2019 and expiring on April 30, 2024.
    2. Base Rent. Effective May 1, 2019 the Base Rent shall be increased to Seven Hundred
    Thirty Three and 95/100 Dollars ($733.95) per month.
    3. Insurance. Licensee shall maintain commercial general liability insurance with limits
    of not less than One Million Dollars per occurrence.
    4. Ratification. Except as expressly amended herein, all other terms and conditions of
    the Agreement remain unmodified and in full force and effect.`;

  it('treats scans filed under the same date as copies of one instrument', () => {
    const scans = ['scan-952', 'scan-962', 'scan-972'].map((docId, i) =>
      doc({
        docId,
        docType: 'amendment',
        effectiveDate: '2019-05-01',
        executionDate: '2018-09-18',
        rawMarkdown: `Page ${i + 1} of 3   ${AMENDMENT_TEXT}`,
      })
    );

    const linked = resolveLineage(scans);
    const primaries = linked.filter((d) => !d.lineage?.duplicateOfDocId);

    expect(primaries).toHaveLength(1);
    expect(linked.filter((d) => d.lineage?.duplicateOfDocId)).toHaveLength(2);
  });

  it('treats the same instrument re-executed later as a revision, not a copy', () => {
    const original = doc({
      docId: 'amend-3-4-26',
      docType: 'amendment',
      effectiveDate: '2026-04-01',
      executionDate: '2026-03-04',
      rawMarkdown: AMENDMENT_TEXT,
    });
    const revision = doc({
      docId: 'amend-rev-3-18-26',
      docType: 'amendment',
      effectiveDate: '2026-04-01',
      executionDate: '2026-03-18',
      rawMarkdown: `${AMENDMENT_TEXT}   REVISED 3/18/2026`,
    });

    const linked = resolveLineage([original, revision]);
    const earlier = linked.find((d) => d.docId === 'amend-3-4-26');
    const later = linked.find((d) => d.docId === 'amend-rev-3-18-26');

    // A revision is history, not a duplicate: it is excluded from the fold as superseded,
    // and the link between the two is kept so the chain can show what replaced what.
    expect(earlier?.lineage?.supersededByDocId).toBe('amend-rev-3-18-26');
    expect(earlier?.lineage?.duplicateOfDocId).toBeNull();
    expect(later?.lineage?.supersedesDocId).toBe('amend-3-4-26');
    expect(later?.lineage?.supersededByDocId).toBeNull();

    const chain = buildChain([
      doc({ docId: 'base', docType: 'lease', effectiveDate: '2020-01-01', terms: BASE_TERMS }),
      ...linked,
    ]);
    expect(chain.ordered.map((d) => d.docId)).toEqual(['base', 'amend-rev-3-18-26']);
    expect(chain.excluded[0].reason).toMatch(/superseded/i);
  });

  it('leaves documents with no parsed text alone', () => {
    // Silence is not similarity: two unparsed records must not become duplicates.
    const a = doc({ docId: 'a', docType: 'amendment', effectiveDate: '2021-01-01' });
    const b = doc({ docId: 'b', docType: 'amendment', effectiveDate: '2021-01-01' });

    const linked = resolveLineage([a, b]);
    expect(linked.every((d) => !d.lineage?.duplicateOfDocId)).toBe(true);
  });
});
