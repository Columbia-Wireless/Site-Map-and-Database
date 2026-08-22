import { getSupabase } from '@/lib/supabase'
import { logChange } from '@/lib/audit'
import { matchHostAgency, matchLicensee } from '@/lib/sam2Match'
import type { Sam2SyncPayload, Sam2SyncResult, Sam2DocType, Sam2LeaseTerms } from '@/lib/sam2Types'

/**
 * Core SAM 2.0 -> Supabase sync logic. Extracted 2026-08-22 from
 * app/api/sam2/sync/route.ts so it can be called from two different entry
 * points with two different trust models:
 *
 *   - app/api/sam2/sync/route.ts: called from our own browser client
 *     (Sam2ImportModal's postMessage relay), org/actor derived from the
 *     logged-in user's session.
 *   - app/api/sam2/webhook/route.ts: called by SAM 2.0 itself, server to
 *     server, no browser session — org/actor passed in explicitly by the
 *     webhook route (see resolveDefaultOrganizationId there).
 *
 * The sync logic itself — site/licensee resolution, management agreement
 * handling, license upsert, review-gate status — is identical either way and
 * lives here untouched from the original route.
 */

export interface Sam2SyncContext {
  organizationId: string
  actorName: string
  actorId: string | null
}

const DOC_TYPE_MAP: Record<Sam2DocType, string> = {
  lease: 'lease',
  amendment: 'amendment',
  addendum: 'amendment',
  termination: 'other',
  assignment: 'other',
  commencement_agreement: 'other',
  management_agreement: 'other',
}

/**
 * One row per sync attempt, for the "Recent SAM 2.0 Imports" panel — see
 * supabase/sam2_import_log.sql. Deliberately swallows its own errors: a
 * missing table (migration not yet run) or a logging failure must never turn
 * an otherwise-successful sync into a reported failure, and must never mask
 * the real error on a failed one.
 */
async function logImportAttempt(
  supabase: ReturnType<typeof getSupabase>,
  row: {
    organization_id: string | null
    file_name: string
    site_id: string | null
    document_id: string | null
    outcome: 'synced' | 'needs_review' | 'non_instrument' | 'error'
    warnings: string[]
    error_message?: string
    actor_name: string
    actor_id: string | null
  }
) {
  try {
    const { error } = await supabase.from('sam2_import_log').insert([row])
    if (error) console.error('[sam2Sync] import log write failed (non-fatal):', error.message)
  } catch (err) {
    console.error('[sam2Sync] import log write failed (non-fatal):', err)
  }
}

function computeAnnualRent(leaseTerms: Sam2LeaseTerms | undefined): number {
  if (!leaseTerms) return 0
  const multiplier = { monthly: 12, quarterly: 4, annually: 1 }[leaseTerms.paymentFrequency] ?? 1
  return leaseTerms.baseRent * multiplier
}

/**
 * Flattens the escalation clause into the legacy flat `escalation_rate` numeric
 * column (percent) for backward compatibility with existing reports/charts that
 * only read that column. Full detail is preserved separately in
 * escalation_detail — this is a lossy simplification for anything that isn't a
 * plain fixed-percentage escalation, flagged via the warnings array.
 */
function simplifyEscalationRate(leaseTerms: Sam2LeaseTerms | undefined): { rate: number; warning: string | null } {
  const esc = leaseTerms?.escalation
  if (!esc) return { rate: 0, warning: null }
  if (esc.type === 'fixed_percentage') return { rate: esc.value * 100, warning: null }
  if (esc.type === 'none') return { rate: 0, warning: null }
  return {
    rate: 0,
    warning: `Escalation type is "${esc.type}" — legacy escalation_rate set to 0. See escalation_detail for the full clause.`,
  }
}

export async function syncSam2Payload(payload: Sam2SyncPayload, ctx: Sam2SyncContext): Promise<Sam2SyncResult> {
  const supabase = getSupabase()
  const warnings: string[] = []
  const ed = payload.extractedData

  const isNonInstrument = ed.classification?.role === 'non_instrument' || ed.classification?.role === 'exhibit'
  const isManagementAgreement = ed.classification?.role === 'management_agreement'

  try {
    // ── 1. Resolve or create the site ──────────────────────────────────────
    const { data: existingSite } = await supabase
      .from('tower_sites')
      .select('id')
      .eq('sam2_site_id', payload.siteId)
      .maybeSingle()

    let siteId: string
    let hostAgencyResult = { matched: false, confidence: 'none', id: null as string | null, suggestedName: null as string | null }

    if (existingSite && (isNonInstrument || isManagementAgreement)) {
      siteId = existingSite.id
    } else if (isNonInstrument || isManagementAgreement) {
      warnings.push(
        isManagementAgreement
          ? 'This site was created from a management agreement, not a carrier lease. Owner and tower type need manual entry once a base lease is filed.'
          : `This site was created from a non-instrument document (${ed.classification?.nonInstrumentKind ?? ed.classification?.role}), not a lease. Owner and tower type need manual entry once a base lease is filed.`
      )
      const { data: inserted, error } = await supabase
        .from('tower_sites')
        .insert([{
          site_code: ed.siteIdentity.siteCode || payload.siteId.slice(0, 12),
          name: ed.siteIdentity.siteName || ed.siteIdentity.rawAddress || 'Unnamed site',
          address: ed.siteIdentity.rawAddress || '',
          city: ed.geocode?.city || ed.siteIdentity.city || '',
          state: ed.geocode?.state || ed.siteIdentity.state || '',
          zip: ed.geocode?.postalCode || ed.siteIdentity.zip || '',
          lat: ed.geocode?.latitude ?? 0,
          lng: ed.geocode?.longitude ?? 0,
          host_agency_id: null,
          tower_type: 'small_cell',
          height_ft: ed.siteIdentity.heightFt ?? null,
          status: 'operational',
          organization_id: ctx.organizationId,
          sam2_site_id: payload.siteId,
        }])
        .select('id')
        .single()
      if (error) throw new Error(`tower_sites insert failed: ${error.message}`)
      siteId = inserted.id
      await logChange(supabase, siteId, 'site_created', null, `${ed.siteIdentity.siteName || ed.siteIdentity.rawAddress || 'Unnamed site'} (via SAM 2.0, ${isManagementAgreement ? 'management agreement' : 'non-instrument document'})`, ctx.actorName, {
        userId: ctx.actorId, entityType: 'site',
      })
    } else {
      const agencyMatch = await matchHostAgency(supabase, ed.siteIdentity.lessorName)
      if (agencyMatch.confidence === 'exact' || agencyMatch.confidence === 'high') {
        hostAgencyResult = { matched: true, confidence: agencyMatch.confidence, id: agencyMatch.id, suggestedName: agencyMatch.matchedName }
      } else if (agencyMatch.confidence === 'low') {
        hostAgencyResult = { matched: false, confidence: 'low', id: null, suggestedName: agencyMatch.matchedName }
        warnings.push(`Site owner "${ed.siteIdentity.lessorName}" not confidently matched — closest existing match is "${agencyMatch.matchedName}". Left unlinked for manual review.`)
      } else {
        warnings.push(`Site owner "${ed.siteIdentity.lessorName}" has no matching record — site created without a linked owner.`)
      }

      let towerType = ed.siteIdentity.installationType
      if (!towerType) {
        towerType = 'small_cell'
        warnings.push(`Tower type not stated in the document — defaulted to "${towerType}". Needs manual confirmation.`)
      }

      const siteData = {
        site_code: ed.siteIdentity.siteCode || payload.siteId.slice(0, 12),
        name: ed.siteIdentity.siteName || ed.siteIdentity.rawAddress,
        address: ed.siteIdentity.rawAddress,
        city: ed.geocode?.city || ed.siteIdentity.city || '',
        state: ed.geocode?.state || ed.siteIdentity.state || '',
        zip: ed.geocode?.postalCode || ed.siteIdentity.zip || '',
        lat: ed.geocode?.latitude ?? 0,
        lng: ed.geocode?.longitude ?? 0,
        host_agency_id: hostAgencyResult.id,
        tower_type: towerType,
        height_ft: ed.siteIdentity.heightFt ?? null,
        status: 'operational',
        organization_id: ctx.organizationId,
        sam2_site_id: payload.siteId,
      }

      if (!siteData.city || !siteData.state || !siteData.zip) {
        warnings.push('City/state/zip not available from SAM 2.0 geocoding — left blank. Needs manual entry or address-parsing follow-up.')
      }

      if (existingSite) {
        siteId = existingSite.id
        const { error } = await supabase.from('tower_sites').update(siteData).eq('id', siteId)
        if (error) throw new Error(`tower_sites update failed: ${error.message}`)
      } else {
        const { data: inserted, error } = await supabase.from('tower_sites').insert([siteData]).select('id').single()
        if (error) throw new Error(`tower_sites insert failed: ${error.message}`)
        siteId = inserted.id
        await logChange(supabase, siteId, 'site_created', null, `${siteData.name} (via SAM 2.0)`, ctx.actorName, {
          userId: ctx.actorId, entityType: 'site',
        })
      }
    }

    // ── 2. Resolve or create the licensee ──────────────────────────────────
    let licenseeId: string | null = null
    let licenseeCreated = false
    let lesseeMatchConfidence = 'none'
    if (!isNonInstrument && !isManagementAgreement) {
      const lesseeMatch = await matchLicensee(supabase, ed.siteIdentity.lesseeName)
      lesseeMatchConfidence = lesseeMatch.confidence
      if (lesseeMatch.confidence === 'exact' || lesseeMatch.confidence === 'high') {
        licenseeId = lesseeMatch.id!
      } else {
        if (lesseeMatch.confidence === 'low') {
          warnings.push(`Licensee "${ed.siteIdentity.lesseeName}" not confidently matched (closest: "${lesseeMatch.matchedName}") — created as a new record. Review for a possible duplicate.`)
        }
        const { data: newLicensee, error } = await supabase
          .from('licensees')
          .insert([{ name: ed.siteIdentity.lesseeName, status: 'active' }])
          .select('id')
          .single()
        if (error) throw new Error(`licensees insert failed: ${error.message}`)
        licenseeId = newLicensee.id
        licenseeCreated = true
      }
    }

    // ── 3. Upsert the document ──────────────────────────────────────────────
    const docType = isNonInstrument ? 'other' : (DOC_TYPE_MAP[ed.documentMetadata.docType] ?? 'other')

    const flagsNote = payload.validationFlags?.length
      ? payload.validationFlags.map(f => `[${f.severity}] ${f.message}`).join('\n')
      : null

    const { rate: previewEscalationRate } = (isNonInstrument || isManagementAgreement) ? { rate: 0 } : simplifyEscalationRate(ed.leaseTerms)

    const extractedTerms: Record<string, unknown> = isNonInstrument
      ? {
          document_category: { value: ed.classification?.nonInstrumentKind ?? ed.classification?.role ?? 'non_instrument', confidence: 'high' },
          ...(flagsNote ? { sam2_validation_flags: { value: flagsNote, confidence: 'medium' } } : {}),
          _sam2_raw: payload,
        }
      : isManagementAgreement
      ? {
          document_category: { value: 'management_agreement', confidence: 'high' },
          site_owner: { value: ed.siteIdentity.lessorName, confidence: 'high' },
          manager_entity: { value: ed.siteIdentity.lesseeName, confidence: 'high' },
          signature_date: { value: ed.documentMetadata.executionDate, confidence: 'high' },
          commencement_date: ed.documentMetadata.commencementDate ? { value: ed.documentMetadata.commencementDate, confidence: 'high' } : undefined,
          governing_law: ed.legalTerms?.governingLaw ? { value: ed.legalTerms.governingLaw, confidence: 'high' } : undefined,
          termination_notice_days: ed.managementTerms?.terminationNoticeDays != null
            ? { value: `${ed.managementTerms.terminationNoticeDays} days`, confidence: 'high' }
            : ed.legalTerms?.terminationNoticeDays != null ? { value: `${ed.legalTerms.terminationNoticeDays} days`, confidence: 'high' } : undefined,
          management_commission: ed.managementTerms
            ? {
                value: ed.managementTerms.commissionStructure === 'percentage' && ed.managementTerms.commissionPercentage != null
                  ? `${(ed.managementTerms.commissionPercentage * 100).toFixed(1)}%`
                  : ed.managementTerms.commissionStructure === 'flat_fee' && ed.managementTerms.commissionFlatFeeAmount != null
                  ? `$${ed.managementTerms.commissionFlatFeeAmount.toLocaleString()} flat`
                  : ed.managementTerms.commissionDescription ?? '',
                confidence: 'high',
                note: 'As stated in the document — not the operational commission rate used for billing, which is confirmed separately.',
              }
            : undefined,
          billing_practices: ed.managementTerms?.billingPractices ? { value: ed.managementTerms.billingPractices, confidence: 'high' } : undefined,
          exclusivity: ed.managementTerms?.exclusivity ? { value: ed.managementTerms.exclusivity, confidence: 'high' } : undefined,
          term_end_date: ed.managementTerms?.termEndDate
            ? { value: ed.managementTerms.termEndDate, confidence: 'high' }
            : ed.managementTerms?.initialTermDescription ? { value: ed.managementTerms.initialTermDescription, confidence: 'medium', note: 'No explicit end date stated — this is the term description as written.' } : undefined,
          renewal_terms: ed.managementTerms?.renewalTerms ? { value: ed.managementTerms.renewalTerms, confidence: 'high' } : undefined,
          notes: ed.legalTerms?.notes ? { value: ed.legalTerms.notes, confidence: 'high' } : undefined,
          ...(flagsNote ? { sam2_validation_flags: { value: flagsNote, confidence: 'medium' } } : {}),
          _sam2_raw: payload,
        }
      : {
          licensor: { value: ed.siteIdentity.lessorName, confidence: 'high' },
          licensee: { value: ed.siteIdentity.lesseeName, confidence: 'high' },
          site_id: ed.siteIdentity.siteCode ? { value: ed.siteIdentity.siteCode, confidence: 'high' } : undefined,
          premises_address: { value: ed.siteIdentity.rawAddress, confidence: 'high' },
          signature_date: { value: ed.documentMetadata.executionDate, confidence: 'high' },
          commencement_date: { value: ed.documentMetadata.commencementDate ?? null, confidence: ed.documentMetadata.commencementDate ? 'high' : 'low' },
          monthly_rent: ed.leaseTerms ? { value: ed.leaseTerms.baseRent, confidence: 'high' } : undefined,
          initial_term_years: ed.leaseTerms ? { value: Math.round(ed.leaseTerms.initialTermMonths / 12), confidence: 'high' } : undefined,
          escalation_type: ed.leaseTerms ? { value: ed.leaseTerms.escalation.type, confidence: 'high' } : undefined,
          escalation_rate: ed.leaseTerms
            ? {
                value: `${previewEscalationRate}%`,
                confidence: ed.leaseTerms.escalation.type === 'fixed_percentage' || ed.leaseTerms.escalation.type === 'none' ? 'high' : 'medium',
                note: ed.leaseTerms.escalation.type === 'cpi' || ed.leaseTerms.escalation.type === 'fixed_amount'
                  ? `Escalation is "${ed.leaseTerms.escalation.type}" — the rent engine uses the full clause, this flat rate is a display simplification only.`
                  : undefined,
              }
            : undefined,
          one_time_fee: ed.oneTimeFees?.length
            ? { value: ed.oneTimeFees.map(f => `${f.description}: $${f.amount}`).join('; '), confidence: 'high' }
            : undefined,
          renewal_options: ed.leaseTerms
            ? {
                value: `${ed.leaseTerms.renewalOptions.count} × ${ed.leaseTerms.renewalOptions.durationMonths}mo${ed.leaseTerms.renewalOptions.isAutomatic ? ', automatic' : ''}`,
                confidence: 'high',
              }
            : undefined,
          holdover_provisions: ed.holdover
            ? {
                value: `${ed.holdover.multiplier}x rent${ed.holdover.maxHoldoverDays != null ? `, max ${ed.holdover.maxHoldoverDays} days` : ''}`,
                confidence: 'high',
              }
            : undefined,
          utilities: ed.utilities
            ? {
                value: [
                  ed.utilities.billingType,
                  ed.utilities.baseMonthlyAmount != null ? `$${ed.utilities.baseMonthlyAmount}/mo base` : null,
                  ed.utilities.powerLimitKw != null ? `${ed.utilities.powerLimitKw}kW limit` : null,
                  ed.utilities.meterInstallationResponsibility ? `meter: ${ed.utilities.meterInstallationResponsibility}` : null,
                ].filter(Boolean).join(' · '),
                confidence: 'high',
              }
            : undefined,
          insurance_per_occurrence: ed.insuranceRequirements
            ? { value: `$${ed.insuranceRequirements.generalLiabilityLimit.toLocaleString()}`, confidence: 'high' }
            : undefined,
          insurance_aggregate: ed.insuranceRequirements
            ? { value: `$${ed.insuranceRequirements.aggregateLimit.toLocaleString()}`, confidence: 'high' }
            : undefined,
          insurance_liability: ed.insuranceRequirements
            ? { value: ed.insuranceRequirements.requiresAdditionalInsured ? 'Additional insured required' : 'Additional insured not required', confidence: 'high' }
            : undefined,
          premises_description: ed.legalTerms?.premisesDescription ? { value: ed.legalTerms.premisesDescription, confidence: 'high' } : undefined,
          governing_law: ed.legalTerms?.governingLaw ? { value: ed.legalTerms.governingLaw, confidence: 'high' } : undefined,
          permitted_use: ed.legalTerms?.permittedUse ? { value: ed.legalTerms.permittedUse, confidence: 'high' } : undefined,
          assignment_allowed: ed.legalTerms?.assignmentAllowed ? { value: ed.legalTerms.assignmentAllowed, confidence: 'high' } : undefined,
          termination_notice_days: ed.legalTerms?.terminationNoticeDays != null ? { value: `${ed.legalTerms.terminationNoticeDays} days`, confidence: 'high' } : undefined,
          relocation_provisions: ed.legalTerms?.relocationProvisions ? { value: ed.legalTerms.relocationProvisions, confidence: 'high' } : undefined,
          equipment_description: ed.legalTerms?.equipmentDescription ? { value: ed.legalTerms.equipmentDescription, confidence: 'high' } : undefined,
          notes: ed.legalTerms?.notes ? { value: ed.legalTerms.notes, confidence: 'high' } : undefined,
          ...(flagsNote ? { sam2_validation_flags: { value: flagsNote, confidence: 'medium' } } : {}),
          _sam2_raw: payload,
        }

    const { data: existingDoc } = await supabase
      .from('site_documents')
      .select('id, doc_status')
      .eq('sam2_doc_id', payload.documentId)
      .maybeSingle()

    const docStatus = isNonInstrument
      ? 'extracted'
      : (existingDoc?.doc_status === 'approved' || existingDoc?.doc_status === 'notarized')
        ? existingDoc.doc_status
        : 'review_required'

    let documentId: string
    const docRow = {
      site_id: siteId,
      name: payload.fileName,
      doc_type: docType,
      doc_status: docStatus,
      extracted_terms: extractedTerms,
      sam2_doc_id: payload.documentId,
    }
    if (existingDoc) {
      documentId = existingDoc.id
      const { error } = await supabase.from('site_documents').update(docRow).eq('id', documentId)
      if (error) throw new Error(`site_documents update failed: ${error.message}`)
    } else {
      const { data: inserted, error } = await supabase
        .from('site_documents')
        .insert([{ ...docRow, uploaded_by: ctx.actorName, uploaded_at: new Date().toISOString(), file_size_kb: 0 }])
        .select('id')
        .single()
      if (error) throw new Error(`site_documents insert failed: ${error.message}`)
      documentId = inserted.id
    }

    // ── Upsert management agreement terms, if applicable ────────────────────
    if (isManagementAgreement) {
      try {
        const mt = ed.managementTerms
        const ownerMatch = await matchHostAgency(supabase, ed.siteIdentity.lessorName)
        const agreementRow = {
          organization_id: ctx.organizationId,
          sam2_agreement_id: payload.agreementId,
          document_id: documentId,
          host_agency_id: ownerMatch.confidence === 'exact' || ownerMatch.confidence === 'high' ? ownerMatch.id : null,
          site_owner_name: ed.siteIdentity.lessorName,
          manager_entity_name: ed.siteIdentity.lesseeName,
          commission_type: mt?.commissionStructure ?? null,
          commission_rate: mt?.commissionPercentage ?? null,
          flat_fee_amount: mt?.commissionFlatFeeAmount ?? null,
          commission_description: mt?.commissionDescription ?? null,
          billing_practices: mt?.billingPractices ?? null,
          start_date: ed.documentMetadata.effectiveDate || ed.documentMetadata.commencementDate || null,
          end_date: mt?.termEndDate ?? null,
          initial_term_description: mt?.initialTermDescription ?? null,
          renewal_terms: mt?.renewalTerms ?? null,
          termination_notice_days: mt?.terminationNoticeDays ?? null,
          exclusivity: mt?.exclusivity ?? null,
          covers_multiple_sites: mt?.coversMultipleSites ?? false,
          governing_law: ed.legalTerms?.governingLaw ?? null,
          notes: ed.legalTerms?.notes ?? null,
        }

        const { data: existingAgreement } = await supabase
          .from('management_agreements')
          .select('id')
          .eq('sam2_agreement_id', payload.agreementId)
          .maybeSingle()

        let managementAgreementId: string
        if (existingAgreement) {
          managementAgreementId = existingAgreement.id
          const { error } = await supabase.from('management_agreements').update(agreementRow).eq('id', managementAgreementId)
          if (error) throw new Error(error.message)
        } else {
          const { data: inserted, error } = await supabase.from('management_agreements').insert([agreementRow]).select('id').single()
          if (error) throw new Error(error.message)
          managementAgreementId = inserted.id
        }

        const { error: linkError } = await supabase
          .from('management_agreement_sites')
          .upsert([{ management_agreement_id: managementAgreementId, site_id: siteId }], { onConflict: 'management_agreement_id,site_id' })
        if (linkError) warnings.push(`Management agreement saved but could not be linked to its site: ${linkError.message}`)

        if (mt?.coversMultipleSites) {
          warnings.push('SAM 2.0 flagged this document as covering multiple sites. Only this one site was linked — check for related documents covering the rest.')
        }
      } catch (err: any) {
        console.error('[sam2Sync] management_agreements write failed (non-fatal):', err?.message ?? err)
        warnings.push('Management agreement terms were extracted but could not be saved to the management_agreements table (migration may not be applied yet). The document itself synced successfully.')
      }
    }

    // ── 4. Upsert the license/agreement ─────────────────────────────────────
    let licenseId: string | null = null
    if (!isNonInstrument && !isManagementAgreement) {
      const { rate: escalationRate, warning: escalationWarning } = simplifyEscalationRate(ed.leaseTerms)
      if (escalationWarning) warnings.push(escalationWarning)

      const { data: existingLicense } = await supabase
        .from('site_licenses')
        .select('id')
        .eq('sam2_agreement_id', payload.agreementId)
        .maybeSingle()

      const licenseRow = {
        site_id: siteId,
        licensee_id: licenseeId,
        annual_rent: computeAnnualRent(ed.leaseTerms),
        escalation_rate: escalationRate,
        escalation_detail: ed.leaseTerms?.escalation ?? null,
        renewal_detail: ed.leaseTerms?.renewalOptions ?? null,
        one_time_fees: ed.oneTimeFees ?? null,
        license_start: ed.documentMetadata.commencementDate || ed.documentMetadata.effectiveDate || ed.documentMetadata.executionDate,
        license_end: ed.leaseTerms?.expirationDate ?? null,
        status: 'active',
        document_id: documentId,
        sam2_agreement_id: payload.agreementId,
      }

      if (existingLicense) {
        licenseId = existingLicense.id
        const { error } = await supabase.from('site_licenses').update(licenseRow).eq('id', licenseId)
        if (error) throw new Error(`site_licenses update failed: ${error.message}`)
      } else {
        const { data: inserted, error } = await supabase
          .from('site_licenses')
          .insert([{ ...licenseRow, contract_type: 'Base Agreement', invoice_method: 'None', mount_type: 'Primary' }])
          .select('id')
          .single()
        if (error) throw new Error(`site_licenses insert failed: ${error.message}`)
        licenseId = inserted.id
        await logChange(supabase, siteId, 'license_added', null, `${ed.siteIdentity.lesseeName} (via SAM 2.0)`, ctx.actorName, {
          userId: ctx.actorId, entityType: 'site',
        })
      }

      const { error: linkError } = await supabase
        .from('site_documents')
        .update({ license_id: licenseId })
        .eq('id', documentId)
      if (linkError) warnings.push(`Document synced but could not be linked to its agreement: ${linkError.message}`)
    } else {
      warnings.push(
        isManagementAgreement
          ? 'Management agreement — stored and attached to the site, not linked to any carrier license.'
          : 'Non-instrument document — stored and attached to the site, not linked to any license.'
      )
    }

    const result: Sam2SyncResult = {
      siteId,
      licenseId,
      documentId,
      hostAgency: hostAgencyResult,
      licensee: { matched: !licenseeCreated, confidence: lesseeMatchConfidence, id: licenseeId, created: licenseeCreated },
      warnings,
      needsReview: docStatus === 'review_required',
    }

    await logImportAttempt(supabase, {
      organization_id: ctx.organizationId,
      file_name: payload.fileName,
      site_id: siteId,
      document_id: documentId,
      outcome: isNonInstrument ? 'non_instrument' : (docStatus === 'review_required' ? 'needs_review' : 'synced'),
      warnings,
      actor_name: ctx.actorName,
      actor_id: ctx.actorId,
    })

    return result
  } catch (err: any) {
    console.error('[sam2Sync] failed:', err?.message ?? err)
    await logImportAttempt(supabase, {
      organization_id: ctx.organizationId,
      file_name: payload?.fileName ?? 'unknown',
      site_id: null,
      document_id: null,
      outcome: 'error',
      warnings: [],
      error_message: err?.message ?? 'Sync failed',
      actor_name: ctx.actorName,
      actor_id: ctx.actorId,
    })
    throw err
  }
}
