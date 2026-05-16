# SCETV Site Management — Demo Verification Guide
## For Columbia Wireless Presenters

This guide explains how to demonstrate each compliance capability to SCETV evaluators. All tests use a standard browser — no special software required unless noted.

**Live URL:** `https://tower-demo-461686768358.us-east1.run.app`

---

## 1. GIS / OGC API Features Compliance

**What it proves:** The system exposes tower location data through a standard OGC API Features endpoint. Any GIS client (QGIS, ArcGIS, a state GIS portal) can consume this without custom integration.

### Browser verification (2 minutes)

| Step | URL | What to show |
|---|---|---|
| 1. Discovery | `/api/ogc` | JSON landing page — self-describes all available endpoints |
| 2. Conformance | `/api/ogc/conformance` | Declares OGC API Features Part 1 Core conformance |
| 3. Collections | `/api/ogc/collections` | Lists available feature collections |
| 4. All sites | `/api/ogc/collections/sites/items` | Full GeoJSON FeatureCollection of all tower sites |
| 5. Spatial filter | `/api/ogc/collections/sites/items?bbox=-83.35,32.03,-78.50,35.22` | Only sites within South Carolina bounding box |
| 6. Single site | `/api/ogc/collections/sites/items/{any-site-id}` | Individual feature by UUID |

### Key talking point
> *"Any state GIS system or OGC-compliant client can connect to `/api/ogc` and it self-describes — standard URL, standard format, no custom integration needed. The `bbox` parameter means they can query by geographic area, not just pull all records."*

### For technical evaluators (QGIS)
1. Open QGIS → Layer → Add Layer → Add WFS Layer
2. Click New, enter URL: `https://tower-demo-461686768358.us-east1.run.app/api/ogc`
3. Click Detect — it will discover the `sites` collection automatically
4. Add layer — tower sites appear as point features on the map

---

## 2. Audit Trail

**What it proves:** Every significant action in the system is recorded with who did it, when, and from what IP address. The log is tamper-evident (users cannot edit or delete their own log entries).

### What is logged

| Event | Captured by | Includes IP |
|---|---|---|
| User login (email/password) | Database trigger on `auth.users` | No (client-side auth) |
| User login (Google / Microsoft) | OAuth callback route | Yes |
| User logout | Server-side logout route | Yes |
| User invited | Admin users API | Yes |
| Role or export permission changed | Admin users API | Yes |
| User deleted | Database trigger on `auth.users` | No (DB level) |
| Site created | Sites API route | Yes |
| Site field edited | Audit library, all PATCH routes | Yes |
| License added / changed / removed | Tenancies API route | Yes |
| Document uploaded / approved / notarized | Documents API route | Yes |

### Browser verification (3 minutes)

**Step 1 — View the audit trail on any site:**
1. Log in and navigate to any site (e.g. Sites → select any site)
2. Click the **Audit Trail** tab
3. Show the change log — each entry shows field changed, old value → new value, who made the change, and timestamp

**Step 2 — Query the audit API directly (admin only):**

All auth events:
```
/api/audit?entity_type=auth
```

All events in the last 7 days (replace date):
```
/api/audit?from=2026-05-10T00:00:00Z
```

Events by a specific user (replace UUID):
```
/api/audit?user_id={user-uuid}
```

Response includes: `field_name`, `old_value`, `new_value`, `changed_by`, `user_id`, `ip_address`, `changed_at`.

**Step 3 — Show MFA login event:**
1. Sign out and sign back in
2. Query `/api/audit?entity_type=auth` — the login event appears with timestamp

### Key talking point
> *"The audit log is stored in the database, not in application logs that could be cleared. Every write goes through a library function that captures the actor's UUID and IP address. Login events are captured at the database trigger level, independent of the application layer — so they can't be bypassed."*

### Retention policy
- Audit logs are automatically purged after **90 days** via a scheduled database job (runs at 2am UTC daily)
- This meets standard government record-retention minimums while controlling database growth

---

## 3. Multi-Factor Authentication (MFA / TOTP)

**What it proves:** The system supports time-based one-time password (TOTP) as a second authentication factor, compatible with Google Authenticator, Microsoft Authenticator, and Authy.

### How it works
- MFA is **optional per user** — each user enrolls via their Account Settings
- Once enrolled, **every login** requires the 6-digit code after the password
- If a user tries to skip the MFA step, the system redirects them back — it cannot be bypassed
- Admins can disable MFA for a locked-out user via the Supabase admin console

### Live demonstration (5 minutes)

**Enroll MFA:**
1. Log in to the platform
2. Click **Account Settings** in the left sidebar (shield icon)
3. Click **Enable two-factor authentication**
4. Open Google Authenticator (or Microsoft Authenticator) on a phone → tap the + button → Scan QR code
5. Scan the QR code displayed on screen
6. Enter the 6-digit code shown in the app → click Confirm
7. The shield turns green — *"Two-factor authentication is now active"*

**Test enforcement:**
1. Sign out
2. Sign back in with the same credentials
3. After the password step, the system presents the MFA code screen — the dashboard is not accessible until the code is entered
4. Enter the 6-digit code → access granted

### Key talking point
> *"This is TOTP — the same standard used by federal government systems, banks, and enterprise platforms. It requires physical access to the user's phone. Even if a password is compromised, an attacker cannot access the system without the enrolled device."*

---

## 4. Role-Based Access Control (RBAC)

**What it proves:** Data access is enforced at two levels — the application layer (UI and API routes) and the database layer (Row-Level Security). A viewer cannot write data even by calling the API directly.

### Role hierarchy

| Role | Can do |
|---|---|
| **Super Admin** | Everything, including granting Super Admin |
| **Admin** | Manage users, full data access |
| **Editor** | Create/edit sites, licenses, documents, equipment |
| **Reporter** | View all data, export if permitted |
| **Viewer** | Read-only. Export blocked unless explicitly granted |

### Database-level enforcement (RLS)
All 14 tables have Row-Level Security enabled. Policies enforce:
- **SELECT**: any authenticated user (logged in) can read
- **INSERT/UPDATE**: editor role or above
- **DELETE**: admin role or above for sensitive tables
- **Audit log**: authenticated users can insert (for app logging); nobody can update or delete

### Demonstration
1. Navigate to **User Management** (Admin menu)
2. Show a user set to `viewer` role
3. Show the export toggle — disabled by default
4. Toggle export on → explain Columbia Wireless controls this per user
5. Change role via the dropdown — change is immediate, no page reload needed

---

## 5. Microsoft / Azure AD Authentication

**What it proves:** SCETV staff can sign in using their existing Microsoft work accounts — no separate password to manage.

### Demonstration
1. Go to the login page
2. Click **Continue with Microsoft**
3. Microsoft's login page opens — enter SCETV credentials
4. On first login, a `viewer` profile is created automatically
5. Columbia Wireless admin assigns appropriate access via User Management

### Key talking point
> *"SCETV users never create a password in this system. They authenticate through Microsoft — which SCETV already manages, including password policies, MFA, and account lifecycle. When an SCETV employee leaves, disabling their Microsoft account immediately revokes access here."*

---

## Summary Checklist for Evaluators

| Requirement | Status | How to verify |
|---|---|---|
| OGC API Features (WFS 3.0) | ✅ Compliant | `/api/ogc` — self-describing endpoint |
| GeoJSON export | ✅ | `/api/ogc/collections/sites/items` |
| Spatial (bbox) filtering | ✅ | Add `?bbox=` parameter |
| Audit log — data changes | ✅ | Audit Trail tab on any site |
| Audit log — auth events | ✅ | `/api/audit?entity_type=auth` |
| Audit log — IP addresses | ✅ | Included in API response |
| 90-day retention | ✅ | Automated daily purge job |
| MFA / TOTP | ✅ | Account Settings → Enable MFA |
| Active Directory (Microsoft SSO) | ✅ | Login page → Continue with Microsoft |
| Role-based access control | ✅ | User Management page |
| Row-Level Security (DB layer) | ✅ | All 14 tables, enforced at Postgres level |
| AES-256 encryption at rest | ✅ | Supabase default (SOC 2 Type II certified) |
| TLS 1.2+ in transit | ✅ | Google Cloud Run default |
