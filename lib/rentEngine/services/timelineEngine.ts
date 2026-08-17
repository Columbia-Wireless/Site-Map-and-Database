import {
  DocumentRecord,
  Site,
  Agreement,
  RentScheduleItem,
  EscalationClause,
  PaymentFrequency,
} from '../types/lease';
import {
  ChainObservation,
  FoldedState,
  TermEpoch,
  buildChain,
  computeEpochs,
  resolveTermsAt,
} from './leaseChain';
import { resolveCpiRate } from './cpiService';

/** Months covered by one payment under each frequency. */
const MONTHS_PER_PAYMENT: Record<PaymentFrequency, number> = {
  monthly: 1,
  quarterly: 3,
  annually: 12,
};

/** Safety cap only — the lease decides the real horizon. */
const MAX_PROJECTION_MONTHS = 600;

/**
 * A reason the schedule could not be produced, or could only be produced in part.
 *
 * Reported rather than papered over: the engine never substitutes an assumed term,
 * escalation frequency or end date, because a schedule built on an invented input is
 * indistinguishable from a correct one once it reaches an accounting export.
 */
export interface ScheduleIssue {
  code:
    | 'MISSING_ESCALATION_FREQUENCY'
    | 'MISSING_TERM_BOUNDARY'
    | 'MISSING_SCHEDULE_END'
    | 'RENEWALS_NOT_PROJECTED'
    | 'ONE_TIME_FEE_DUE_DATE_UNKNOWN'
    | 'HOLDOVER_NOT_PROJECTED'
    | 'CPI_INDEX_UNAVAILABLE'
    | 'CPI_ESCALATION_APPLIED'
    | 'PARTIAL_PERIOD_PRORATED'
    | 'ESCALATION_DATE_DERIVED'
    | 'ESCALATION_ANCHOR_UNCHANGED_BY_AMENDMENT'
    | 'TERM_INDEFINITE'
    | 'NO_BASE_INSTRUMENT'
    | 'CHAIN_HAS_UNRESOLVED_GAP'
    | 'TERMINATION_DATE_UNKNOWN'
    | 'TERMINATED_EARLY';
  severity: 'error' | 'info';
  message: string;
}

/**
 * Chain problems that must stop the schedule, mapped to the issue the caller sees.
 *
 * Anything not listed is a matter for the document-level review rather than the calculation,
 * and is reported there instead of blocking a schedule that is still correct.
 */
const BLOCKING_CHAIN_OBSERVATIONS: Partial<Record<string, ScheduleIssue['code']>> = {
  NO_BASE_INSTRUMENT: 'NO_BASE_INSTRUMENT',
  BASE_HAS_NO_TERMS: 'NO_BASE_INSTRUMENT',
  AMENDMENT_ORDINAL_GAP: 'CHAIN_HAS_UNRESOLVED_GAP',
  AMENDMENT_ORDINAL_DUPLICATE: 'CHAIN_HAS_UNRESOLVED_GAP',
  POST_TERMINATION_AMENDMENT: 'CHAIN_HAS_UNRESOLVED_GAP',
  UNSUPPORTED_TERM_REMOVAL: 'CHAIN_HAS_UNRESOLVED_GAP',
  TERMINATION_DATE_UNKNOWN: 'TERMINATION_DATE_UNKNOWN',
};

function toScheduleIssues(observations: ChainObservation[]): ScheduleIssue[] {
  const issues: ScheduleIssue[] = [];
  for (const observation of observations) {
    const code = BLOCKING_CHAIN_OBSERVATIONS[observation.code];
    if (code) issues.push({ code, severity: 'error', message: observation.message });
  }
  return issues;
}

/**
 * A charge payable once, not part of the monthly rent — an administrative or installation
 * fee. Kept in its own list so it can never be mistaken for recurring rent or double-counted
 * into a monthly total.
 */
export interface OneTimeCharge {
  description: string;
  amount: number;
  /** YYYY-MM-DD, or null when the contract states no due date. Never invented. */
  dueDate: string | null;
  siteId: string;
  siteCode: string;
  siteName: string;
  tenantName: string;
  address: string;
  sourceDocReference: string;
}

export interface RentScheduleResult {
  rows: RentScheduleItem[];
  oneTimeCharges: OneTimeCharge[];
  issues: ScheduleIssue[];
}

/**
 * Parses a 'YYYY-MM-DD' string into a Date in the LOCAL timezone.
 *
 * `new Date('2024-01-01')` parses as UTC midnight, but month periods below are
 * built with `new Date(year, month, 1)` (local midnight). Mixing the two makes
 * amendment effective-date comparisons off-by-one in any timezone east of UTC.
 * Parsing components explicitly keeps every date on the same local basis.
 */
function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('T')[0].split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

/** Absolute month index, so periods can be compared without date arithmetic. */
function monthIndexOf(date: Date): number {
  return date.getFullYear() * 12 + date.getMonth();
}

/**
 * Rounds to cents, half away from zero, correcting for binary representation error.
 *
 * Exact decimal ties are common in rent maths: 350 x 1.03^2 is exactly 371.315, which must
 * round to 371.32. In binary that product is 371.31499999999994, so a plain toFixed(2)
 * yields 371.31 — a cent below what the production lease system reports. The epsilon
 * restores the intended decimal value before rounding; it is far smaller than a cent and
 * cannot move a figure that is not already within representation error of a tie.
 */
function roundCents(value: number): number {
  return Math.round(value * 100 + (value >= 0 ? 1e-9 : -1e-9)) / 100;
}

/** Adds whole months, clamping the day to the target month's length. */
function addMonths(date: Date, months: number): Date {
  const d = new Date(date.getFullYear(), date.getMonth() + months, 1);
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(date.getDate(), lastDay));
  return d;
}

function daysInMonth(year: number, monthIndex0: number): number {
  return new Date(year, monthIndex0 + 1, 0).getDate();
}

/** Formats a Date as YYYY-MM-DD in local terms, matching parseLocalDate. */
function formatLocalDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Calculates escalation for a given month index in the lease lifecycle.
 *
 * `baseRent` and any `fixed_amount` escalation value must already be normalised to a
 * MONTHLY basis by the caller.
 */
/**
 * Escalation amount after an explicit number of steps. Separated from step counting so a
 * month containing an escalation can be prorated between the old and new rate.
 */
export function escalationAfterSteps(
  baseRent: number,
  steps: number,
  escalation: EscalationClause,
  isRenewalPeriod: boolean,
  year?: number
): number {
  if (escalation.type === 'none') return 0;
  if (!isRenewalPeriod && !escalation.appliesToInitialTerm) return 0;
  if (isRenewalPeriod && !escalation.appliesToRenewalTerms) return 0;
  if (steps <= 0) return 0;

  if (escalation.type === 'cpi') {
    const cpiRes = resolveCpiRate(escalation, year);
    if (!cpiRes) {
      throw new Error(
        'CPI escalation cannot be calculated without published index values or a rate override.'
      );
    }
    return roundCents(baseRent * Math.pow(1 + cpiRes.rate, steps) - baseRent);
  }
  if (escalation.type === 'fixed_percentage') {
    if (escalation.value <= 0) return 0;
    // Compounds on the UNROUNDED base, matching the reference lease system: rounding at
    // each step yields 579.63 at year five where the correct figure is 579.64.
    return roundCents(baseRent * Math.pow(1 + escalation.value, steps) - baseRent);
  }
  if (escalation.type === 'fixed_amount') {
    if (escalation.value <= 0) return 0;
    return roundCents(escalation.value * steps);
  }
  return 0;
}

export function calculateEscalation(
  baseRent: number,
  monthIndex: number, // 0-indexed month from commencement
  escalation: EscalationClause,
  isRenewalPeriod: boolean
): number {
  if (escalation.type === 'none' || escalation.value <= 0) {
    return 0;
  }

  if (!isRenewalPeriod && !escalation.appliesToInitialTerm) {
    return 0;
  }
  if (isRenewalPeriod && !escalation.appliesToRenewalTerms) {
    return 0;
  }

  // Callers guarantee a positive frequency; see resolveEscalationFrequency().
  const escalationSteps = Math.floor(monthIndex / escalation.frequencyMonths);

  if (escalationSteps <= 0) return 0;

  return escalationAfterSteps(baseRent, escalationSteps, escalation, isRenewalPeriod);
}

/**
 * Generates a consolidated, month-by-month rent schedule for a site & agreement
 * by applying confirmed lease documents as a chronological reducer.
 *
 * Every figure is derived from the contract. Where the contract is silent on something
 * the calculation needs, the gap is returned as a `ScheduleIssue` and no rows are
 * produced — rather than defaulting to a five-year term or an annual escalation and
 * emitting numbers that look authoritative.
 */
export function generateRentSchedule(
  site: Site,
  agreement: Agreement,
  documents: DocumentRecord[],
  maxMonths: number = MAX_PROJECTION_MONTHS,
  // Injectable so period classification is testable against a fixed date rather than
  // whenever the suite happens to run.
  now: Date = new Date()
): RentScheduleResult {
  const issues: ScheduleIssue[] = [];

  // Duplicates, drafts, superseded revisions and non-contracts are held out here, so a
  // contract filed three times contributes one set of terms and one set of fees.
  const chain = buildChain(documents);
  const sortedDocs = chain.ordered;

  if (sortedDocs.length === 0) {
    return { rows: [], oneTimeCharges: [], issues };
  }

  const fold = computeEpochs(chain);
  issues.push(...toScheduleIssues([...chain.observations, ...fold.observations]));

  const baseDoc = chain.base;
  const terms = baseDoc?.data.leaseTerms;
  if (!baseDoc || !terms || fold.epochs.length === 0) {
    if (issues.length === 0) {
      issues.push({
        code: 'NO_BASE_INSTRUMENT',
        severity: 'error',
        message:
          'No original agreement with rent terms is present, so no schedule can be produced.',
      });
    }
    return { rows: [], oneTimeCharges: [], issues };
  }

  // The horizon follows the terms in force at the end of the chain: an amendment that
  // extends the expiry lengthens the schedule, which reading the original alone would miss.
  const finalTerms = fold.epochs[fold.epochs.length - 1].terms;

  const commencementStr =
    agreement.commencementDate ||
    baseDoc.data.documentMetadata.commencementDate ||
    baseDoc.effectiveDate ||
    baseDoc.executionDate;

  const startDate = parseLocalDate(commencementStr);
  const startYear = startDate.getFullYear();
  const startMonth = startDate.getMonth();
  const startIndex = monthIndexOf(startDate);

  // --- Escalation frequency: required whenever escalation actually applies -------------
  // CPI is a separate question from `value > 0`: its rate can come from a manual override
  // or the index lookup service instead of the contract's own extracted value, which is
  // routinely 0 or absent for a CPI clause (resolveCpiRate handles that precedence — see
  // cpiService.ts). Gating on `value > 0` for every type meant a CPI lease with an override
  // but no extracted value never escalated at all: the CPI_ESCALATION_APPLIED issue below
  // still fired (it checks `resolveCpiRate` directly), but every row after month 0 quietly
  // priced as if nothing had changed.
  const escalates =
    terms.escalation.type === 'cpi'
      ? resolveCpiRate(terms.escalation, startYear) !== null
      : terms.escalation.type !== 'none' && terms.escalation.value > 0;
  if (escalates && !(terms.escalation.frequencyMonths > 0)) {
    issues.push({
      code: 'MISSING_ESCALATION_FREQUENCY',
      severity: 'error',
      message:
        'The contract specifies an escalation but no escalation interval. The interval ' +
        'cannot be assumed — supply it before a schedule can be produced.',
    });
  }

  // --- CPI: index lookup or manual rate override -------------------------------------
  if (terms.escalation.type === 'cpi') {
    const cpiRes = resolveCpiRate(terms.escalation, startYear);
    if (cpiRes) {
      issues.push({
        code: 'CPI_ESCALATION_APPLIED',
        severity: 'info',
        message: `${cpiRes.description} applied for CPI escalation.`,
      });
    } else {
      issues.push({
        code: 'CPI_INDEX_UNAVAILABLE',
        severity: 'error',
        message:
          'This lease escalates against a published price index. Supply a manual CPI rate override or index values before a schedule can be produced.',
      });
    }
  }

  // --- Partial first period: prorated on actual days -------------------------------------
  // Confirmed against the production carrier ledgers (2026-08-08), not assumed: two
  // independent partial-period charges — a mid-month escalation split in Zayo's ledger, and a
  // mid-month holdover start in Fiber Tech's — both matched (days in the partial period ÷
  // days in that calendar month) × the monthly rate to the cent. The commencement month gets
  // the same treatment.
  const firstPeriodProrated = startDate.getDate() !== 1;
  if (firstPeriodProrated) {
    issues.push({
      code: 'PARTIAL_PERIOD_PRORATED',
      severity: 'info',
      message:
        `Commencement falls on day ${startDate.getDate()} of the month, so the first period ` +
        'is partial. Billed as (days remaining in that month ÷ days in that month) × the ' +
        'monthly rate, matching the day-based proration confirmed in the production ledgers.',
    });
  }

  // --- Initial term: required only when the two phases escalate differently ------------
  const phasesDiffer =
    terms.escalation.appliesToInitialTerm !== terms.escalation.appliesToRenewalTerms;
  const hasInitialTerm = terms.initialTermMonths > 0;
  if (escalates && phasesDiffer && !hasInitialTerm) {
    issues.push({
      code: 'MISSING_TERM_BOUNDARY',
      severity: 'error',
      message:
        'Escalation applies differently to the initial and renewal terms, but the initial ' +
        'term length is not stated, so the boundary between them is unknown.',
    });
  }

  // --- Schedule end: the lease decides, never a fixed window ---------------------------
  let horizonMonths: number | null = null;
  if (finalTerms.expirationDate) {
    const endIndex = monthIndexOf(parseLocalDate(finalTerms.expirationDate));
    horizonMonths = endIndex - startIndex + 1;
  } else if (finalTerms.isMonthToMonth) {
    // No end date exists to find. The schedule runs to the caller's horizon and says so,
    // rather than reporting a missing end for an agreement that genuinely has none.
    horizonMonths = maxMonths;
    issues.push({
      code: 'TERM_INDEFINITE',
      severity: 'info',
      message:
        'The agreement continues month to month with no fixed end date. The schedule ' +
        `projects ${maxMonths} months from commencement; it has no contractual end.`,
    });
  } else if (finalTerms.initialTermMonths > 0) {
    horizonMonths = finalTerms.initialTermMonths;
    issues.push({
      code: 'RENEWALS_NOT_PROJECTED',
      severity: 'info',
      message:
        'No expiration date is stated, so the schedule covers the initial term only. ' +
        'Renewal periods are not projected.',
    });
  } else {
    issues.push({
      code: 'MISSING_SCHEDULE_END',
      severity: 'error',
      message:
        'Neither an expiration date nor an initial term length is stated, so the end of ' +
        'the schedule cannot be determined.',
    });
  }

  if (issues.some((i) => i.severity === 'error') || horizonMonths === null || horizonMonths <= 0) {
    return { rows: [], oneTimeCharges: [], issues };
  }

  let totalMonths = Math.min(horizonMonths, maxMonths);

  // --- Termination ---------------------------------------------------------------------
  // Rent stops when the agreement was terminated, not when it would otherwise have expired.
  // Scheduling past a termination bills a tenant who has left.
  if (fold.terminationDate) {
    const endIndex = monthIndexOf(parseLocalDate(fold.terminationDate));
    const monthsToTermination = endIndex - startIndex + 1;
    if (monthsToTermination < totalMonths) {
      issues.push({
        code: 'TERMINATED_EARLY',
        severity: 'info',
        message:
          `The agreement was terminated on ${fold.terminationDate}. The schedule ends there ` +
          'rather than at the contractual expiry.',
      });
      totalMonths = Math.max(0, monthsToTermination);
    }
  }

  if (totalMonths <= 0) {
    return { rows: [], oneTimeCharges: [], issues };
  }

  const hasPendingCommencement = sortedDocs.some((d) =>
    d.validationFlags.some(
      (f) => f.code === 'COMMENCEMENT_DATE_PENDING' && f.status === 'active'
    )
  );

  const nowIndex = monthIndexOf(now);
  const rows: RentScheduleItem[] = [];

  // --- Escalation anchor ---------------------------------------------------------------
  // Leases do not necessarily escalate on their commencement anniversary. Where the
  // contract states a first escalation date, that date governs; otherwise it is derived as
  // commencement + one interval and ESCALATION_DATE_DERIVED records that it was inferred.
  let firstEscalation: Date | null = null;
  if (escalates) {
    if (terms.escalation.firstEscalationDate) {
      firstEscalation = parseLocalDate(terms.escalation.firstEscalationDate);
    } else {
      firstEscalation = addMonths(startDate, terms.escalation.frequencyMonths);
      issues.push({
        code: 'ESCALATION_DATE_DERIVED',
        severity: 'info',
        message:
          'The contract states no first escalation date. It has been derived as the ' +
          `commencement date plus ${terms.escalation.frequencyMonths} months ` +
          `(${formatLocalDate(firstEscalation)}). Confirm against the contract.`,
      });
    }
  }

  // --- Escalation continuity across a rent-reset amendment -----------------------------
  // Confirmed convention: an amendment that states only a new rent figure, without
  // restating the escalation clause, leaves that clause "in force" exactly as written —
  // it keeps compounding from the lease's ORIGINAL anchor, using the new rent as the base
  // of the formula, rather than restarting the count from the amendment's own effective
  // date. (A restatement that names its own escalation terms is a different epoch entirely
  // and is unaffected by this.) That is an assumption over what the amendment left silent,
  // not a certainty, so every epoch where it actually governs is surfaced here rather than
  // applied invisibly.
  if (escalates && firstEscalation) {
    for (let i = 1; i < fold.epochs.length; i++) {
      const prev = fold.epochs[i - 1];
      const epoch = fold.epochs[i];
      const rentDocChanged =
        epoch.provenance['leaseTerms.baseRent']?.docId !==
        prev.provenance['leaseTerms.baseRent']?.docId;
      const escalationDocChanged =
        epoch.provenance['leaseTerms.escalation']?.docId !==
        prev.provenance['leaseTerms.escalation']?.docId;
      if (rentDocChanged && !escalationDocChanged) {
        issues.push({
          code: 'ESCALATION_ANCHOR_UNCHANGED_BY_AMENDMENT',
          severity: 'info',
          message:
            `${epoch.sourceDocReference} (effective ${epoch.from}) changed the rent to ` +
            `${epoch.terms.baseRent} without restating the escalation clause. Per the ` +
            `standing convention, escalation keeps compounding from the original anchor ` +
            `(${formatLocalDate(firstEscalation)}) applied to this new rent, rather than ` +
            "restarting from the amendment's effective date. Confirm this matches intent " +
            'for this amendment.',
        });
      }
    }
  }

  /** Escalation steps in effect on a given day. */
  const stepsOn = (day: Date): number => {
    if (!firstEscalation || day < firstEscalation) return 0;
    const months =
      (day.getFullYear() - firstEscalation.getFullYear()) * 12 +
      (day.getMonth() - firstEscalation.getMonth());
    const dayAdjust = day.getDate() >= firstEscalation.getDate() ? 0 : -1;
    return Math.floor((months + dayAdjust) / terms.escalation.frequencyMonths) + 1;
  };

  // Rent as written in the contract, converted to a monthly basis. A $2,250 quarterly
  // charge is a $750 monthly obligation; billing 2,250 every month overstates it 3x.
  const normalise = (state: FoldedState) => {
    const t = state.terms;
    const per = MONTHS_PER_PAYMENT[t.paymentFrequency] || 1;
    // A fixed monthly utility charge is a real recurring obligation, but it does NOT
    // escalate — the reference lease system models it as "monthly fees which do not
    // escalate". Held separately so escalation is never applied to it.
    const fixedMonthly =
      state.utilities?.billingType === 'fixed_rate' &&
      typeof state.utilities?.baseMonthlyAmount === 'number' &&
      state.utilities.baseMonthlyAmount > 0
        ? state.utilities.baseMonthlyAmount
        : 0;

    return {
      monthlyRent: roundCents(t.baseRent / per),
      contractRent: t.baseRent,
      frequency: t.paymentFrequency,
      fixedMonthlyCharge: fixedMonthly,
      escalation:
        t.escalation.type === 'fixed_amount'
          ? { ...t.escalation, value: t.escalation.value / per }
          : t.escalation,
    };
  };

  // The agreement's tenant name is the record the portfolio is managed under. It is only
  // overridden where the chain itself shows the counterparty changing — an assignment or a
  // rename — so the schedule names whoever was actually liable that month.
  const originalLessee = fold.epochs[0].lesseeName;
  const tenantNameFor = (epoch: TermEpoch): string =>
    epoch.lesseeName && epoch.lesseeName !== originalLessee
      ? epoch.lesseeName
      : agreement.tenantName;

  for (let m = 0; m < totalMonths; m++) {
    const periodDate = new Date(startYear, startMonth + m, 1);
    const periodIndex = monthIndexOf(periodDate);
    const yyyy = periodDate.getFullYear();
    const mm = String(periodDate.getMonth() + 1).padStart(2, '0');

    // The terms in force this month, folded from the chain: an amendment contributes only
    // the terms it names, so a rent increase no longer discards the escalation clause and
    // renewal options it never mentioned.
    const epoch = resolveTermsAt(fold.epochs, formatLocalDate(periodDate)) as TermEpoch;
    const current = normalise(epoch);
    const activeDocRef = epoch.sourceDocReference;
    const activeDocType = epoch.sourceDocType;

    const isRenewal = hasInitialTerm && m >= terms.initialTermMonths;

    const monthStart = periodDate;
    const monthLength = daysInMonth(yyyy, periodDate.getMonth());
    const stepsAtStart = stepsOn(monthStart);
    const stepsAtEnd = stepsOn(new Date(yyyy, periodDate.getMonth(), monthLength));

    let escalationAmt: number;
    if (stepsAtEnd > stepsAtStart && firstEscalation) {
      // An escalation lands inside this month. Bill the old rate up to the day before and
      // the new rate from the escalation day inclusive, prorated on actual days —
      // the convention evidenced by the reference projections.
      const escDay = firstEscalation.getDate();
      const before = escalationAfterSteps(current.monthlyRent, stepsAtStart, current.escalation, isRenewal, yyyy);
      const after = escalationAfterSteps(current.monthlyRent, stepsAtEnd, current.escalation, isRenewal, yyyy);
      const daysAtOld = Math.max(0, Math.min(monthLength, escDay - 1));
      const daysAtNew = monthLength - daysAtOld;
      escalationAmt = roundCents((before * daysAtOld + after * daysAtNew) / monthLength);
    } else {
      escalationAmt = escalationAfterSteps(current.monthlyRent, stepsAtStart, current.escalation, isRenewal, yyyy);
    }

    // A commencement mid-month prorates only the first row, on the same actual-days basis
    // already used for a mid-month escalation above — confirmed against the production
    // ledgers rather than assumed. Every other month bills in full.
    const daysBilled = m === 0 && firstPeriodProrated ? monthLength - startDate.getDate() + 1 : monthLength;
    const prorationFactor = daysBilled / monthLength;

    const rowBaseRent = roundCents(current.monthlyRent * prorationFactor);
    const rowEscalationAmt = roundCents(escalationAmt * prorationFactor);
    const rowFixedCharge = roundCents(current.fixedMonthlyCharge * prorationFactor);

    rows.push({
      periodIndex: m + 1,
      year: yyyy,
      month: periodDate.getMonth() + 1,
      formattedPeriod: `${yyyy}-${mm}`,
      siteId: site.siteId,
      siteCode: site.siteCode,
      siteName: site.siteName,
      tenantName: tenantNameFor(epoch),
      address: site.address,
      baseRent: rowBaseRent,
      escalationAmount: rowEscalationAmt,
      fixedMonthlyCharge: rowFixedCharge,
      totalMonthlyRent: roundCents(rowBaseRent + rowEscalationAmt + rowFixedCharge),
      contractRent: current.contractRent,
      paymentFrequency: current.frequency,
      ...(typeof agreement.commissionRate === 'number' && agreement.commissionRate > 0
        ? (() => {
            const gross = roundCents(rowBaseRent + rowEscalationAmt + rowFixedCharge);
            const commission = roundCents(gross * agreement.commissionRate);
            return { commissionAmount: commission, netMonthlyRent: roundCents(gross - commission) };
          })()
        : {}),
      activeDocReference: activeDocRef,
      docType: activeDocType,
      isConditionalCommencement: hasPendingCommencement,
      // Classified against today, not against the row's position in the schedule.
      // Periods up to and including the current month are obligations already incurred.
      status: hasPendingCommencement
        ? 'pending_resolution'
        : periodIndex <= nowIndex
        ? 'active'
        : 'projected',
    });
  }

  // --- Holdover -----------------------------------------------------------------------
  // A holdover multiplier applies only if the tenant stays past expiry, which is an event
  // that has not happened and cannot be projected from the contract alone. Reported so the
  // clause is visible rather than silently dropped.
  const holdoverMultiplier = fold.epochs[fold.epochs.length - 1].holdover?.multiplier;
  if (typeof holdoverMultiplier === 'number' && holdoverMultiplier > 0) {
    issues.push({
      code: 'HOLDOVER_NOT_PROJECTED',
      severity: 'info',
      message:
        `The contract sets a holdover rent multiplier of ${holdoverMultiplier}x. It is not ` +
        'projected: holdover depends on the tenant remaining past expiry, which cannot be ' +
        'derived from the contract.',
    });
  }

  // --- One-time fees ------------------------------------------------------------------
  // Collected from every confirmed document. Due dates are derived from the commencement
  // date plus the stated offset; when a contract states no offset the due date stays null
  // rather than defaulting to commencement, which would invent a payable date.
  const oneTimeCharges: OneTimeCharge[] = [];
  for (const doc of sortedDocs) {
    const docRef = doc.data.documentMetadata.referenceNumber || doc.fileName;
    for (const fee of doc.data.oneTimeFees ?? []) {
      if (!fee || typeof fee.amount !== 'number' || fee.amount <= 0) continue;

      let dueDate: string | null = null;
      if (typeof fee.dueDateOffsetDays === 'number') {
        const due = new Date(startDate);
        due.setDate(due.getDate() + fee.dueDateOffsetDays);
        dueDate = formatLocalDate(due);
      } else {
        issues.push({
          code: 'ONE_TIME_FEE_DUE_DATE_UNKNOWN',
          severity: 'info',
          message: `The contract states no due date for the one-time fee "${fee.description}" ($${fee.amount.toFixed(2)}). It is listed without a date rather than assuming one.`,
        });
      }

      oneTimeCharges.push({
        description: fee.description,
        amount: fee.amount,
        dueDate,
        siteId: site.siteId,
        siteCode: site.siteCode,
        siteName: site.siteName,
        tenantName: agreement.tenantName,
        address: site.address,
        sourceDocReference: docRef,
      });
    }
  }

  return { rows, oneTimeCharges, issues };
}
