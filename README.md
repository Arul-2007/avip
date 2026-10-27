# AVIP - APAAR Verify Intelligence Platform

AVIP is a runnable prototype for **AICTE problem statement 26263**. It demonstrates how an institution enrolment submission can be validated, reviewed, approved, committed, identity-checked, conflict-resolved, analysed, exported and audited in one role-based platform.

> **Synthetic data only.** APAAR identity verification is simulated by `MOCK-AVIP`. This project has no live APAAR, ABC, DigiLocker, AICTE or government integration and is not production-ready.

---

## 1. Tech stack

| Layer | Technology | What it is used for |
|---|---|---|
| Runtime | **Node.js 22.5+** (tested on Node 24.11.0) | Application server, database access, test runner |
| Backend | **Node.js built-in `http`** | Zero-dependency HTTP server and static file serving |
| Database | **Supabase Postgres** via `pg` | Persistent relational storage, transactions, indexes |
| Backend language | **CommonJS JavaScript** | API handlers, validation, auth, audit chain |
| Frontend | **HTML5 + CSS3 + vanilla JavaScript** | Single-page application with no framework and no bundler |
| Frontend pattern | Hash-based SPA router | `#/dashboard`, `#/students`, `#/imports`, etc. |
| Styling | Hand-written responsive CSS | Dark sidebar, cards, tables, modals, mobile layout |
| Icons | Inline SVG | No external icon library or CDN |
| Authentication | Session cookie + `scrypt` password hashing | `session_token`, HttpOnly, SameSite=Strict |
| MFA | Static demo MFA code | AICTE admin account requires `246810`; not a real TOTP implementation |
| PII protection | AES-256-GCM + HMAC-SHA256 | APAAR encrypted at rest, deterministic lookup token, masked in API/UI |
| Audit | SHA-256 hash chain | Tamper-evident audit event sequence with verification endpoint |
| File imports | CSV upload and template | 5 MB limit, idempotency key, row validation and staging |
| Reports | CSV export | Intake utilisation and enrolment reports |
| Tests | **Node.js built-in `node:test` + `fetch`** | End-to-end API smoke test |
| Package manager | npm scripts only | One runtime dependency: `pg` |
| Optional tooling | Git, Docker not required | Plain Node process plus a hosted Supabase database |
| Operating systems | Windows, macOS, Linux | Tested on Windows with PowerShell |
| Browser support | Modern Chrome, Edge, Firefox, Safari | Requires JavaScript |

### Dependencies

The only runtime dependency is `pg`, the official PostgreSQL driver. There is no Express, React, Vite or ORM. Run `npm install` once before starting the application.

---

## 2. Prerequisites

- **Node.js 22.5 or newer** (Node 24 LTS recommended).
- A modern web browser.
- A **Supabase Postgres project** and its connection string. The schema and demo data are created automatically on first start.

Check your version:

```bash
node --version
npm --version
```

If Node is older than 22.5, upgrade Node before continuing. Node 24 LTS or newer is recommended.

---

## 3. Run the project

### 3.1 Open a terminal in the project folder

```bash
cd avip
```

If the project is at the original location on Windows:

```powershell
cd "D:\Arul\D34\docs for project clg\sih2k26\avip"
```

### 3.2 Configure Supabase

Copy `.env.example` to `.env` and set `DATABASE_URL` to your Supabase Postgres URI:

```powershell
Copy-Item .env.example .env
notepad .env
```

In the Supabase dashboard, open **Project Settings -> Database -> Connection string** and copy the URI. Keep `sslmode=require` in the URL. Then install dependencies:

```bash
npm install
```

The app applies `src/schema.sql` on startup and seeds demo data when the `institutions` table is empty.

### 3.3 Start the application

```bash
node src/server.js
```

Or use the npm script:

```bash
npm start
```

### 3.4 Open the application

Open:

```text
http://127.0.0.1:3000
```

The first start automatically:

1. Connects to Supabase and applies `src/schema.sql`.
2. Creates the local `data/` directory for encryption keys and uploaded CSVs.
3. Generates the HMAC and APAAR encryption keys in `data/keys.json`.
4. Seeds synthetic institutions, programmes, intake approvals, students, enrolments, import batches, a conflict case and audit events when the database is empty.
5. Creates `data/uploads/` for uploaded CSV files.

Uploaded CSV files still live on the local filesystem; only relational data is stored in Postgres.

### 3.5 Stop the application

Press `Ctrl+C` in the terminal.

### 3.6 Windows PowerShell note

If PowerShell blocks `npm.ps1` with an execution-policy error, use one of these instead:

```powershell
node src/server.js
```

```powershell
npm.cmd start
```

---

## 4. Demo accounts

All demo accounts use the password:

```text
Demo@1234
```

| Email | Role | Scope | MFA |
|---|---|---|---|
| `admin@aicte.demo` | AICTE Administrator | All institutions | Required: `246810` |
| `registrar@sit.demo` | Institution Administrator | Sunrise Institute of Technology | Not required |
| `submitter@sit.demo` | Institution Data Submitter | Sunrise Institute of Technology | Not required |
| `registrar@nce.demo` | Institution Administrator | Northern College of Engineering | Not required |
| `verifier@aicte.demo` | Verification Officer | All institutions | Not required |
| `auditor@aicte.demo` | Auditor (read-only) | All institutions | Not required |
| `operator@aicte.demo` | System Operator | Read-only reports and health | Not required |

The login screen also provides one-click demo account buttons for the six accounts listed in the server startup banner. The NCE institution administrator can be entered manually.

---

## 5. Recommended demo walkthrough

Use the seeded data to demonstrate the complete workflow.

### Step 1 - Check AICTE oversight

1. Sign in as `admin@aicte.demo` with password `Demo@1234` and MFA code `246810`.
2. Review the dashboard counts, open conflicts and intake utilisation.
3. Open **Programmes & intake** to see published intake approvals.

### Step 2 - Review and commit an import

1. Open **Data imports**.
2. Find the seeded batch `nce_cse_2026_batch02.csv` in `READY_FOR_REVIEW` status.
3. Open the batch, inspect rows and validation issues.
4. Approve the batch, then commit it.
5. The commit creates the staged enrolments and closes the batch as `COMMITTED`.

Alternative: sign in as `registrar@nce.demo` to submit and review that institution's imports using the CSV template.

### Step 3 - Verify identities

1. Open **Identity verification**.
2. Review pending checks.
3. Run verification on a pending enrolment.
4. The mock provider returns `VERIFIED`, `PENDING`, `INVALID`, `MISMATCH` or `UNAVAILABLE` based on the synthetic APAAR number.

### Step 4 - Resolve a conflict

1. Open **Conflict review**.
2. Open seeded case `CC-2026-0001`.
3. Compare the SIT and NCE enrolment candidates.
4. Assign the case and resolve it with a reason such as `LEGITIMATE_TRANSFER`.
5. The case leaves the open queue and a resolution event is written to the audit trail.

### Step 5 - Review analytics and export reports

1. Open **Intake analytics**.
2. Select academic year `2026-27`.
3. Review approved intake, counted enrolment, utilisation, supernumerary counts and alerts.
4. Download the intake CSV or enrolment CSV report.

### Step 6 - Verify the audit chain

1. Open **Audit trail**.
2. Click **Verify integrity**.
3. The banner confirms that all SHA-256 hash links are intact and reports how many events were checked.

### Step 7 - Demonstrate role scoping

1. Sign out.
2. Sign in as `registrar@sit.demo`.
3. Only Sunrise Institute of Technology data is visible.
4. Sign in as `auditor@aicte.demo` and confirm that write actions are unavailable.
5. Sign in as `operator@aicte.demo` and confirm restricted navigation and read-only access.

---

## 6. Main features

- Role-based access control for six roles.
- Session-based login with HttpOnly cookies and demo MFA.
- Institution management with approval status and optimistic version checks.
- Programme and intake approval management.
- Student and enrolment search with institution scoping.
- CSV import template download.
- CSV validation with row-level and field-level issues.
- Import status workflow:
  `UPLOADED -> READY_FOR_REVIEW / NEEDS_CORRECTION -> APPROVED -> COMMITTED`
- Idempotent CSV uploads using an `Idempotency-Key`.
- Duplicate and cross-institution enrolment conflict detection.
- Conflict assignment and resolution workflow.
- Simulated APAAR identity verification with retry and failure states.
- Enrolment correction history.
- Intake utilisation analytics with supernumerary and NRI/OCI/foreign-national rules.
- CSV reports for intake utilisation and enrolments.
- Tamper-evident audit chain with verification endpoint.
- Correlation IDs, rate limiting, security headers and PII redaction.
- Responsive single-page user interface.

---

## 7. Project structure

```text
avip/
├── package.json
├── README.md
├── .env.example
├── .gitignore
├── public/
│   ├── index.html          # Application shell
│   ├── styles.css          # Responsive UI styling
│   └── app.js              # SPA: router, pages, forms, modals, API client
├── src/
│   ├── server.js           # HTTP server, static files, security headers
│   ├── api.js              # /api/v1 route handlers
│   ├── schema.sql          # PostgreSQL / Supabase schema and indexes
│   ├── seed.js             # Synthetic demo data
│   ├── db.js               # Postgres pool, async query adapter, transactions
│   ├── config.js           # Environment, roles, capabilities, CSV headers
│   ├── auth.js             # Login, sessions, MFA, capability checks
│   ├── security.js         # Crypto, APAAR masking, password hashing, redaction
│   ├── validation.js       # CSV parsing, validation rules, CSV escaping
│   ├── identity.js         # MOCK-AVIP identity provider
│   ├── audit.js            # Audit hash chain and outbox
│   └── errors.js           # HTTP error helpers
├── tests/
│   └── smoke.test.js       # End-to-end API smoke test
└── data/                   # Created at runtime; ignored by Git
    ├── keys.json
    └── uploads/
```

---

## 8. Configuration

| Variable | Default | Purpose |
|---|---|---|
| `DATABASE_URL` | unset (required) | Supabase Postgres connection string. `SUPABASE_DB_URL` is also accepted |
| `DB_SSL` | auto | `true` for hosted Supabase, `false` for local Postgres. Auto-detects localhost URLs |
| `PG_POOL_MAX` | `10` | Maximum Postgres pool connections |
| `AVIP_SEED` | `1` | Set to `0` to skip demo seeding |
| `AVIP_SCHEMA` | `src/schema.sql` | Path to the schema applied on startup |
| `PORT` | `3000` | HTTP port |
| `HOST` | `127.0.0.1` | Bind address. Use `0.0.0.0` only if LAN access is required |
| `AVIP_DATA_DIR` | `<project>/data` (`/tmp/avip-data` on Vercel) | Directory for keys and uploads |
| `AVIP_HMAC_KEY` | unset | Stable 32-byte base64 HMAC key for APAAR matching. Required in hosted deployments |
| `AVIP_ENCRYPTION_KEY` | unset | Stable 32-byte base64 AES key for APAAR encryption. Required in hosted deployments |
| `AVIP_KEY_ID` | `k1-env` | Key identifier used when keys come from environment variables |
| `MOCK_PROVIDER_DOWN` | unset | Set to `1` to make the mock identity provider return `UNAVAILABLE` |

### Run on another port

PowerShell:

```powershell
$env:PORT = "4000"
node src/server.js
```

macOS/Linux:

```bash
PORT=4000 node src/server.js
```

Then open `http://127.0.0.1:4000`.

### Use a different data directory

PowerShell:

```powershell
$env:AVIP_DATA_DIR = "C:\temp\avip-data"
node src/server.js
```

macOS/Linux:

```bash
AVIP_DATA_DIR=/tmp/avip-data node src/server.js
```

### Deploy to Vercel

The repository includes `api/index.js` and `vercel.json` for the Vercel Node runtime. Static files come from `public/`; API requests go to `/api/v1/*`.

Add these environment variables in the Vercel project:

| Variable | Value |
|---|---|
| `DATABASE_URL` | Supabase Postgres connection string |
| `AVIP_HMAC_KEY` | `hmacKey` from your local `data/keys.json` |
| `AVIP_ENCRYPTION_KEY` | `encryptionKey` from your local `data/keys.json` |
| `AVIP_DATA_DIR` | `/tmp/avip-data` |
| `PG_POOL_MAX` | `3` for a small demo |

Use the same keys as the database that was seeded. New keys cannot decrypt existing APAAR values or match existing HMAC tokens.

Deploy, then verify:

```text
https://YOUR-PROJECT.vercel.app/api/v1/health
```

If the health endpoint returns `STARTUP_FAILED`, open **Vercel -> Project -> Logs** and check the message. Common causes are a missing `DATABASE_URL`, incorrectly copied keys, or a Supabase network/SSL failure.

Vercel's filesystem is ephemeral. Uploaded CSV files under `/tmp` disappear after a cold start, so this prototype should not be treated as durable file storage on Vercel.

---

## 9. Reset the demo

Stop the server, clear the demo tables in Supabase, delete local runtime data, and start again.

Run this in the Supabase SQL editor:

```sql
TRUNCATE TABLE outbox_events, audit_events, conflict_case_items, conflict_cases,
  validation_issues, identity_checks, enrolments, import_rows, import_batches,
  students, intake_approvals, programmes, sessions, api_clients,
  institution_users, institutions RESTART IDENTITY CASCADE;
```

Then remove local keys and uploads:

PowerShell:

```powershell
Remove-Item -LiteralPath .\data -Recurse -Force
node src/server.js
```

macOS/Linux:

```bash
rm -rf data
node src/server.js
```

The schema is reapplied and synthetic seed data is recreated on the next start.

> Deleting `data/keys.json` invalidates previously encrypted APAAR values. Because the demo database is seeded from scratch, this is expected during a reset. Never run this against a database containing real data.

---

## 10. Run the automated test

```bash
npm test
```

Or directly:

```bash
node --test tests/smoke.test.js
```

The test requires `DATABASE_URL` in `.env` or the environment and is skipped when it is missing. It writes to that database, so point it at a disposable demo project, not a production database. The test:

- Connects to Supabase, applies the schema and seeds the database if it is empty.
- Starts the app on an ephemeral port.
- Checks health and ruleset version.
- Checks unauthenticated access is rejected.
- Checks MFA is required for the AICTE admin.
- Logs in as AICTE admin.
- Checks seeded dashboard counts.
- Approves and commits a seeded `READY_FOR_REVIEW` batch.
- Verifies an identity check.
- Fetches intake analytics and a CSV report.
- Verifies the audit chain.
- Confirms an operator cannot create an institution.

Expected result: `1` test passing (or `1` skipped when no database is configured). Because the test commits the seeded batch, reset the demo before running it again.

The project has no lint step and no build step.

---

## 11. CSV import format

Download the current template from the UI or:

```text
GET /api/v1/imports/template
```

Required columns:

```text
apaar_id,full_name,date_of_birth,programme_code,academic_year,roll_number,admission_date,seat_type,admission_category,nri_status,oci_status,foreign_national_status
```

Key validation rules:

- `apaar_id` must be exactly 12 digits.
- `full_name` and `programme_code` are required.
- `academic_year` must be one of `2024-25`, `2025-26`, `2026-27`, `2027-28`.
- `seat_type`: `REGULAR`, `SUPERNUMERARY` or `OTHER`.
- `admission_category`: `GENERAL`, `OBC`, `SC`, `ST` or `EWS`.
- `nri_status`, `oci_status`, `foreign_national_status`: `YES`, `NO` or `NOT_APPLICABLE`.
- Dates use `YYYY-MM-DD`.
- Maximum upload size is 5 MB.
- The programme must have an active intake approval for the selected academic year.

Uploads must include an `Idempotency-Key` header of 6-120 characters.

---

## 12. API overview

Base path:

```text
/api/v1
```

| Area | Endpoints |
|---|---|
| Health and metadata | `GET /health`, `GET /meta`, `GET /settings` |
| Authentication | `POST /auth/login`, `POST /auth/logout`, `GET /auth/me` |
| Dashboard | `GET /dashboard` |
| Institutions | `GET /institutions`, `POST /institutions`, `PATCH /institutions/:id` |
| Programmes and intake | `GET /programmes`, `POST /programmes`, `GET /intake`, `POST /intake` |
| Students and enrolments | `GET /students`, `GET /students/:id`, `GET /enrolments`, `PATCH /enrolments/:id`, `GET /enrolments/:id/history` |
| Imports | `GET /imports/template`, `GET /imports`, `POST /imports`, `GET /imports/:id`, `POST /imports/:id/approve`, `POST /imports/:id/reject`, `POST /imports/:id/commit` |
| Identity | `GET /identity/pending`, `GET /identity-checks`, `POST /identity-checks/:enrolmentId/verify` |
| Conflicts | `GET /conflicts`, `GET /conflicts/:id`, `POST /conflicts/:id/assign`, `POST /conflicts/:id/resolve` |
| Analytics and reports | `GET /analytics/intake`, `GET /reports/intake.csv`, `GET /reports/enrolments.csv` |
| Audit | `GET /audit`, `GET /audit/:id`, `GET /audit/verify` |
| Users | `GET /users` |

Authentication uses the `session_token` cookie issued by the login endpoint. Institution-scoped users only see data belonging to their institution.

Example login with `curl`:

```bash
curl -i -c cookies.txt \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@aicte.demo","password":"Demo@1234","mfaCode":"246810"}' \
  http://127.0.0.1:3000/api/v1/auth/login
```

Then call an authenticated endpoint:

```bash
curl -b cookies.txt http://127.0.0.1:3000/api/v1/dashboard
```

On Windows PowerShell, use `curl.exe` rather than the `curl` alias.

---

## 13. Security model

- Passwords are hashed with `scrypt` and a random salt.
- Session tokens are random, hashed in the database and sent in an `HttpOnly`, `SameSite=Strict` cookie.
- AICTE admin login requires demo MFA code `246810`.
- APAAR numbers are encrypted with AES-256-GCM and looked up with an HMAC-SHA256 token.
- Raw APAAR values are not returned by the API; the UI displays masked values.
- Role capabilities are checked server-side on every sensitive route.
- Institution users are scoped to their own institution.
- Institution updates use optimistic concurrency versions.
- CSRF protection relies on `SameSite=Strict` cookies and same-origin checks.
- Responses include CSP, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy` and `Cross-Origin-Opener-Policy`.
- Login attempts are rate-limited per IP; API requests are also rate-limited.
- Audit events are chained with SHA-256 hashes and can be verified from the UI or API.
- Uploaded files are stored under `data/uploads/` with restricted file permissions where supported.
- Row Level Security is enabled with no policies. The app's Postgres role bypasses RLS, while Supabase's public Data API is denied access to these tables.
- Error responses include correlation IDs for debugging without exposing stack traces to users.

### Important limitations

- All data is synthetic.
- Identity verification is mocked; the last digit of the synthetic APAAR controls the mock result:
  - `0` -> `INVALID`
  - `7` -> `PENDING`
  - `9` -> `MISMATCH`
  - any other digit -> `VERIFIED`
- Demo accounts and the demo MFA code are intentionally public.
- Rate limiting is in-memory and per process.
- The schema is applied with `CREATE TABLE IF NOT EXISTS` on startup; there are no migrations for schema changes after the first run.
- Uploaded CSV files are stored locally, not in Supabase Storage. A multi-instance deployment would need shared object storage.
- There is no email delivery, external queue, live government integration or multi-tenant production hardening.

---

## 14. Troubleshooting

### `DATABASE_URL is not configured`

Copy `.env.example` to `.env` and set the Supabase connection string. Restart the server after editing `.env`.

### `password authentication failed` or `ECONNREFUSED`

Check the database password and host in `DATABASE_URL`. Use the Supabase connection string from **Project Settings -> Database**, and keep the project running (free projects pause after inactivity).

### `self-signed certificate` or `SSL required`

Set `DB_SSL=true` for hosted Supabase. If you use a local Postgres instance, set `DB_SSL=false`.

### `Cannot find module 'pg'`

Run `npm install` in the `avip` folder.

### `npm.ps1 cannot be loaded because running scripts is disabled`

Use `npm.cmd start` or run `node src/server.js`.

### Port 3000 is already in use

Start on another port:

```powershell
$env:PORT = "4000"
node src/server.js
```

### Login says MFA is required

Sign in as `admin@aicte.demo` with MFA code `246810`, or use a non-admin demo account.

### The UI opens but no data appears

Check the server terminal for API errors and correlation IDs. If seeding was interrupted, clear the demo tables as described in section 9 and restart. The startup log also shows connection and seeding errors.

### The browser shows an old page

The prototype has no build step. Perform a hard refresh (`Ctrl+F5`) and confirm you are loading `http://127.0.0.1:3000`.

### Upload fails with `NO_ACTIVE_INTAKE`

An AICTE administrator must first publish an active intake approval for that programme and academic year.

### Upload fails with `IDEMPOTENCY_KEY_REQUIRED`

Send an `Idempotency-Key` header of 6-120 characters with the upload request.

### Requests return `429 TOO_MANY_REQUESTS`

Wait for the rate-limit window to reset. Login attempts are limited to 10 per five minutes per IP.

---

## 15. Notes for evaluation

- Run `npm install`, configure `.env`, then start with `node src/server.js`; there is no build step.
- Use the seeded `READY_FOR_REVIEW` batch to demonstrate the fastest end-to-end approve/commit flow.
- Use `CC-2026-0001` to demonstrate cross-institution conflict review.
- Use the **Audit trail -> Verify integrity** button to demonstrate the tamper-evident audit chain.
- Use the role switcher by signing in as different demo users to demonstrate RBAC and institution scoping.
- The implementation uses Node.js + Supabase Postgres + vanilla JavaScript. Internet access and a Supabase project are required for the database.

# avip
