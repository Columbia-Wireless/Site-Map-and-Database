import { describe, it, expect } from 'vitest';
import { calculateEscalation, generateRentSchedule } from '../services/timelineEngine';
import { Site, Agreement, DocumentRecord } from '../types/lease';
import { resolveLineage } from '../services/leaseChain';

describe('Timeline Engine Tests', () => {
  it('calculates 3% fixed percentage escalation correctly over time', () => {
    const baseRent = 1000;
    const escalation = {
      type: 'fixed_percentage' as const,
      value: 0.03,
      frequencyMonths: 12,
      appliesToInitialTerm: true,
      appliesToRenewalTerms: true,
    };

    // Year 1 (months 0 - 11): 0 escalation
    expect(calculateEscalation(baseRent, 0, escalation, false)).toBe(0);
    expect(calculateEscalation(baseRent, 11, escalation, false)).toBe(0);

    // Year 2 (month 12): 1000 * 1.03 - 1000 = 30
    expect(calculateEscalation(baseRent, 12, escalation, false)).toBe(30);

    // Year 3 (month 24): 1000 * (1.03^2) - 1000 = 60.9
    expect(calculateEscalation(baseRent, 24, escalation, false)).toBe(60.9);
  });

  it('correctly handles out-of-order document uploads and reduces timeline', () => {
    const site: Site = {
      siteId: 'site-test-1',
      siteCode: 'TEST01',
      siteName: 'Test Antenna Site',
      address: '100 Main St, Austin, TX',
      createdAt: '2026-01-01T00:00:00Z',
    };

    const agreement: Agreement = {
      agreementId: 'agr-test-1',
      siteId: 'site-test-1',
      tenantName: 'Carrier Mobile LLC',
      status: 'active',
      commencementDate: '2022-01-01',
      isCommencementConditional: false,
      createdAt: '2026-01-01T00:00:00Z',
    };

    // Amendment uploaded BEFORE base lease in array (out of order)
    const docs: DocumentRecord[] = [
      {
        docId: 'doc-amendment-1',
        agreementId: 'agr-test-1',
        siteId: 'site-test-1',
        fileName: 'Amendment #1.pdf',
        docType: 'amendment',
        effectiveDate: '2024-01-01',
        executionDate: '2023-12-15',
        status: 'confirmed',
        rawMarkdown: 'Amendment increasing rent to $4000',
        data: {
          documentMetadata: {
            docType: 'amendment',
            executionDate: '2023-12-15',
            effectiveDate: '2024-01-01',
            isCommencementConditional: false,
          },
          siteIdentity: {
            rawAddress: '100 Main St, Austin, TX',
            lessorName: 'Landlord Inc',
            lesseeName: 'Carrier Mobile LLC',
            installationType: 'rooftop',
          },
          oneTimeFees: [],
          leaseTerms: {
            baseRent: 4000,
            paymentFrequency: 'monthly',
            currency: 'USD',
            initialTermMonths: 60,
            renewalOptions: { count: 2, durationMonths: 60, isAutomatic: true, noticePeriodMonths: 90 },
            escalation: { type: 'fixed_percentage', value: 0.03, frequencyMonths: 12, appliesToInitialTerm: true, appliesToRenewalTerms: true },
          },
        },
        validationFlags: [],
        createdAt: '2026-01-02T00:00:00Z',
      },
      {
        docId: 'doc-base-lease',
        agreementId: 'agr-test-1',
        siteId: 'site-test-1',
        fileName: 'Original Lease.pdf',
        docType: 'lease',
        effectiveDate: '2022-01-01',
        executionDate: '2021-12-10',
        status: 'confirmed',
        rawMarkdown: 'Base lease $3000/mo',
        data: {
          documentMetadata: {
            docType: 'lease',
            executionDate: '2021-12-10',
            effectiveDate: '2022-01-01',
            commencementDate: '2022-01-01',
            isCommencementConditional: false,
          },
          siteIdentity: {
            rawAddress: '100 Main St, Austin, TX',
            lessorName: 'Landlord Inc',
            lesseeName: 'Carrier Mobile LLC',
            installationType: 'rooftop',
          },
          oneTimeFees: [],
          leaseTerms: {
            baseRent: 3000,
            paymentFrequency: 'monthly',
            currency: 'USD',
            initialTermMonths: 60,
            renewalOptions: { count: 2, durationMonths: 60, isAutomatic: true, noticePeriodMonths: 90 },
            escalation: { type: 'fixed_percentage', value: 0.03, frequencyMonths: 12, appliesToInitialTerm: true, appliesToRenewalTerms: true },
          },
        },
        validationFlags: [],
        createdAt: '2026-01-01T00:00:00Z',
      },
    ];

    const { rows: schedule } = generateRentSchedule(site, agreement, docs, 36);

    // Period 2022-01 (Month 1): Base lease active ($3,000)
    expect(schedule[0].formattedPeriod).toBe('2022-01');
    expect(schedule[0].baseRent).toBe(3000);

    // Period 2024-01 (Month 25): Amendment #1 active ($4,000)
    const m25 = schedule.find((s) => s.formattedPeriod === '2024-01');
    expect(m25).toBeDefined();
    expect(m25?.baseRent).toBe(4000);
  });

  describe('period classification against the calendar', () => {
    const site: Site = {
      siteId: 'site-1',
      siteCode: 'TXHOU01301A',
      siteName: '3 Houston Center',
      address: '1301 McKinney Street, Houston, Texas',
      createdAt: '2026-07-30',
    };

    const agreement: Agreement = {
      agreementId: 'agr-1',
      siteId: 'site-1',
      tenantName: 'COGENT COMMUNICATIONS, INC.',
      status: 'active',
      commencementDate: null,
      isCommencementConditional: false,
      createdAt: '2026-07-30',
    };

    const confirmedDocFrom = (effectiveDate: string): DocumentRecord => ({
      docId: 'doc-1',
      agreementId: 'agr-1',
      siteId: 'site-1',
      fileName: 'lease.pdf',
      docType: 'lease',
      effectiveDate,
      executionDate: effectiveDate,
      status: 'confirmed',
      rawMarkdown: '',
      validationFlags: [],
      createdAt: '2026-07-30',
      data: {
        documentMetadata: {
          docType: 'lease',
          executionDate: effectiveDate,
          effectiveDate,
          isCommencementConditional: false,
        },
        siteIdentity: {
          siteCode: 'TXHOU01301A',
          rawAddress: '1301 McKinney Street, Houston, Texas',
          lessorName: 'BSREP II HOUSTON OFFICE 3HC OWNER LLC',
          lesseeName: 'COGENT COMMUNICATIONS, INC.',
          installationType: 'in-building_fiber',
        },
        oneTimeFees: [],
        leaseTerms: {
          baseRent: 750,
          paymentFrequency: 'monthly',
          currency: 'USD',
          initialTermMonths: 60,
          renewalOptions: { count: 1, durationMonths: 60, isAutomatic: true, noticePeriodMonths: 90 },
          escalation: { type: 'none', value: 0, frequencyMonths: 12, appliesToInitialTerm: false, appliesToRenewalTerms: false },
        },
      },
    });

    // Regression: status used to be `m < 12 ? 'active' : 'projected'`, so the first twelve
    // months of ANY lease were labelled "Active Current" — a 2022 lease showed 2022-23 as
    // current when viewed in 2026.
    it('never labels a past lease as projected', () => {
      const { rows: schedule } = generateRentSchedule(
        site, agreement, [confirmedDocFrom('2022-09-01')], 36, new Date(2026, 6, 30)
      );
      expect(schedule).toHaveLength(36);
      expect(schedule.every((r) => r.status === 'active')).toBe(true);
      expect(schedule.some((r) => r.status === 'projected')).toBe(false);
    });

    it('labels a wholly future lease projected', () => {
      const { rows: schedule } = generateRentSchedule(
        site, agreement, [confirmedDocFrom('2027-01-01')], 12, new Date(2026, 6, 30)
      );
      expect(schedule.every((r) => r.status === 'projected')).toBe(true);
    });

    it('splits a lease spanning today at the current month', () => {
      const { rows: schedule } = generateRentSchedule(
        site, agreement, [confirmedDocFrom('2026-01-01')], 24, new Date(2026, 6, 15)
      );
      const active = schedule.filter((r) => r.status === 'active');
      const projected = schedule.filter((r) => r.status === 'projected');
      // Jan-Jul 2026 inclusive have been incurred; Aug 2026 onwards are projections.
      expect(active).toHaveLength(7);
      expect(active[active.length - 1].formattedPeriod).toBe('2026-07');
      expect(projected).toHaveLength(17);
      expect(projected[0].formattedPeriod).toBe('2026-08');
    });
  });

  describe('rent calculation correctness', () => {
    const site: Site = { siteId: 's', siteCode: 'DC1015', siteName: '1015 18th Street NW',
      address: '1015 18th Street, NW, Washington, DC 20036', createdAt: '2026-07-30' };
    const agreement: Agreement = { agreementId: 'a', siteId: 's', tenantName: 'Centurylink Communications LLC',
      status: 'active', commencementDate: '2018-11-01', isCommencementConditional: false, createdAt: '2026-07-30' };

    const lease = (over: Partial<any> = {}): DocumentRecord => ({
      docId: 'd', agreementId: 'a', siteId: 's', fileName: 'TLA.pdf', docType: 'lease',
      effectiveDate: '2018-11-01', executionDate: '2018-10-31', status: 'confirmed',
      rawMarkdown: '', validationFlags: [], createdAt: '2026-07-30',
      data: {
        documentMetadata: { docType: 'lease', executionDate: '2018-10-31', effectiveDate: '2018-11-01',
          commencementDate: '2018-11-01', isCommencementConditional: false },
        siteIdentity: { rawAddress: 'x', lessorName: 'L', lesseeName: 'T', installationType: 'other' },
        oneTimeFees: [],
        leaseTerms: {
          baseRent: 500, paymentFrequency: 'monthly', currency: 'USD', initialTermMonths: 60,
          expirationDate: '2033-10-31',
          renewalOptions: { count: 2, durationMonths: 60, isAutomatic: true, noticePeriodMonths: 2 },
          escalation: { type: 'fixed_percentage', value: 0.03, frequencyMonths: 12,
            appliesToInitialTerm: true, appliesToRenewalTerms: true },
          ...over,
        },
      },
    });

    // Ground truth: the client's existing lease system, 1015 18th Street NW / CenturyLink.
    // Rent for November of each lease year, 2018-2032.
    const REFERENCE: Record<string, number> = {
      '2018-11': 500.00, '2019-11': 515.00, '2020-11': 530.45, '2021-11': 546.36,
      '2022-11': 562.75, '2023-11': 579.64, '2024-11': 597.03, '2025-11': 614.94,
      '2026-11': 633.39, '2027-11': 652.39, '2028-11': 671.96, '2029-11': 692.12,
      '2030-11': 712.88, '2031-11': 734.27, '2032-11': 756.29,
    };

    it('matches the reference rent schedule to the cent across 15 years', () => {
      const { rows, issues } = generateRentSchedule(site, agreement, [lease()], undefined, new Date(2026, 6, 30));
      // No blocking problems. The fixture states no first escalation date, so the engine
      // reports that it derived one rather than assuming silently.
      expect(issues.filter((i) => i.severity === 'error')).toHaveLength(0);
      expect(issues.map((i) => i.code)).toContain('ESCALATION_DATE_DERIVED');
      const byPeriod = new Map(rows.map((r) => [r.formattedPeriod, r.totalMonthlyRent]));
      for (const [period, expected] of Object.entries(REFERENCE)) {
        expect(byPeriod.get(period), `period ${period}`).toBe(expected);
      }
    });


    it('lists one-time fees separately, dated from commencement plus the stated offset', () => {
      const doc = lease();
      doc.data.oneTimeFees = [{ description: 'administrative fee', amount: 750, dueDateOffsetDays: 30 }];
      const { rows, oneTimeCharges } = generateRentSchedule(site, agreement, [doc], undefined, new Date(2026, 6, 30));
      expect(oneTimeCharges).toHaveLength(1);
      expect(oneTimeCharges[0].amount).toBe(750);
      expect(oneTimeCharges[0].dueDate).toBe('2018-12-01'); // 2018-11-01 + 30 days
      // Never folded into the recurring rent.
      expect(rows[0].totalMonthlyRent).toBe(500);
      expect(rows.some((r) => r.totalMonthlyRent === 750)).toBe(false);
    });

    it('leaves a fee undated rather than assuming one, and says so', () => {
      const doc = lease();
      doc.data.oneTimeFees = [{ description: 'installation fee', amount: 5000 }];
      const { oneTimeCharges, issues } = generateRentSchedule(site, agreement, [doc], undefined, new Date(2026, 6, 30));
      expect(oneTimeCharges[0].dueDate).toBeNull();
      expect(issues.map((i) => i.code)).toContain('ONE_TIME_FEE_DUE_DATE_UNKNOWN');
    });


    it('adds a fixed monthly utility charge without ever escalating it', () => {
      const doc = lease();
      doc.data.utilities = { billingType: 'fixed_rate', baseMonthlyAmount: 125 };
      const { rows } = generateRentSchedule(site, agreement, [doc], undefined, new Date(2026, 6, 30));
      // Month 0: rent 500 + charge 125, no escalation yet.
      expect(rows[0].fixedMonthlyCharge).toBe(125);
      expect(rows[0].totalMonthlyRent).toBe(625);
      // Year 2 (month 12): rent escalates to 515, the charge stays flat at 125.
      const y2 = rows.find((r) => r.formattedPeriod === '2019-11')!;
      expect(y2.baseRent + y2.escalationAmount).toBe(515);
      expect(y2.fixedMonthlyCharge).toBe(125);
      expect(y2.totalMonthlyRent).toBe(640);
    });

    it('ignores a utility amount that is not a fixed rate', () => {
      const doc = lease();
      doc.data.utilities = { billingType: 'submetered', baseMonthlyAmount: 125 };
      const { rows } = generateRentSchedule(site, agreement, [doc], undefined, new Date(2026, 6, 30));
      expect(rows[0].fixedMonthlyCharge).toBe(0);
      expect(rows[0].totalMonthlyRent).toBe(500);
    });

    it('reports a holdover multiplier rather than silently dropping it', () => {
      const doc = lease();
      doc.data.holdover = { multiplier: 1.5 };
      const { issues } = generateRentSchedule(site, agreement, [doc], undefined, new Date(2026, 6, 30));
      expect(issues.map((i) => i.code)).toContain('HOLDOVER_NOT_PROJECTED');
    });


    it('calculates CPI escalation using the CPI index lookup service', () => {
      const { rows, issues } = generateRentSchedule(site, agreement,
        [lease({ escalation: { type: 'cpi', value: 0, frequencyMonths: 12,
          appliesToInitialTerm: true, appliesToRenewalTerms: true } })], undefined, new Date(2026, 6, 30));
      expect(rows.length).toBeGreaterThan(0);
      expect(issues.map((i) => i.code)).toContain('CPI_ESCALATION_APPLIED');
      // Commencement 2018-11-01: row 0 is Nov 2018, row 12 (the first escalation step) is
      // Nov 2019 — the CPI rate applies for the year the step actually takes effect, not the
      // lease's commencement year (client-confirmed 2026-08-09). BLS CPI-U lookup rate for
      // 2019 is 2.3%: 500 * (1 + 0.023) = 511.50.
      expect(rows[0].totalMonthlyRent).toBe(500);
      expect(rows[12].totalMonthlyRent).toBe(511.5);
    });

    it('calculates CPI escalation using a manual CPI rate override when provided', () => {
      const { rows, issues } = generateRentSchedule(site, agreement,
        [lease({ escalation: { type: 'cpi', value: 0, cpiRateOverride: 0.04, frequencyMonths: 12,
          appliesToInitialTerm: true, appliesToRenewalTerms: true } })], undefined, new Date(2026, 6, 30));
      expect(rows.length).toBeGreaterThan(0);
      expect(issues.map((i) => i.code)).toContain('CPI_ESCALATION_APPLIED');
      // 4% override: Year 1 = 500, Year 2 = 520
      expect(rows[0].totalMonthlyRent).toBe(500);
      expect(rows[12].totalMonthlyRent).toBe(520);
    });

    it('prorates a partial first month on actual days, matching the production ledgers', () => {
      const midMonth: Agreement = { ...agreement, commencementDate: '2018-11-15' };
      const { rows, issues } = generateRentSchedule(site, midMonth, [lease()], undefined, new Date(2026, 6, 30));
      expect(issues.filter((i) => i.severity === 'error')).toHaveLength(0);
      expect(issues.map((i) => i.code)).toContain('PARTIAL_PERIOD_PRORATED');
      // November 2018 has 30 days; commencing on the 15th bills 16 of them (15th through 30th).
      // 500 x 16/30 = 266.666... -> 266.67, matching the ledger-confirmed day-based formula.
      expect(rows[0].formattedPeriod).toBe('2018-11');
      expect(rows[0].totalMonthlyRent).toBe(266.67);
      // The second month bills in full, unprorated.
      expect(rows[1].formattedPeriod).toBe('2018-12');
      expect(rows[1].totalMonthlyRent).toBe(500);
    });


    // Reference: FiberTech at 111 Rockville Pike, "3% on 3/19/2023" — Jan/Feb 326.19,
    // March 330.30, April onward 335.9757. The March figure is the proration evidence.
    it('prorates the escalation month on actual days, matching the reference projection', () => {
      const midMonthEsc = lease({
        baseRent: 326.19,
        expirationDate: '2023-12-31',
        escalation: { type: 'fixed_percentage', value: 0.03, frequencyMonths: 12,
          appliesToInitialTerm: true, appliesToRenewalTerms: true,
          firstEscalationDate: '2023-03-19' },
      });
      const jan: Agreement = { ...agreement, commencementDate: '2023-01-01' };
      const { rows, issues } = generateRentSchedule(site, jan, [midMonthEsc], undefined, new Date(2026, 6, 30));

      expect(issues.filter((i) => i.severity === 'error')).toHaveLength(0);
      // An explicit date is stated, so nothing is derived.
      expect(issues.map((i) => i.code)).not.toContain('ESCALATION_DATE_DERIVED');

      const at = (p: string) => rows.find((r) => r.formattedPeriod === p)!.totalMonthlyRent;
      expect(at('2023-01')).toBe(326.19);
      expect(at('2023-02')).toBe(326.19);
      expect(at('2023-03')).toBe(330.30);   // 18 days old + 13 days new, on 31 days
      expect(at('2023-04')).toBe(335.98);
      expect(at('2023-12')).toBe(335.98);
    });

    it('escalates on the stated date, not the commencement anniversary', () => {
      const julyEsc = lease({
        expirationDate: '2024-12-31',
        escalation: { type: 'fixed_percentage', value: 0.03, frequencyMonths: 12,
          appliesToInitialTerm: true, appliesToRenewalTerms: true,
          firstEscalationDate: '2023-07-01' },
      });
      const nov: Agreement = { ...agreement, commencementDate: '2018-11-01' };
      const { rows } = generateRentSchedule(site, nov, [julyEsc], undefined, new Date(2026, 6, 30));
      const at = (p: string) => rows.find((r) => r.formattedPeriod === p)!.totalMonthlyRent;
      expect(at('2023-06')).toBe(500);      // no commencement-anniversary step in Nov 2019..2022
      expect(at('2023-07')).toBe(515);      // steps on the stated date, full month
      expect(at('2024-06')).toBe(515);
      expect(at('2024-07')).toBe(530.45);   // and again a year later
    });


    it('schedules a month-to-month agreement instead of erroring on a missing end date', () => {
      const mtm = lease({ expirationDate: undefined, isMonthToMonth: true, initialTermMonths: 0,
        escalation: { type: 'none', value: 0, frequencyMonths: 12,
          appliesToInitialTerm: false, appliesToRenewalTerms: false } });
      const { rows, issues } = generateRentSchedule(site, agreement, [mtm], 24, new Date(2026, 6, 30));
      expect(rows).toHaveLength(24);
      expect(issues.map((i) => i.code)).toContain('TERM_INDEFINITE');
      expect(issues.map((i) => i.code)).not.toContain('MISSING_SCHEDULE_END');
    });

    // Reference: 121 Hungerford, Level 3 / Lumen at 978.58/month with a 20% CWF fee —
    // 195.716 fee, 782.864 net, 11,742.96 gross for 2023.
    it('applies a per-agreement commission, matching the reference projection', () => {
      const withFee: Agreement = { ...agreement, commissionRate: 0.2, commencementDate: '2023-01-01' };
      const flat = lease({ baseRent: 978.58, expirationDate: '2023-12-31',
        escalation: { type: 'none', value: 0, frequencyMonths: 12,
          appliesToInitialTerm: false, appliesToRenewalTerms: false } });
      const { rows } = generateRentSchedule(site, withFee, [flat], undefined, new Date(2026, 6, 30));
      expect(rows).toHaveLength(12);
      expect(rows[0].totalMonthlyRent).toBe(978.58);
      expect(rows[0].commissionAmount).toBe(195.72);   // 978.58 x 20%, to the cent
      expect(rows[0].netMonthlyRent).toBe(782.86);
      const gross = rows.reduce((a, r) => a + r.totalMonthlyRent, 0);
      expect(Number(gross.toFixed(2))).toBe(11742.96);
    });

    it('omits commission fields entirely when no rate is set', () => {
      const { rows } = generateRentSchedule(site, agreement, [lease()], undefined, new Date(2026, 6, 30));
      expect(rows[0].commissionAmount).toBeUndefined();
      expect(rows[0].netMonthlyRent).toBeUndefined();
    });

    // Reference: 8515 Georgia Avenue — three carriers, three different escalation dates
    // and two different rates.
    it('reproduces three further reference carriers', () => {
      const cases = [
        { name: 'Level 3',  base: 521.67, rate: 0.03, date: '2023-07-01', before: '2023-06', after: '2023-07', expect: 537.32 },
        { name: 'ZAYO',     base: 733.95, rate: 0.05, date: '2023-05-01', before: '2023-04', after: '2023-05', expect: 770.65 },
        { name: 'Teleport', base: 491.73, rate: 0.03, date: '2023-11-01', before: '2023-10', after: '2023-11', expect: 506.48 },
      ];
      for (const c of cases) {
        const doc = lease({ baseRent: c.base, expirationDate: '2023-12-31',
          escalation: { type: 'fixed_percentage', value: c.rate, frequencyMonths: 12,
            appliesToInitialTerm: true, appliesToRenewalTerms: true, firstEscalationDate: c.date } });
        const jan: Agreement = { ...agreement, commencementDate: '2023-01-01' };
        const { rows } = generateRentSchedule(site, jan, [doc], undefined, new Date(2026, 6, 30));
        const at = (p: string) => rows.find((r) => r.formattedPeriod === p)!.totalMonthlyRent;
        expect(at(c.before), `${c.name} before`).toBe(c.base);
        expect(at(c.after), `${c.name} after`).toBe(c.expect);
      }
    });


    // Reference: Allied Telecom at 111 Rockville — "Month to Month" term, yet still
    // escalating 3% on 7/1/2023. 368.96 Jan-Jun, 380.03 Jul-Dec.
    it('escalates a month-to-month agreement that has no end date', () => {
      const doc = lease({ baseRent: 368.96, expirationDate: undefined, isMonthToMonth: true,
        initialTermMonths: 0,
        escalation: { type: 'fixed_percentage', value: 0.03, frequencyMonths: 12,
          appliesToInitialTerm: true, appliesToRenewalTerms: true, firstEscalationDate: '2023-07-01' } });
      const jan: Agreement = { ...agreement, commencementDate: '2023-01-01' };
      const { rows, issues } = generateRentSchedule(site, jan, [doc], 12, new Date(2026, 6, 30));
      const at = (p: string) => rows.find((r) => r.formattedPeriod === p)!.totalMonthlyRent;
      expect(at('2023-06')).toBe(368.96);
      expect(at('2023-07')).toBe(380.03);   // sheet carries 380.0288 unrounded
      expect(at('2023-12')).toBe(380.03);
      expect(issues.map((i) => i.code)).toContain('TERM_INDEFINITE');
    });

    // Reference: Comcast at 111 Rockville and 121 Hungerford — a genuine no-rent agreement
    // ("originating from Montgomery County need for service in-bldg"). Zero is a real
    // figure here, not missing data.
    it('schedules a zero-rent agreement as zero rather than treating it as absent', () => {
      const doc = lease({ baseRent: 0, expirationDate: '2023-12-31',
        escalation: { type: 'none', value: 0, frequencyMonths: 12,
          appliesToInitialTerm: false, appliesToRenewalTerms: false } });
      const jan: Agreement = { ...agreement, commencementDate: '2023-01-01' };
      const { rows, issues } = generateRentSchedule(site, jan, [doc], undefined, new Date(2026, 6, 30));
      expect(rows).toHaveLength(12);
      expect(rows.every((r) => r.totalMonthlyRent === 0)).toBe(true);
      expect(issues.filter((i) => i.severity === 'error')).toHaveLength(0);
    });

    // Reference: the AT&T line at 111 Rockville is five concurrent agreements, not one.
    // Its 2023 column steps TWICE — 5648.83 Jan-Jun, 5670.70 Jul, 5818.29 Aug-Dec —
    // because components escalate on different dates. Total step is 3% of the whole
    // (169.46), split 21.87 in July and 147.59 in August.
    it('aggregates concurrent agreements escalating on different dates', () => {
      const jan = (rent: number, escDate: string) => ({
        ag: { ...agreement, agreementId: `a-${escDate}`, commencementDate: '2023-01-01' } as Agreement,
        doc: lease({ baseRent: rent, expirationDate: '2023-12-31',
          escalation: { type: 'fixed_percentage', value: 0.03, frequencyMonths: 12,
            appliesToInitialTerm: true, appliesToRenewalTerms: true, firstEscalationDate: escDate } }),
      });
      const july = jan(729.00, '2023-07-01');
      const august = jan(4919.83, '2023-08-01');

      const a = generateRentSchedule(site, july.ag, [july.doc], undefined, new Date(2026, 6, 30)).rows;
      const b = generateRentSchedule(site, august.ag, [august.doc], undefined, new Date(2026, 6, 30)).rows;

      const totalAt = (p: string) =>
        Number((
          a.find((r) => r.formattedPeriod === p)!.totalMonthlyRent +
          b.find((r) => r.formattedPeriod === p)!.totalMonthlyRent
        ).toFixed(2));

      expect(totalAt('2023-06')).toBe(5648.83);            // neither has stepped
      expect(totalAt('2023-07')).toBe(5670.70);            // July component only
      expect(totalAt('2023-08')).toBe(5818.29);            // both stepped
      expect(totalAt('2023-12')).toBe(5818.29);
    });


    // Cross-checked against a production lease-management system's carrier view: six
    // agreements at one property, each independently reconcilable from base rent,
    // commencement, escalation rate and escalation date.
    describe('production carrier view', () => {
      const carrier = (over: Partial<any>, commencement: string) => ({
        ag: { ...agreement, agreementId: `a-${commencement}`, commencementDate: commencement } as Agreement,
        doc: lease(over),
      });

      const run = (base: number, commencement: string, escDate: string, expiry: string, rate = 0.03) => {
        const c = carrier({
          baseRent: base, expirationDate: expiry, initialTermMonths: 0,
          escalation: { type: 'fixed_percentage', value: rate, frequencyMonths: 12,
            appliesToInitialTerm: true, appliesToRenewalTerms: true, firstEscalationDate: escDate },
        }, commencement);
        return generateRentSchedule(site, c.ag, [c.doc], undefined, new Date(2026, 6, 31)).rows;
      };
      const at = (rows: any[], p: string) => rows.find((r) => r.formattedPeriod === p)!.totalMonthlyRent;

      // Escalates on the 1st while commencing on the 15th — commencement-anniversary
      // logic would place both steps in the wrong month. Commencement is moved to the 1st
      // here so the escalation basis is what is under test; the real agreement's mid-month
      // commencement is covered by the refusal test below.
      it('anchors to the escalation date, not the commencement day of month', () => {
        const rows = run(350.0, '2024-03-01', '2025-03-01', '2033-03-21');
        expect(at(rows, '2025-02')).toBe(350.0);
        expect(at(rows, '2025-03')).toBe(360.5);    // step 1
        expect(at(rows, '2026-03')).toBe(371.32);   // step 2 — the system's "current rent"
        expect(at(rows, '2026-07')).toBe(371.32);
      });

      // Two of the six production agreements commence mid-month (the 15th and the 13th).
      // Prorated on actual days, matching the formula confirmed against the production
      // ledgers (a Zayo mid-month escalation and a Fiber Tech mid-month holdover start both
      // matched days-billed / days-in-month x monthly rate to the cent).
      it('prorates the two agreements that commence mid-month, on actual days', () => {
        const cases: [string, number][] = [
          ['2024-03-15', 191.94], // March 2024: 31 days, 17 billed (15th-31st) -> 350 x 17/31
          ['2012-08-13', 214.52], // August 2012: 31 days, 19 billed (13th-31st) -> 350 x 19/31
        ];
        for (const [start, expectedFirst] of cases) {
          const c = carrier({ baseRent: 350.0, expirationDate: '2033-03-21', initialTermMonths: 0,
            escalation: { type: 'fixed_percentage', value: 0.03, frequencyMonths: 12,
              appliesToInitialTerm: true, appliesToRenewalTerms: true, firstEscalationDate: '2025-03-01' } },
            start);
          const { rows, issues } = generateRentSchedule(site, c.ag, [c.doc], undefined, new Date(2026, 6, 31));
          expect(rows.length, start).toBeGreaterThan(0);
          expect(issues.map((i) => i.code), start).toContain('PARTIAL_PERIOD_PRORATED');
          expect(rows[0].totalMonthlyRent, start).toBe(expectedFirst);
          // The second month bills in full, unprorated.
          expect(rows[1].totalMonthlyRent, start).toBe(350.0);
        }
      });

      it('compounds nine steps to the cent', () => {
        expect(at(run(450.0, '2017-07-01', '2018-07-01', '2027-06-30'), '2026-07')).toBe(587.15);
      });

      it('compounds eleven steps to the cent', () => {
        expect(at(run(450.0, '2015-06-01', '2016-06-01', '2026-07-31'), '2026-07')).toBe(622.91);
      });

      it('compounds a single step to the cent', () => {
        expect(at(run(700.0, '2025-04-01', '2026-04-01', '2030-04-02'), '2026-07')).toBe(721.0);
      });

      // The decisive proration case: escalation lands on the 28th, so July is 27 days at
      // the old rate and 4 at the new. (6281.90 x 27 + 6470.36 x 4) / 31 = 6306.22, which
      // is exactly the "current rent" the production system reports.
      it('prorates a late-month escalation exactly as the production system does', () => {
        const rows = run(6281.9, '2025-09-01', '2026-07-28', '2044-07-27');
        expect(at(rows, '2026-06')).toBe(6281.9);
        expect(at(rows, '2026-07')).toBe(6306.22);
        expect(at(rows, '2026-08')).toBe(6470.36);
      });

      it('carries a zero-rent agreement at zero with a zero escalation rate', () => {
        const c = carrier({ baseRent: 0, expirationDate: '2029-08-12', initialTermMonths: 0,
          escalation: { type: 'fixed_percentage', value: 0, frequencyMonths: 12,
            appliesToInitialTerm: true, appliesToRenewalTerms: true, firstEscalationDate: '2026-08-13' } },
          '2012-08-01');
        const { rows, issues } = generateRentSchedule(site, c.ag, [c.doc], undefined, new Date(2026, 6, 31));
        expect(rows.every((r) => r.totalMonthlyRent === 0)).toBe(true);
        expect(issues.filter((i) => i.severity === 'error')).toHaveLength(0);
      });
    });

    it('ends the schedule at the lease expiry, inventing no rent beyond it', () => {
      const { rows } = generateRentSchedule(site, agreement, [lease()], undefined, new Date(2026, 6, 30));
      expect(rows).toHaveLength(180);                       // Nov 2018 - Oct 2033
      expect(rows[rows.length - 1].formattedPeriod).toBe('2033-10');
      expect(rows.some((r) => r.formattedPeriod === '2033-11')).toBe(false);
    });

    it('normalises a quarterly rent to a monthly obligation', () => {
      const { rows } = generateRentSchedule(
        site, agreement,
        [lease({ baseRent: 2250, paymentFrequency: 'quarterly', escalation:
          { type: 'none', value: 0, frequencyMonths: 12, appliesToInitialTerm: false, appliesToRenewalTerms: false } })],
        undefined, new Date(2026, 6, 30)
      );
      expect(rows[0].totalMonthlyRent).toBe(750);   // not 2250
      expect(rows[0].contractRent).toBe(2250);
      expect(rows[0].paymentFrequency).toBe('quarterly');
      const total = rows.reduce((a, r) => a + r.totalMonthlyRent, 0);
      expect(Number(total.toFixed(2))).toBe(135000); // 180 months x 750
    });

    it('normalises an annual rent to a monthly obligation', () => {
      const { rows } = generateRentSchedule(
        site, agreement,
        [lease({ baseRent: 9000, paymentFrequency: 'annually', escalation:
          { type: 'none', value: 0, frequencyMonths: 12, appliesToInitialTerm: false, appliesToRenewalTerms: false } })],
        undefined, new Date(2026, 6, 30)
      );
      expect(rows[0].totalMonthlyRent).toBe(750);
    });

    it('refuses to schedule when an escalation has no stated interval', () => {
      const { rows, issues } = generateRentSchedule(site, agreement,
        [lease({ escalation: { type: 'fixed_percentage', value: 0.03, frequencyMonths: 0,
          appliesToInitialTerm: true, appliesToRenewalTerms: true } })], undefined, new Date(2026, 6, 30));
      expect(rows).toHaveLength(0);
      expect(issues.map((i) => i.code)).toContain('MISSING_ESCALATION_FREQUENCY');
    });

    it('refuses to schedule when neither expiry nor term is stated', () => {
      const { rows, issues } = generateRentSchedule(site, agreement,
        [lease({ expirationDate: undefined, initialTermMonths: 0 })], undefined, new Date(2026, 6, 30));
      expect(rows).toHaveLength(0);
      expect(issues.map((i) => i.code)).toContain('MISSING_SCHEDULE_END');
    });

    it('covers the initial term only, and says so, when no expiry is stated', () => {
      const { rows, issues } = generateRentSchedule(site, agreement,
        [lease({ expirationDate: undefined })], undefined, new Date(2026, 6, 30));
      expect(rows).toHaveLength(60);
      expect(issues.map((i) => i.code)).toContain('RENEWALS_NOT_PROJECTED');
    });
  });
});

/**
 * A carrier at an address is a chain of instruments, not one document. These pin what the
 * schedule does with the chain: which documents count, what an amendment changes, and where
 * the schedule stops.
 */
describe('lease chains', () => {
  const site: Site = {
    siteId: 'site-chain',
    siteCode: 'CHAIN01',
    siteName: 'Chain Test Site',
    address: '200 Market St',
    createdAt: '2026-01-01T00:00:00Z',
  };

  const agreement: Agreement = {
    agreementId: 'agr-chain',
    siteId: 'site-chain',
    tenantName: 'Original Carrier LLC',
    status: 'active',
    commencementDate: '2020-01-01',
    isCommencementConditional: false,
    createdAt: '2026-01-01T00:00:00Z',
  };

  const baseTerms = {
    baseRent: 1000,
    paymentFrequency: 'monthly' as const,
    currency: 'USD',
    initialTermMonths: 120,
    expirationDate: '2029-12-31',
    renewalOptions: { count: 2, durationMonths: 60, isAutomatic: true, noticePeriodMonths: 90 },
    escalation: {
      type: 'fixed_percentage' as const,
      value: 0.03,
      frequencyMonths: 12,
      appliesToInitialTerm: true,
      appliesToRenewalTerms: true,
      firstEscalationDate: '2021-01-01',
    },
  };

  const build = (opts: {
    docId: string;
    docType: DocumentRecord['docType'];
    effectiveDate: string;
    terms?: typeof baseTerms;
    delta?: any;
    classification?: any;
    ordinal?: number;
    contentHash?: string;
    fees?: { description: string; amount: number; dueDateOffsetDays?: number }[];
  }): DocumentRecord => ({
    docId: opts.docId,
    agreementId: 'agr-chain',
    siteId: 'site-chain',
    fileName: `${opts.docId}.pdf`,
    docType: opts.docType,
    effectiveDate: opts.effectiveDate,
    executionDate: opts.effectiveDate,
    status: 'confirmed',
    rawMarkdown: '',
    contentHash: opts.contentHash,
    lineage:
      opts.ordinal !== undefined
        ? {
            ordinal: { value: opts.ordinal, sourceQuote: `Amendment ${opts.ordinal}`, source: 'document_text' as const },
            fileNameOrdinalHint: null,
            amendsDocId: null,
            supersedesDocId: null,
            supersededByDocId: null,
            duplicateOfDocId: null,
            terminatesDocId: null,
          }
        : undefined,
    data: {
      documentMetadata: {
        docType: opts.docType,
        executionDate: opts.effectiveDate,
        effectiveDate: opts.effectiveDate,
        commencementDate: opts.docType === 'lease' ? '2020-01-01' : undefined,
        isCommencementConditional: false,
      },
      siteIdentity: {
        rawAddress: '200 Market St',
        lessorName: 'Landlord Inc',
        lesseeName: 'Original Carrier LLC',
        installationType: 'rooftop',
      },
      oneTimeFees: opts.fees ?? [],
      leaseTerms: opts.terms,
      delta: opts.delta,
      classification: opts.classification,
    },
    validationFlags: [],
    createdAt: '2026-01-01T00:00:00Z',
  });

  const setRent = (amount: number) => ({
    changes: [
      {
        path: 'leaseTerms.baseRent' as const,
        operation: 'set' as const,
        value: amount,
        changeEffectiveDate: null,
        sourceQuote: `Base Rent shall be $${amount}.00 per month`,
      },
    ],
    ratifiesRemainder: true,
    recitedCurrentRent: null,
    amendsReference: null,
  });

  const original = build({
    docId: 'base',
    docType: 'lease',
    effectiveDate: '2020-01-01',
    terms: baseTerms,
  });

  it('keeps escalating after an amendment that only changes the rent', () => {
    const raise = build({
      docId: 'a1',
      docType: 'amendment',
      effectiveDate: '2022-01-01',
      delta: setRent(1500),
    });

    const { rows, issues } = generateRentSchedule(site, agreement, [original, raise]);

    expect(issues.filter((i) => i.severity === 'error')).toEqual([]);
    expect(rows).toHaveLength(120);

    const at = (period: string) => rows.find((r) => r.formattedPeriod === period);

    expect(at('2020-01')?.totalMonthlyRent).toBe(1000);
    expect(at('2021-01')?.totalMonthlyRent).toBe(1030);

    // The amendment raised the rent and mentioned nothing else. The escalation clause it
    // never named still applies, and still compounds from the original anchor: two steps
    // have accrued by 2022, so 1500 x 1.03^2 = 1591.35.
    expect(at('2022-01')?.baseRent).toBe(1500);
    expect(at('2022-01')?.escalationAmount).toBe(91.35);
    expect(at('2022-01')?.totalMonthlyRent).toBe(1591.35);

    // 1500 x 1.03^3 = 1639.0905
    expect(at('2023-01')?.totalMonthlyRent).toBe(1639.09);

    // The rent-only amendment didn't restate escalation, so the schedule keeps compounding
    // from the original anchor onto the new baseline — an assumption, and it must say so.
    const anchorIssue = issues.find((i) => i.code === 'ESCALATION_ANCHOR_UNCHANGED_BY_AMENDMENT');
    expect(anchorIssue).toBeDefined();
    expect(anchorIssue?.severity).toBe('info');
    expect(anchorIssue?.message).toContain('a1');
  });

  it('does not flag escalation continuity when a restatement supplies its own escalation terms', () => {
    const restated = build({
      docId: 'restatement-1',
      docType: 'lease',
      effectiveDate: '2022-01-01',
      terms: { ...baseTerms, baseRent: 1500 },
      classification: { role: 'restatement', executionStatus: 'executed', executionEvidence: [], signatures: [] },
    });

    const { issues } = generateRentSchedule(site, agreement, [original, restated]);
    expect(issues.map((i) => i.code)).not.toContain('ESCALATION_ANCHOR_UNCHANGED_BY_AMENDMENT');
  });

  it('lengthens the schedule when an amendment extends the expiry', () => {
    const shortLease = build({
      docId: 'base-short',
      docType: 'lease',
      effectiveDate: '2020-01-01',
      terms: { ...baseTerms, expirationDate: '2024-12-31', initialTermMonths: 60 },
    });
    const extension = build({
      docId: 'a1',
      docType: 'amendment',
      effectiveDate: '2023-01-01',
      delta: {
        changes: [
          {
            path: 'leaseTerms.expirationDate' as const,
            operation: 'set' as const,
            value: '2029-12-31',
            changeEffectiveDate: null,
            sourceQuote: 'the Term is extended through December 31, 2029',
          },
        ],
        ratifiesRemainder: true,
        recitedCurrentRent: null,
        amendsReference: null,
      },
    });

    const { rows } = generateRentSchedule(site, agreement, [shortLease, extension]);

    // Reading the original alone would have stopped at 2024-12.
    expect(rows).toHaveLength(120);
    expect(rows[rows.length - 1].formattedPeriod).toBe('2029-12');
  });

  it('stops the schedule at a termination rather than at the contractual expiry', () => {
    const termination = build({
      docId: 'term',
      docType: 'termination',
      effectiveDate: '2022-06-15',
    });

    const { rows, issues } = generateRentSchedule(site, agreement, [original, termination]);

    expect(rows).toHaveLength(30);
    expect(rows[rows.length - 1].formattedPeriod).toBe('2022-06');
    expect(issues.map((i) => i.code)).toContain('TERMINATED_EARLY');
  });

  it('refuses to schedule when a termination states no date', () => {
    const termination = build({ docId: 'term', docType: 'termination', effectiveDate: '' });

    const { rows, issues } = generateRentSchedule(site, agreement, [original, termination]);

    expect(rows).toEqual([]);
    expect(issues.map((i) => i.code)).toContain('TERMINATION_DATE_UNKNOWN');
  });

  it('refuses to schedule when an amendment is missing from the record set', () => {
    // The filed instruments are the First and Third Amendment. The Second changes terms the
    // Third assumes, so a schedule built from what is here could be confidently wrong.
    const first = build({
      docId: 'a1',
      docType: 'amendment',
      effectiveDate: '2021-06-01',
      ordinal: 1,
      delta: setRent(1100),
    });
    const third = build({
      docId: 'a3',
      docType: 'amendment',
      effectiveDate: '2023-06-01',
      ordinal: 3,
      delta: setRent(1400),
    });

    const { rows, issues } = generateRentSchedule(site, agreement, [original, first, third]);

    expect(rows).toEqual([]);
    const gap = issues.find((i) => i.code === 'CHAIN_HAS_UNRESOLVED_GAP');
    expect(gap).toBeDefined();
    expect(gap?.message).toContain('2');
  });

  it('counts a one-time fee once when the same file is filed three times', () => {
    const withFee = build({
      docId: 'base-fee',
      docType: 'lease',
      effectiveDate: '2020-01-01',
      terms: baseTerms,
      contentHash: 'hash-original',
      fees: [{ description: 'Administrative fee', amount: 500, dueDateOffsetDays: 0 }],
    });
    const scans = ['scan-952', 'scan-962', 'scan-972'].map((docId) =>
      build({
        docId,
        docType: 'amendment',
        effectiveDate: '2021-03-01',
        contentHash: 'hash-amendment',
        delta: setRent(1100),
        fees: [{ description: 'Amendment fee', amount: 250, dueDateOffsetDays: 30 }],
      })
    );

    const linked = resolveLineage([withFee, ...scans]);
    const { oneTimeCharges } = generateRentSchedule(site, agreement, linked);

    // Three scans of one instrument are one fee, not three.
    expect(oneTimeCharges.filter((c) => c.description === 'Amendment fee')).toHaveLength(1);
    expect(oneTimeCharges).toHaveLength(2);
  });

  it('ignores an unexecuted draft', () => {
    const redline = build({
      docId: 'redline',
      docType: 'amendment',
      effectiveDate: '2022-01-01',
      classification: {
        role: 'amendment',
        executionStatus: 'draft',
        executionEvidence: ['DRAFT — FOR DISCUSSION PURPOSES ONLY'],
        signatures: [],
      },
      delta: setRent(9999),
    });

    const { rows } = generateRentSchedule(site, agreement, [original, redline]);

    const at2022 = rows.find((r) => r.formattedPeriod === '2022-01');
    expect(at2022?.baseRent).toBe(1000);
  });

  it('names the new counterparty from the month an assignment takes effect', () => {
    const assignment = build({
      docId: 'assign',
      docType: 'assignment',
      effectiveDate: '2022-01-01',
      classification: {
        role: 'assignment',
        executionStatus: 'executed',
        executionEvidence: [],
        signatures: [],
      },
      delta: {
        changes: [
          {
            path: 'siteIdentity.lesseeName' as const,
            operation: 'set' as const,
            value: 'Successor Networks Inc',
            changeEffectiveDate: null,
            sourceQuote: 'Assignor hereby assigns to Successor Networks Inc',
          },
        ],
        ratifiesRemainder: true,
        recitedCurrentRent: null,
        amendsReference: null,
      },
    });

    const { rows } = generateRentSchedule(site, agreement, [original, assignment]);

    expect(rows.find((r) => r.formattedPeriod === '2021-12')?.tenantName).toBe('Original Carrier LLC');
    expect(rows.find((r) => r.formattedPeriod === '2022-01')?.tenantName).toBe('Successor Networks Inc');
    // The rent is untouched: an assignment changes who pays, not what.
    expect(rows.find((r) => r.formattedPeriod === '2022-01')?.totalMonthlyRent).toBe(1060.9);
  });
});
