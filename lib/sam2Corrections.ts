/**
 * Correction write-back to SAM 2.0 — task #43. Spec confirmed by Onno,
 * 2026-08-19 (email "The correction endpoint is live"):
 *
 *   POST <SAM2_CORRECTIONS_URL>
 *   header: X-Correction-Secret: <SAM2_CORRECTION_SECRET>
 *   body: { documentId, siteId, agreementId, fieldPath, oldValue, newValue,
 *           correctedBy, correctedAt }
 *
 * Behavior on SAM 2.0's side (per Onno): three-way check against the value
 * we claim is current — matches the new value already -> confirms (safe to
 * resend the same correction twice); matches the old value we sent -> applies
 * and logs it; matches neither -> rejects and returns SAM 2.0's actual
 * current value, so a stale correction can never silently overwrite a newer
 * one. SAM 2.0 re-validates the document afterward and only adds new
 * validationFlags, never touches ones already there.
 *
 * SAM2_CORRECTION_SECRET is not set yet as of this writing — Onno
 * deliberately didn't send it in plain email and asked how Thomas wants to
 * receive it. Until it's set in the Cloud Run env, sendCorrectionToSam2()
 * no-ops (logs and returns ok:false) rather than failing the local save —
 * the correction always lands in our own database regardless of whether
 * SAM 2.0 has been told about it yet. Once the secret is set, corrections
 * start flowing automatically, no code change needed.
 */

const SAM2_CORRECTIONS_URL = process.env.SAM2_CORRECTIONS_URL || 'https://sam2-ppwakvoaoa-uc.a.run.app/api/corrections'

export interface Sam2Correction {
  documentId: string
  siteId: string
  agreementId: string
  fieldPath: string
  oldValue: unknown
  newValue: unknown
  correctedBy: string
  correctedAt: string // ISO 8601
}

export interface Sam2CorrectionResult {
  attempted: boolean
  ok: boolean
  status?: number
  message?: string
}

export async function sendCorrectionToSam2(correction: Sam2Correction): Promise<Sam2CorrectionResult> {
  const secret = process.env.SAM2_CORRECTION_SECRET
  if (!secret) {
    console.warn('[sam2Corrections] SAM2_CORRECTION_SECRET not set — correction saved locally only, not sent to SAM 2.0.')
    return { attempted: false, ok: false, message: 'SAM2_CORRECTION_SECRET not configured' }
  }

  try {
    const res = await fetch(SAM2_CORRECTIONS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Correction-Secret': secret },
      body: JSON.stringify(correction),
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      console.error(`[sam2Corrections] SAM 2.0 rejected correction (${res.status}):`, text)
      return { attempted: true, ok: false, status: res.status, message: text || `HTTP ${res.status}` }
    }
    return { attempted: true, ok: true, status: res.status }
  } catch (err: any) {
    // Network/timeout failure — never lets a correction write-back problem
    // block the local save, which already happened by the time this runs.
    console.error('[sam2Corrections] request failed:', err?.message ?? err)
    return { attempted: true, ok: false, message: err?.message ?? 'Request failed' }
  }
}

/**
 * Maps our flat TermsReviewModal field keys onto the nested SAM 2.0 field
 * path SAM 2.0 expects (e.g. 'monthly_rent' -> 'leaseTerms.baseRent'). Same
 * set of fields applyCorrectionToSam2Raw() in the terms route knows how to
 * patch locally — a field only reaches SAM 2.0 if we also know how to apply
 * it to our own copy of the record.
 */
export const FIELD_TO_SAM2_PATH: Record<string, string> = {
  licensor: 'siteIdentity.lessorName',
  licensee: 'siteIdentity.lesseeName',
  commencement_date: 'documentMetadata.commencementDate',
  signature_date: 'documentMetadata.executionDate',
  monthly_rent: 'leaseTerms.baseRent',
  initial_term_years: 'leaseTerms.initialTermMonths',
  escalation_type: 'leaseTerms.escalation.type',
}
