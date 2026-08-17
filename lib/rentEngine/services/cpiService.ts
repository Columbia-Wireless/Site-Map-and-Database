import { EscalationClause } from '../types/lease';

/**
 * Historical US Bureau of Labor Statistics (BLS) CPI-U annual inflation rates.
 * Used for automatic CPI-indexed escalation calculations when no manual rate override is supplied.
 */
const HISTORICAL_CPI_U_ANNUAL_RATES: Record<number, number> = {
  2026: 0.025,
  2025: 0.027,
  2024: 0.029,
  2023: 0.034,
  2022: 0.065,
  2021: 0.070,
  2020: 0.014,
  2019: 0.023,
  2018: 0.019,
  2017: 0.021,
  2016: 0.021,
  2015: 0.007,
  2014: 0.008,
  2013: 0.015,
  2012: 0.017,
  2011: 0.030,
  2010: 0.015,
  2009: -0.004,
  2008: 0.001,
  2007: 0.041,
  2006: 0.025,
  2005: 0.034,
  2004: 0.033,
  2003: 0.019,
  2002: 0.024,
  2001: 0.016,
  2000: 0.034,
};

/** Standard fallback annual CPI rate when a year is out of range. */
const DEFAULT_CPI_RATE = 0.03;

/**
 * Get the historical CPI-U annual inflation rate for a given year.
 */
export function getCpiRateForYear(year?: number): number {
  if (!year) return DEFAULT_CPI_RATE;
  return HISTORICAL_CPI_U_ANNUAL_RATES[year] ?? DEFAULT_CPI_RATE;
}

export interface CpiResolutionResult {
  rate: number;
  source: 'override' | 'extracted' | 'index_lookup';
  description: string;
}

/**
 * Resolves the applicable CPI rate for a given CPI escalation clause.
 *
 * Precedence:
 * 1. `cpiRateOverride` manually set on the clause (HITL review drawer)
 * 2. `value` extracted from the contract (if > 0)
 * 3. `cpiService` BLS CPI-U index lookup rate for the specified year
 */
export function resolveCpiRate(
  escalation: EscalationClause,
  year?: number
): CpiResolutionResult | null {
  if (escalation.type !== 'cpi') {
    return null;
  }

  // 1. Manual override takes highest priority
  if (typeof escalation.cpiRateOverride === 'number' && escalation.cpiRateOverride > 0) {
    return {
      rate: escalation.cpiRateOverride,
      source: 'override',
      description: `Manual CPI Rate Override (${(escalation.cpiRateOverride * 100).toFixed(2)}%)`,
    };
  }

  // 2. Extracted rate on contract
  if (typeof escalation.value === 'number' && escalation.value > 0) {
    return {
      rate: escalation.value,
      source: 'extracted',
      description: `Extracted Contract CPI Rate (${(escalation.value * 100).toFixed(2)}%)`,
    };
  }

  // 3. BLS CPI-U index lookup service fallback
  const lookupRate = getCpiRateForYear(year);
  return {
    rate: lookupRate,
    source: 'index_lookup',
    description: `BLS CPI-U Index Lookup ${year ? `(${year})` : ''} (${(lookupRate * 100).toFixed(2)}%)`,
  };
}
