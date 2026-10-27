const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

function loadEnvFile(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const index = trimmed.indexOf('=');
    if (index === -1) continue;
    const key = trimmed.slice(0, index).trim();
    if (!key || process.env[key] !== undefined) continue;
    let value = trimmed.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

loadEnvFile(path.join(ROOT, '.env'));

const DATA_DIR = process.env.AVIP_DATA_DIR || path.join(ROOT, 'data');
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
const DATABASE_URL = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL || '';
const DB_SCHEMA_FILE = process.env.AVIP_SCHEMA || path.join(__dirname, 'schema.sql');
const DB_SSL = process.env.DB_SSL !== undefined
  ? !['0', 'false', 'no', 'disable'].includes(String(process.env.DB_SSL).toLowerCase())
  : !/^postgres(ql)?:\/\/[^/]*@(localhost|127\.0\.0\.1)/i.test(DATABASE_URL);
const SEED_ENABLED = process.env.AVIP_SEED !== '0';
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '127.0.0.1';

const RULESET = 'AVIP-RULES-1.0.0';
const RULE_VERSION = 1;
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const DEMO_PASSWORD = 'Demo@1234';
const DEMO_MFA_CODE = '246810';
const APAAR_DEMO_PATTERN = /^[0-9]{12}$/;
const CURRENT_YEAR = '2026-27';
const ACADEMIC_YEARS = ['2024-25', '2025-26', '2026-27', '2027-28'];

const ROLES = ['AICTE_ADMIN', 'INSTITUTION_ADMIN', 'SUBMITTER', 'VERIFIER', 'AUDITOR', 'OPERATOR'];
const ROLE_LABELS = {
  AICTE_ADMIN: 'AICTE Administrator',
  INSTITUTION_ADMIN: 'Institution Administrator',
  SUBMITTER: 'Institution Data Submitter',
  VERIFIER: 'Verification Officer',
  AUDITOR: 'Auditor (read-only)',
  OPERATOR: 'System Operator'
};

const CAPABILITIES = {
  AICTE_ADMIN: ['institution:manage', 'programme:manage', 'intake:manage', 'import:submit', 'import:approve', 'import:commit', 'student:view', 'enrolment:correct', 'identity:verify', 'conflict:view', 'conflict:review', 'report:view', 'audit:view', 'audit:verify'],
  INSTITUTION_ADMIN: ['programme:manage', 'import:submit', 'student:view', 'enrolment:correct', 'identity:verify', 'conflict:view', 'report:view', 'audit:view'],
  SUBMITTER: ['import:submit', 'student:view', 'report:view'],
  VERIFIER: ['student:view', 'identity:verify', 'conflict:view', 'conflict:review', 'report:view', 'audit:view'],
  AUDITOR: ['student:view', 'conflict:view', 'report:view', 'audit:view', 'audit:verify'],
  OPERATOR: ['report:view', 'health:view', 'audit:verify']
};

const SEAT_TYPES = ['REGULAR', 'SUPERNUMERARY', 'OTHER'];
const CATEGORIES = ['GENERAL', 'OBC', 'SC', 'ST', 'EWS'];
const ENROLMENT_STATUSES = ['ACTIVE', 'TRANSFERRED', 'WITHDRAWN', 'COMPLETED', 'CANCELLED'];
const BATCH_STATUSES = ['DRAFT', 'UPLOADED', 'VALIDATING', 'NEEDS_CORRECTION', 'READY_FOR_REVIEW', 'APPROVED', 'COMMITTED', 'REJECTED', 'CANCELLED', 'SUPERSEDED'];
const IDENTITY_STATUSES = ['PENDING', 'VERIFIED', 'INVALID', 'UNVERIFIED', 'MISMATCH', 'UNAVAILABLE', 'ERROR'];
const CONFLICT_RESOLUTIONS = ['DUPLICATE_CONFIRMED', 'LEGITIMATE_TRANSFER', 'FALSE_POSITIVE', 'UNRESOLVED', 'ESCALATED'];
const TRI_STATE = ['YES', 'NO', 'NOT_APPLICABLE'];

const CSV_HEADERS = [
  'apaar_id',
  'full_name',
  'date_of_birth',
  'programme_code',
  'academic_year',
  'roll_number',
  'admission_date',
  'seat_type',
  'admission_category',
  'nri_status',
  'oci_status',
  'foreign_national_status'
];

module.exports = {
  ROOT, DATA_DIR, UPLOAD_DIR, DATABASE_URL, DB_SCHEMA_FILE, DB_SSL, SEED_ENABLED,
  PORT, HOST, RULESET, RULE_VERSION, SESSION_TTL_MS, MAX_UPLOAD_BYTES,
  DEMO_PASSWORD, DEMO_MFA_CODE, APAAR_DEMO_PATTERN, CURRENT_YEAR, ACADEMIC_YEARS,
  ROLES, ROLE_LABELS, CAPABILITIES, SEAT_TYPES, CATEGORIES, ENROLMENT_STATUSES,
  BATCH_STATUSES, IDENTITY_STATUSES, CONFLICT_RESOLUTIONS, TRI_STATE, CSV_HEADERS
};
