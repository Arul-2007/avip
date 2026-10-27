-- AVIP PostgreSQL / Supabase schema.
-- Run this file in the Supabase SQL editor or let the app apply it on startup.

CREATE TABLE IF NOT EXISTS institutions (
  id                 TEXT PRIMARY KEY,
  institution_code   TEXT UNIQUE,
  legal_name         TEXT NOT NULL,
  approval_status    TEXT NOT NULL CHECK (approval_status IN ('PENDING','ACTIVE','SUSPENDED','EXPIRED')),
  approval_reference TEXT,
  state_code         TEXT,
  created_at         TEXT NOT NULL,
  updated_at         TEXT NOT NULL,
  version            INTEGER NOT NULL DEFAULT 1 CHECK (version > 0)
);

CREATE TABLE IF NOT EXISTS institution_users (
  id            TEXT PRIMARY KEY,
  institution_id TEXT REFERENCES institutions(id),
  email         TEXT NOT NULL UNIQUE,
  display_name  TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('AICTE_ADMIN','INSTITUTION_ADMIN','SUBMITTER','VERIFIER','AUDITOR','OPERATOR')),
  status        TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INVITED','SUSPENDED','DISABLED')),
  password_hash TEXT NOT NULL,
  mfa_required  INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS programmes (
  id              TEXT PRIMARY KEY,
  institution_id  TEXT NOT NULL REFERENCES institutions(id),
  programme_code  TEXT NOT NULL,
  programme_name  TEXT NOT NULL,
  programme_level TEXT NOT NULL,
  approval_status TEXT NOT NULL DEFAULT 'ACTIVE',
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL,
  UNIQUE (institution_id, programme_code),
  UNIQUE (id, institution_id)
);

CREATE TABLE IF NOT EXISTS intake_approvals (
  id                 TEXT PRIMARY KEY,
  programme_id       TEXT NOT NULL REFERENCES programmes(id),
  academic_year      TEXT NOT NULL,
  approval_reference TEXT NOT NULL,
  approved_intake    INTEGER NOT NULL CHECK (approved_intake >= 0),
  supernumerary_rules TEXT,
  category_rules     TEXT,
  effective_from     TEXT NOT NULL,
  effective_to       TEXT,
  rule_version       INTEGER NOT NULL CHECK (rule_version > 0),
  status             TEXT NOT NULL CHECK (status IN ('DRAFT','ACTIVE','SUPERSEDED','EXPIRED')),
  created_by         TEXT REFERENCES institution_users(id),
  created_at         TEXT NOT NULL,
  CHECK (effective_to IS NULL OR effective_to >= effective_from),
  UNIQUE (programme_id, academic_year, rule_version)
);

CREATE TABLE IF NOT EXISTS students (
  id                 TEXT PRIMARY KEY,
  apaar_id_ciphertext TEXT,
  apaar_token        TEXT,
  apaar_token_key_id TEXT,
  full_name          TEXT NOT NULL,
  date_of_birth      TEXT,
  identity_status    TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (identity_status IN ('PENDING','VERIFIED','INVALID','UNVERIFIED','MISMATCH','UNAVAILABLE','ERROR')),
  created_at         TEXT NOT NULL,
  updated_at         TEXT NOT NULL,
  version            INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  CHECK ((apaar_token IS NULL) = (apaar_token_key_id IS NULL))
);

CREATE TABLE IF NOT EXISTS import_batches (
  id                 TEXT PRIMARY KEY,
  institution_id     TEXT NOT NULL REFERENCES institutions(id),
  programme_id       TEXT NOT NULL REFERENCES programmes(id),
  intake_approval_id TEXT REFERENCES intake_approvals(id),
  academic_year      TEXT NOT NULL,
  created_by         TEXT NOT NULL REFERENCES institution_users(id),
  original_name      TEXT NOT NULL,
  file_object_key    TEXT NOT NULL,
  file_sha256        TEXT NOT NULL,
  idempotency_key    TEXT NOT NULL,
  status             TEXT NOT NULL CHECK (status IN
    ('DRAFT','UPLOADED','VALIDATING','NEEDS_CORRECTION','READY_FOR_REVIEW','APPROVED','COMMITTED','REJECTED','CANCELLED','SUPERSEDED')),
  rule_version       INTEGER NOT NULL DEFAULT 1,
  ruleset            TEXT NOT NULL DEFAULT 'AVIP-RULES-1.0.0',
  counts             TEXT NOT NULL DEFAULT '{}',
  created_at         TEXT NOT NULL,
  updated_at         TEXT NOT NULL,
  version            INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  UNIQUE (created_by, idempotency_key)
);

CREATE TABLE IF NOT EXISTS import_rows (
  id                 TEXT PRIMARY KEY,
  batch_id           TEXT NOT NULL REFERENCES import_batches(id),
  source_row_number  INTEGER NOT NULL CHECK (source_row_number > 0),
  normalized_payload TEXT NOT NULL,
  status             TEXT NOT NULL CHECK (status IN ('PENDING','VALID','ERROR','REVIEW','COMMITTED')),
  error_summary      TEXT NOT NULL DEFAULT '[]',
  created_at         TEXT NOT NULL,
  UNIQUE (batch_id, source_row_number)
);

CREATE TABLE IF NOT EXISTS enrolments (
  id                     TEXT PRIMARY KEY,
  student_id             TEXT NOT NULL REFERENCES students(id),
  institution_id         TEXT NOT NULL REFERENCES institutions(id),
  programme_id           TEXT NOT NULL,
  academic_year          TEXT NOT NULL,
  roll_number            TEXT,
  admission_date         TEXT,
  enrolment_status       TEXT NOT NULL DEFAULT 'ACTIVE'
    CHECK (enrolment_status IN ('ACTIVE','TRANSFERRED','WITHDRAWN','COMPLETED','CANCELLED')),
  seat_type              TEXT NOT NULL CHECK (seat_type IN ('REGULAR','SUPERNUMERARY','OTHER')),
  admission_category     TEXT,
  nri_status             TEXT NOT NULL DEFAULT 'NOT_APPLICABLE',
  oci_status             TEXT NOT NULL DEFAULT 'NOT_APPLICABLE',
  foreign_national_status TEXT NOT NULL DEFAULT 'NOT_APPLICABLE',
  intake_approval_id     TEXT REFERENCES intake_approvals(id),
  source_import_row_id   TEXT REFERENCES import_rows(id),
  created_at             TEXT NOT NULL,
  updated_at             TEXT NOT NULL,
  version                INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  FOREIGN KEY (programme_id, institution_id) REFERENCES programmes(id, institution_id)
);

CREATE TABLE IF NOT EXISTS identity_checks (
  id                 TEXT PRIMARY KEY,
  student_id         TEXT REFERENCES students(id),
  enrolment_id       TEXT REFERENCES enrolments(id),
  provider_code      TEXT NOT NULL,
  status             TEXT NOT NULL CHECK (status IN ('VERIFIED','INVALID','MISMATCH','PENDING','UNAVAILABLE','ERROR')),
  provider_reference TEXT,
  checked_at         TEXT NOT NULL,
  reason_code        TEXT,
  response_digest    TEXT,
  created_at         TEXT NOT NULL,
  CHECK (student_id IS NOT NULL OR enrolment_id IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS validation_issues (
  id                TEXT PRIMARY KEY,
  batch_id          TEXT NOT NULL REFERENCES import_batches(id),
  import_row_id     TEXT REFERENCES import_rows(id),
  enrolment_id      TEXT REFERENCES enrolments(id),
  rule_code         TEXT NOT NULL,
  severity          TEXT NOT NULL CHECK (severity IN ('ERROR','WARNING','REVIEW','INFO')),
  field_name        TEXT,
  message           TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','RESOLVED','ACCEPTED_EXCEPTION','CLOSED')),
  resolved_by       TEXT REFERENCES institution_users(id),
  resolved_at       TEXT,
  resolution_reason TEXT,
  created_at        TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS conflict_cases (
  id               TEXT PRIMARY KEY,
  case_code        TEXT NOT NULL UNIQUE,
  case_type        TEXT NOT NULL,
  status           TEXT NOT NULL CHECK (status IN ('OPEN','ASSIGNED','NEEDS_INFO','RESOLVED','FALSE_POSITIVE','ESCALATED')),
  priority         TEXT NOT NULL CHECK (priority IN ('LOW','MEDIUM','HIGH')),
  assigned_to      TEXT REFERENCES institution_users(id),
  reason_codes     TEXT NOT NULL DEFAULT '[]',
  resolution_code  TEXT,
  resolution_notes TEXT,
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL,
  version          INTEGER NOT NULL DEFAULT 1 CHECK (version > 0)
);

CREATE TABLE IF NOT EXISTS conflict_case_items (
  id           TEXT PRIMARY KEY,
  case_id      TEXT NOT NULL REFERENCES conflict_cases(id),
  enrolment_id TEXT NOT NULL REFERENCES enrolments(id),
  relationship TEXT NOT NULL DEFAULT 'CANDIDATE',
  UNIQUE (case_id, enrolment_id)
);

CREATE TABLE IF NOT EXISTS audit_events (
  seq                 BIGSERIAL UNIQUE,
  id                  TEXT PRIMARY KEY,
  occurred_at         TEXT NOT NULL,
  actor_type          TEXT NOT NULL,
  actor_id            TEXT,
  actor_label         TEXT,
  institution_id      TEXT,
  action              TEXT NOT NULL,
  entity_type         TEXT NOT NULL,
  entity_id           TEXT,
  entity_version      INTEGER,
  reason_code         TEXT,
  before_digest       TEXT,
  after_digest        TEXT,
  previous_event_hash TEXT,
  event_hash          TEXT NOT NULL,
  correlation_id      TEXT,
  metadata            TEXT
);

CREATE TABLE IF NOT EXISTS outbox_events (
  id             TEXT PRIMARY KEY,
  aggregate_type TEXT NOT NULL,
  aggregate_id   TEXT NOT NULL,
  event_type     TEXT NOT NULL,
  payload        TEXT NOT NULL,
  created_at     TEXT NOT NULL,
  published_at   TEXT,
  attempts       INTEGER NOT NULL DEFAULT 0,
  status         TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','PUBLISHED','FAILED'))
);

CREATE TABLE IF NOT EXISTS api_clients (
  id                  TEXT PRIMARY KEY,
  owner_institution_id TEXT REFERENCES institutions(id),
  client_name         TEXT NOT NULL,
  secret_hash         TEXT NOT NULL,
  scopes              TEXT NOT NULL,
  status              TEXT NOT NULL DEFAULT 'ACTIVE',
  last_used_at        TEXT,
  expires_at          TEXT,
  created_at          TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES institution_users(id),
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_programme_institution ON programmes (institution_id);
CREATE INDEX IF NOT EXISTS idx_intake_lookup ON intake_approvals (programme_id, academic_year, status, effective_from);
CREATE INDEX IF NOT EXISTS idx_student_token ON students (apaar_token);
CREATE INDEX IF NOT EXISTS idx_enrolment_institution ON enrolments (institution_id, academic_year, enrolment_status);
CREATE INDEX IF NOT EXISTS idx_enrolment_programme ON enrolments (programme_id, academic_year, enrolment_status);
CREATE INDEX IF NOT EXISTS idx_enrolment_student ON enrolments (student_id, academic_year);
CREATE INDEX IF NOT EXISTS idx_batch_history ON import_batches (institution_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_issue_queue ON validation_issues (batch_id, severity, status);
CREATE INDEX IF NOT EXISTS idx_conflict_queue ON conflict_cases (status, priority, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_case_item_enrolment ON conflict_case_items (enrolment_id);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_events (entity_type, entity_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_events (actor_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_institution ON audit_events (institution_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_outbox_pending ON outbox_events (status, created_at);

-- The app connects as the Postgres table owner, which bypasses RLS. Enabling RLS
-- with no policies blocks accidental reads through Supabase's public Data API.
ALTER TABLE institutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE institution_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE programmes ENABLE ROW LEVEL SECURITY;
ALTER TABLE intake_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_rows ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrolments ENABLE ROW LEVEL SECURITY;
ALTER TABLE identity_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE validation_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE conflict_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE conflict_case_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE outbox_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
