import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Matches SAM 2.0's extracted lessorName/lesseeName (free text, no entity link) against
 * existing state_agencies / licensees rows so synced sites/licenses point at real entities
 * instead of duplicating them. Dependency-free (no fuzzy-match library) — Levenshtein
 * distance normalized to a 0..1 similarity ratio is enough for the "is this the same
 * agency/carrier under a slightly different name" case this exists to catch.
 */

export type MatchConfidence = 'exact' | 'high' | 'low' | 'none'

export interface MatchResult {
  id: string | null
  confidence: MatchConfidence
  matchedName: string | null
  /** Other plausible candidates, for a review UI — top 3 excluding the chosen match. */
  candidates: { id: string; name: string; score: number }[]
}

const HIGH_CONFIDENCE_THRESHOLD = 0.92
const LOW_CONFIDENCE_THRESHOLD = 0.6

/** Strips common legal suffixes/punctuation so "Verizon Wireless, LLC" ~= "Verizon Wireless Inc". */
function normalize(name: string): string {
  return name
    .toLowerCase()
    .replace(/[.,]/g, '')
    .replace(/\b(inc|llc|l\.l\.c|corp|corporation|co|company|ltd|lp|llp)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function levenshtein(a: string, b: string): number {
  const m = a.length
  const n = b.length
  if (m === 0) return n
  if (n === 0) return m

  const prev = new Array(n + 1)
  const curr = new Array(n + 1)
  for (let j = 0; j <= n; j++) prev[j] = j

  for (let i = 1; i <= m; i++) {
    curr[0] = i
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost)
    }
    for (let j = 0; j <= n; j++) prev[j] = curr[j]
  }
  return prev[n]
}

function similarity(a: string, b: string): number {
  const na = normalize(a)
  const nb = normalize(b)
  if (!na || !nb) return 0
  if (na === nb) return 1
  const dist = levenshtein(na, nb)
  const maxLen = Math.max(na.length, nb.length)
  return 1 - dist / maxLen
}

async function matchAgainst(
  supabase: SupabaseClient,
  table: 'state_agencies' | 'licensees',
  extractedName: string,
  organizationScopeCol: string | null
): Promise<MatchResult> {
  let query = supabase.from(table).select('id, name')
  if (organizationScopeCol) {
    // Neither table is currently org-scoped in the schema as of this writing (both
    // are shared reference data), so this is a no-op today — kept as a hook in case
    // that changes, rather than hardcoding an assumption that could silently exclude
    // rows if scoping is added later without updating this file.
  }
  const { data, error } = await query
  if (error || !data) return { id: null, confidence: 'none', matchedName: null, candidates: [] }

  const scored = data
    .map((row: { id: string; name: string }) => ({ id: row.id, name: row.name, score: similarity(extractedName, row.name) }))
    .sort((a, b) => b.score - a.score)

  const best = scored[0]
  if (!best) return { id: null, confidence: 'none', matchedName: null, candidates: [] }

  if (best.score >= HIGH_CONFIDENCE_THRESHOLD) {
    return { id: best.id, confidence: best.score === 1 ? 'exact' : 'high', matchedName: best.name, candidates: scored.slice(1, 4) }
  }
  if (best.score >= LOW_CONFIDENCE_THRESHOLD) {
    // Confident enough to surface as a suggestion, not confident enough to auto-link —
    // caller should flag for human confirmation rather than writing the FK.
    return { id: null, confidence: 'low', matchedName: best.name, candidates: scored.slice(0, 3) }
  }
  return { id: null, confidence: 'none', matchedName: null, candidates: scored.slice(0, 3) }
}

/** Matches an extracted lessor name against existing host agencies (state_agencies table). */
export function matchHostAgency(supabase: SupabaseClient, lessorName: string): Promise<MatchResult> {
  return matchAgainst(supabase, 'state_agencies', lessorName, null)
}

/** Matches an extracted lessee name against existing licensees/carriers. */
export function matchLicensee(supabase: SupabaseClient, lesseeName: string): Promise<MatchResult> {
  return matchAgainst(supabase, 'licensees', lesseeName, null)
}
