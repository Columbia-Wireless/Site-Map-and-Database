# SCETV Tower Management Platform
### Developed by Columbia Wireless · Powered by VeriPura

**Live Demo**: https://tower-demo-461686768358.us-east1.run.app

---

## Overview

A purpose-built web platform for managing South Carolina ETV's 501-site tower portfolio. The system provides Columbia Wireless staff and SCETV administrators with a single source of truth for all site licenses, tenants, documents, revenue, and field operations — replacing spreadsheet-based workflows and legacy desktop software with a modern, browser-based application accessible from any device.

---

## Features & Functionality

### Dashboard
Central command view showing the full portfolio at a glance. Displays total site count, active tenant count, annualised portfolio revenue, licenses expiring within 90 days, occupancy rate, and revenue trend charts. Designed to surface the metrics a portfolio manager needs before their first meeting of the day.

### Site Portfolio
Full list of all 501 SC ETV tower sites with search, filter by state/type/status, and sort. Each site has a dedicated detail page showing:
- Tower specifications (type, height, coordinates with map link)
- Host agency with drill-down
- Tenant occupancy bar and active tenant chips
- All licenses with status, rent, and term dates
- Document library
- Revenue history chart
- Media gallery (site photos)
- Full audit trail of all changes

### Tenant / Licensee Management
Directory of all licensees with profile pages showing their full license portfolio across all sites, total annual revenue, headquarters, and primary contacts. Links directly to site detail pages for each license.

### Host Agencies
Profile pages for each property owner/host agency (SC state agencies, municipalities, federal entities) with KPI summary — total sites, occupied vs vacant, expiring licenses, average revenue per site — and a table of all sites under that agency.

### Contacts
Typed contact rolodex attached to each licensee and agency. Contact types mirror Columbia Wireless's operational taxonomy: Carrier AP, Lease Admin, Legal, Site Tech, Emergency Line, COI Contact, Owner, Billing, Operations Manager, and infrastructure contacts (Generator, HVAC, Electric Billing). Each card shows name, phone (click-to-call), email (click-to-send), and notes.

### Interactive Map
Full-portfolio map with pulsing site markers. Click any marker to open the site detail panel. Filter by licensee to highlight only their sites across the portfolio. Supports coordinates-based navigation from site detail pages.

### Document Management ★ Demo Feature
Upload, classify, and track all lease documents per site. Supported types: Lease Agreement, Amendment, Addendum, COI, FCC License, Structural Certification, Survey, Other.

**AI Term Extraction** — click Extract Terms on any uploaded PDF and the system reads the document using Claude Sonnet and returns structured lease data: parties, premises address, commencement date, term length, renewal options, monthly rent, annual rent, escalation rate, escalation type, permitted use, equipment description, insurance requirements, governing law, termination notice period, and assignment rights — each with a confidence score (High / Medium / Low).

**Address cross-check** — automatically compares the lease's premises address against the site record and flags any mismatch for review.

**Document workflow** — Uploaded → Needs Review → Approved → Notarized. Every status change is logged.

**Blockchain notarization via IOTA** — approved documents can be submitted to the IOTA distributed ledger, generating a tamper-proof block ID and permanent explorer link. Provides cryptographic proof of document integrity for audit and legal purposes.

### Reports ★ Demo Feature
Nine live reports built to replicate and enhance Columbia Wireless's original system:

| Report | Description |
|---|---|
| **Rent Roll** | Complete active license register — site, carrier, host agency, annual rent, escalation, term dates, status |
| **Expiring Contracts** | Licenses expiring within 30 / 60 / 90 days with urgency color coding and direct links |
| **Rent by Month** | Year and month selector with stacked bar chart by tenant category, plus per-site/carrier detail table |
| **Projected Revenue** | Multi-year heatmap matrix showing revenue by site and year; cells turn red when a lease cliffs |
| **Lease Comparables** | Rent per square foot benchmarking across the portfolio for negotiation context |
| **Value Added** | Waterfall bridge chart quantifying CWS's contribution: Historical Portfolio → New Agreements → Amendment Uplift → Settlements → Total Under Management, with contract-type filter and per-license detail |
| **Expiry Calendar** | Upcoming expirations grouped by host agency |
| **Exceptions & Alerts** | Sites with data gaps, below-market rents, or holdover tenants requiring action |
| **Lease Timeline (Gantt)** | Visual timeline of all licenses per site, color-coded by tenant category, bar height scaled to rent value, with a today reference line |

All reports support export to CSV for users granted export permission by a CW administrator.

### Reston International Center ★ Demo Feature — CWS Track Record
A fully populated historical site demonstrating Columbia Wireless's depth of experience. Based on real CWF records for 11800 Sunrise Valley Drive, Reston VA — a rooftop portfolio managed by CWS for over 15 years.

- **16 licenses** across AT&T/Cingular (8 amendments), Verizon Wireless, T-Mobile, Fairfax County, FBI, WMATA, ZAYO/AboveNet, NBC/WRC-TV, Metropolitan Washington Airports Authority, Oceans Edge, plus terminated tenants Sprint, Nextel (with $45,000 settlement), ClearWire (asset sale), Andrew Corporation, SKYTEL, and COX
- **$458,400/yr current annual revenue** from 10 active tenants; portfolio peaked ~$540K/yr during the Sprint/Nextel era
- **29 real lease documents** in the document library — original TLAs, amendments through the 8th, termination letters, settlement agreement, renewal notices, bill of sale
- **17 real site photographs** — rooftop inspection June 2010, Nextel/ClearWire equipment survey October 2014, Verizon antenna array September 2014
- **20-entry audit trail** from site creation in 2000 through final management activity in 2015, logged under actual CWF manager names (Richard Carr, Abe Stein)
- Revenue history chart shows the full carrier lifecycle — growth phase, peak, Sprint/Nextel termination dip, and stabilised current state

### Field Surveys
Mobile-optimised GPS survey wizard for field technicians. Records site condition, equipment observations, photo documentation, and notes. Works from any phone browser without requiring a native app install.

### User & Access Management
Role-based access control with five levels: Super Admin, Admin, Editor, Reporter, Viewer. Columbia Wireless administrators can invite SCETV staff by email, assign roles, and control which users have CSV export permission. All user management is handled through the Admin panel — no database access required.

---

## Outstanding Items

| Item | Priority | Notes |
|---|---|---|
| Active Directory / Microsoft Entra ID authentication | High — RFP requirement | `next-auth` is already installed; needs Azure App Registration and configuration |
| Supabase Row-Level Security | High — RFP requirement | Data access policies not yet enforced at database level |
| Audit log completeness | Medium — RFP requirement | Login/logout events, role changes, and IP addresses not yet captured; site edit triggers need fixing |
| GIS / OGC API compliance | Medium — RFP requirement | WFS 2.0 / WMS endpoints required; GeoJSON endpoint partially built; needs pg_featureserv or GeoServer deployment |
| MFA / TOTP enforcement | Medium | Supabase supports it natively; needs UI prompt and enforcement flag |
| IOTA go-live (real blockchain) | Low | Currently in simulation mode; activating requires wallet key setup only — no code changes |
| FedRAMP assessment | Advisory | Supabase is not FedRAMP authorized; must be raised with client if the government contract requires it |
