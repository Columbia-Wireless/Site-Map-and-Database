# SCETV Tower Management Demo — Feature Status
**URL**: https://tower-demo-461686768358.us-east1.run.app  
**Stack**: Next.js 16.2.4 · Supabase PostgreSQL · Leaflet · Recharts · Cloud Run (us-east1)  
**Last updated**: 2026-05-15

---

## ✅ Built & Demo-Ready

### Core Portfolio Management
- **Dashboard** — KPI cards (total sites, active tenants, annual revenue, expiring licenses), occupancy chart, revenue trend
- **Sites portfolio** — searchable/filterable list, per-site detail pages with occupancy bar, tenant chips, audit trail
- **Tenant / Licensee management** — detail pages with all licenses, revenue summary, map link
- **Host Agencies (Owners)** — detail pages with KPI mini-dashboard, all sites, revenue roll-up
- **Contacts module** — typed contact rolodex per licensee/owner (Carrier AP, Lease Admin, Legal, Emergency, COI, etc.), grouped by category, click-to-call and mailto links; 57 contacts seeded

### Map
- **Interactive Leaflet map** — all 501 SC ETV sites plotted, pulsing markers, click-to-site-detail, licensee filter, site-code tooltips

### Document Management ⭐ Key Demo Feature
- Upload PDFs to Supabase storage with type classification (Lease, Amendment, COI, Survey, etc.)
- **AI term extraction** — Claude Sonnet reads the PDF and extracts parties, rent, dates, escalation rate, governing law, assignment rights, etc. with confidence scoring
- **Address cross-check** — flags if lease address doesn't match site record
- **Review & approve workflow** — Needs Review → Approved → Notarized
- **IOTA blockchain notarization** (simulation mode) — generates tamper-proof block ID and explorer link
- **Audit trail per document** — every extraction, approval, edit, notarization logged

### Reports ⭐ Key Demo Feature
9 reports, all with live data, filters, and CSV export (for users with export permission):
1. **Rent Roll** — all active licenses, sortable by host agency, carrier, rent
2. **Expiring Contracts** — 30/60/90-day filter with urgency color coding
3. **Rent by Month** — year/month selector, stacked bar by tenant category, per-site breakdown
4. **Projected Revenue** — multi-year heatmap matrix, carrier/year filters, cliff detection
5. **Lease Comparables** — rent/ft² benchmarking across portfolio
6. **Value Added** — waterfall bridge chart (Historical → New Agreements → Amendment Uplift → Settlements → Total Under Management)
7. **Expiry Calendar** — grouped by host agency
8. **Exceptions & Alerts** — missing data, below-market rents, holdover tenants
9. **Lease Timeline (Gantt)** — SVG Gantt chart by site, color-coded by tenant category, today line, bar height scaled to rent

### Reston International Center (VA001) ⭐ Historical Demo Site
Real Columbia Wireless managed rooftop (11800 Sunrise Valley Drive, Reston VA) used as a showcase of CWS's track record:
- **16 licenses** — AT&T, Verizon, T-Mobile, Fairfax County, FBI, WMATA, ZAYO/AboveNet, NBC/WRC-TV, MWAA, Oceans Edge (active) + Sprint, Nextel (terminated 2013 + $45K settlement), ClearWire (bill of sale 2014), Andrew Corp, SKYTEL, COX (expired)
- **$458,400/yr active revenue** — peak ~$540K when Sprint + Nextel + ClearWire were active
- **29 real lease documents** uploaded — TLAs, amendments (up to 8th), termination letters, settlement, renewals
- **17 real site photos** — rooftop 2010, equipment inspections 2014 (Nextel/ClearWire, Verizon)
- **20-entry audit trail** from 2000–2014 with actual CWF manager names (Richard Carr, Abe Stein)
- **Revenue history chart** shows full carrier lifecycle

### Field Surveys
- Mobile-friendly GPS survey wizard (condition ratings, photos, notes)
- Offline-tolerant, works on phone browser

### User & Access Management
- Invite users by email (Resend SMTP)
- Role assignment: super_admin / admin / editor / reporter / viewer
- Per-user **Export CSV** permission (CW admin grants to SCETV staff)
- Admin panel with data management tools

---

## ⚠️ Partial / Needs Attention

| Item | Status | Notes |
|---|---|---|
| Audit log (site edits) | Partial | `site_change_log` exists; DB triggers not firing — entries are manual only |
| Document extraction error display | Fixed this session | Was browser `alert()`, now inline banner |
| Sidebar branding | Built | Verify "by Columbia Wireless" + "Powered by VeriPura" shows correctly in deployed version |
| IOTA notarization | Simulation mode | Real blockchain: install `@iota/iota-sdk`, set `IOTA_PRIVATE_KEY` env var |

---

## ❌ Not Built — Remaining Work

### High Priority (RFP / Government Bid)
| Item | Effort | Cost |
|---|---|---|
| **AD Authentication** (NextAuth v5 + Microsoft Entra ID) | ~2 days | $0 — `next-auth` already in package.json |
| **Supabase RLS** (row-level security) | ~1 day | $0 |
| **Audit log completeness** — auth events, role changes, IP address | ~1 day | $0 (optional +$25/mo Supabase Pro for PITR) |
| **GIS / OGC compliance** — WFS 2.0, WMS, GetCapabilities | ~4 days | $6–26/mo (pg_featureserv + GeoServer/MapServer) |

### Medium Priority
| Item | Effort | Notes |
|---|---|---|
| MFA / TOTP | ~1 day | Supabase supports it; needs enforcement flag + UI |
| Audit log rollback endpoint | ~0.5 day | `PATCH /api/sites/[id]/restore?changeId=xxx` |
| IOTA go-live | ~0.5 day | Keys + `npm install @iota/iota-sdk` |
| GeoJSON API endpoint | ~0.5 day | Already partially built at `/api/sites/geojson` |

### Low Priority / Deferred
| Item | Notes |
|---|---|
| FedRAMP compliance | Supabase NOT FedRAMP authorized — must raise with client if required |
| PostGIS spatial queries | Needed for full OGC; PostGIS extension available on Supabase |
| Audit log 90-day retention policy | DB cron job |
| Report drill-down to licensee accounts | `LicenseeLink` wired into most reports already |

---

## Infrastructure Costs (Current)
| Item | Cost |
|---|---|
| Cloud Run (tower-demo) | ~$5–15/mo depending on traffic |
| Supabase (free tier) | $0 |
| Resend SMTP | $0 (free tier) |
| **Total** | **~$5–15/mo** |

Adding full RFP compliance (GIS/OGC + audit) brings monthly cost to **~$20–40/mo**.

---

## Demo Talking Points
1. **501-site SC ETV portfolio** seeded with realistic SC carriers, federal agencies, broadcast tenants
2. **Reston International Center** — 25 years of real Columbia Wireless management history, real documents, real photos
3. **AI document extraction** — paste a PDF, get structured lease terms in seconds (Claude Sonnet)
4. **9 reports** replicating and enhancing Columbia Wireless's original system
5. **Blockchain notarization** via IOTA — tamper-proof document integrity
6. **Role-based access** — CW admin controls what SCETV staff can see and export
7. **Mobile field surveys** — GPS-enabled condition reporting from any phone
