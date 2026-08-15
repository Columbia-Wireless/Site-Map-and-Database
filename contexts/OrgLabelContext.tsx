'use client'

import { createContext, useContext } from 'react'

export interface OrgLabels {
  ownerSingular: string
  ownerPlural: string
}

const DEFAULT_LABELS: OrgLabels = { ownerSingular: 'Owner', ownerPlural: 'Owners' }

const OrgLabelContext = createContext<OrgLabels>(DEFAULT_LABELS)

export function OrgLabelProvider({ labels, children }: { labels: OrgLabels; children: React.ReactNode }) {
  return <OrgLabelContext.Provider value={labels}>{children}</OrgLabelContext.Provider>
}

/** The per-organization term for the site-owner/landlord entity (e.g. "Owner" by default, "Landlord" for other clients). */
export function useOrgLabel(): OrgLabels {
  return useContext(OrgLabelContext)
}
