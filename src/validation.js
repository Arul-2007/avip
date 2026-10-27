const {
  APAAR_DEMO_PATTERN, CATEGORIES, SEAT_TYPES, TRI_STATE, CSV_HEADERS, RULESET, RULE_VERSION
} = require('./config');
const {
  uuid, nowIso, apaarToken, encryptApaar, maskApaar, normalizeApaar
} = require('./security');
const { auditFor } = require('./audit');

const REQUIRED_HEADERS = ['apaar_id', 'full_name', 'date_of_birth', 'programme_code', 'academic_year',
  'roll_number', 'admission_date', 'seat_type', 'admission_category'];

function parseCsv(text) {
  const input = String(text ?? '').replace(/^\uFEFF/, '');
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    if (inQuotes) {
      if (char === '"') {
        if (input[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (char !== '\r') {
      field += char;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((entry) => entry.some((value) => String(value).trim() !== ''));
}

function csvEscape(value) {
  const text = String(value ?? '');
  if (/[",\n\r]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

function buildTemplate() {
  const lines = [CSV_HEADERS.join(',')];
  lines.push([
    '900000000001', 'Sample Student One', '2006-01-15', 'CSE-UG', '2026-27',
    'SIT-CSE-101', '2026-07-20', 'REGULAR', 'GENERAL', 'NO', 'NO', 'NO'
  ].map(csvEscape).join(','));
  lines.push([
    '900000000002', 'Sample Student Two', '2005-08-04', 'CSE-UG', '2026-27',
    'SIT-CSE-102', '2026-07-21', 'REGULAR', 'OBC', 'NO', 'NO', 'NO'
  ].map(csvEscape).join(','));
  return `${lines.join('\n')}\n`;
}

function isIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function looksLikeYear(value) {
  return /^\d{4}-\d{2}$/.test(String(value || ''));
}

function makeIssue(ruleCode, severity, fieldName, message) {
  return { rule_code: ruleCode, severity, field_name: fieldName, message };
}

async function validateAndStage(db, { batch, user, csvText, correlationId }) {
  const parsed = parseCsv(csvText);
  if (parsed.length === 0) {
    throw new (require('./errors').HttpError)(400, 'EMPTY_FILE', 'The uploaded file contains no rows.');
  }
  const headers = parsed[0].map((header) => String(header).trim().toLowerCase());
  const missing = REQUIRED_HEADERS.filter((header) => !headers.includes(header));
  const now = nowIso();
  const insertRow = db.prepare(`INSERT INTO import_rows
    (id, batch_id, source_row_number, normalized_payload, status, error_summary, created_at)
    VALUES (?,?,?,?,?,?,?)`);
  const insertIssue = db.prepare(`INSERT INTO validation_issues
    (id, batch_id, import_row_id, rule_code, severity, field_name, message, status, created_at)
    VALUES (?,?,?,?,?,?,?,'OPEN',?)`);

  if (missing.length > 0) {
    await insertIssue.run(uuid(), batch.id, null, 'E_TEMPLATE_HEADERS', 'ERROR', null,
      `Missing required template columns: ${missing.join(', ')}. Download the current template and try again.`, now);
    await db.prepare(`UPDATE import_batches SET status='NEEDS_CORRECTION', counts=?, updated_at=?, version=version+1 WHERE id=?`)
      .run(JSON.stringify({ total: 0, valid: 0, error: 1, review: 0, warning: 0, committed: 0 }), now, batch.id);
    await auditFor(db, user, {
      action: 'BATCH_VALIDATED', entityType: 'import_batch', entityId: batch.id,
      institutionId: batch.institution_id, correlationId,
      metadata: { status: 'NEEDS_CORRECTION', reason: 'TEMPLATE_HEADERS' }
    });
    return { status: 'NEEDS_CORRECTION', missingHeaders: missing };
  }

  const programme = await db.prepare(`SELECT p.*, i.legal_name AS institution_name
    FROM programmes p JOIN institutions i ON i.id = p.institution_id WHERE p.id = ?`).get(batch.programme_id);
  const approval = await db.prepare('SELECT * FROM intake_approvals WHERE id = ?').get(batch.intake_approval_id);

  const seenTokens = new Map();
  const seenRolls = new Map();
  const prepared = [];
  let errorCount = 0;
  let reviewCount = 0;
  let validCount = 0;

  for (let index = 1; index < parsed.length; index += 1) {
    const sourceRowNumber = index + 1;
    const values = parsed[index];
    const record = {};
    for (let column = 0; column < headers.length; column += 1) {
      record[headers[column]] = String(values[column] ?? '').trim();
    }
    const issues = [];
    const apaarRaw = normalizeApaar(record.apaar_id);
    const fullName = record.full_name || '';
    const dob = record.date_of_birth || '';
    const programmeCode = record.programme_code || '';
    const academicYear = record.academic_year || '';
    const rollNumber = record.roll_number || '';
    const admissionDate = record.admission_date || '';
    const seatType = (record.seat_type || '').toUpperCase();
    const category = (record.admission_category || '').toUpperCase();
    const triState = (value) => {
      const normalized = String(value || 'NO').toUpperCase();
      return TRI_STATE.includes(normalized) ? normalized : 'NOT_APPLICABLE';
    };

    if (!apaarRaw) {
      issues.push(makeIssue('E_APAAR_REQUIRED', 'ERROR', 'apaar_id', 'APAAR identifier is required.'));
    } else if (!APAAR_DEMO_PATTERN.test(apaarRaw)) {
      issues.push(makeIssue('E_APAAR_FORMAT', 'ERROR', 'apaar_id',
        'APAAR identifier must be a 12-digit synthetic identifier in this prototype.'));
    }
    if (!fullName) issues.push(makeIssue('E_NAME_REQUIRED', 'ERROR', 'full_name', 'Student full name is required.'));
    if (!isIsoDate(dob)) {
      issues.push(makeIssue('E_DOB_INVALID', 'ERROR', 'date_of_birth', 'Date of birth must use YYYY-MM-DD and be a real date.'));
    } else if (new Date(`${dob}T00:00:00Z`) > new Date()) {
      issues.push(makeIssue('E_DOB_INVALID', 'ERROR', 'date_of_birth', 'Date of birth cannot be in the future.'));
    }
    if (!programmeCode) {
      issues.push(makeIssue('E_PROGRAMME_REQUIRED', 'ERROR', 'programme_code', 'Programme code is required.'));
    } else if (programme && programmeCode !== programme.programme_code) {
      issues.push(makeIssue('E_PROGRAMME_MISMATCH', 'ERROR', 'programme_code',
        `Row programme must match the batch programme (${programme.programme_code}).`));
    }
    if (!academicYear) {
      issues.push(makeIssue('E_YEAR_REQUIRED', 'ERROR', 'academic_year', 'Academic year is required.'));
    } else if (!looksLikeYear(academicYear)) {
      issues.push(makeIssue('E_YEAR_INVALID', 'ERROR', 'academic_year', 'Academic year must use the format YYYY-YY.'));
    } else if (academicYear !== batch.academic_year) {
      issues.push(makeIssue('E_YEAR_MISMATCH', 'ERROR', 'academic_year',
        `Row academic year must match the batch academic year (${batch.academic_year}).`));
    }
    if (!rollNumber) {
      issues.push(makeIssue('E_ROLL_REQUIRED', 'ERROR', 'roll_number', 'Roll number is required for this institution and programme.'));
    } else if (seenRolls.has(rollNumber.toUpperCase())) {
      issues.push(makeIssue('E_ROLL_DUPLICATE_BATCH', 'ERROR', 'roll_number',
        `Roll number duplicates source row ${seenRolls.get(rollNumber.toUpperCase())} in this batch.`));
    }
    if (!isIsoDate(admissionDate)) {
      issues.push(makeIssue('E_ADMISSION_DATE_INVALID', 'ERROR', 'admission_date', 'Admission date must use YYYY-MM-DD and be a real date.'));
    }
    if (!SEAT_TYPES.includes(seatType)) {
      issues.push(makeIssue('E_SEAT_TYPE_INVALID', 'ERROR', 'seat_type', `Seat type must be one of ${SEAT_TYPES.join(', ')}.`));
    }
    if (!CATEGORIES.includes(category)) {
      issues.push(makeIssue('E_CATEGORY_INVALID', 'ERROR', 'admission_category', `Category must be one of ${CATEGORIES.join(', ')}.`));
    }
    for (const [field, key] of [['nri_status', 'nri_status'], ['oci_status', 'oci_status'], ['foreign_national_status', 'foreign_national_status']]) {
      if (record[field] && !TRI_STATE.includes(record[field].toUpperCase())) {
        issues.push(makeIssue('E_TRI_STATE_INVALID', 'ERROR', field, `${field.replaceAll('_', ' ')} must be YES, NO or NOT_APPLICABLE.`));
      }
    }

    const token = apaarRaw && APAAR_DEMO_PATTERN.test(apaarRaw) ? apaarToken(apaarRaw) : null;
    if (token && seenTokens.has(token)) {
      issues.push(makeIssue('E_DUPLICATE_IN_BATCH', 'ERROR', 'apaar_id',
        `Identity reference duplicates source row ${seenTokens.get(token)} in this batch.`));
    }
    if (token && rollNumber) {
      const existing = await db.prepare(`SELECT e.id, e.institution_id, p.programme_code
        FROM enrolments e JOIN students s ON s.id = e.student_id
        JOIN programmes p ON p.id = e.programme_id
        WHERE s.apaar_token = ? AND e.academic_year = ? AND e.programme_id = ?
          AND e.enrolment_status IN ('ACTIVE','TRANSFERRED') LIMIT 1`)
        .get(token, batch.academic_year, batch.programme_id);
      if (existing) {
        issues.push(makeIssue('E_DUPLICATE_ENROLMENT', 'ERROR', 'apaar_id',
          `An active enrolment already exists for this protected identity in ${programmeCode} ${batch.academic_year}.`));
      }
      const cross = await db.prepare(`SELECT e.id, e.institution_id, i.legal_name
        FROM enrolments e JOIN students s ON s.id = e.student_id
        JOIN institutions i ON i.id = e.institution_id
        WHERE s.apaar_token = ? AND e.institution_id <> ? AND e.academic_year = ?
          AND e.enrolment_status IN ('ACTIVE','TRANSFERRED') LIMIT 1`)
        .get(token, batch.institution_id, batch.academic_year);
      if (cross) {
        issues.push(makeIssue('R_CROSS_INSTITUTION', 'REVIEW', 'apaar_id',
          'A potential cross-institution match exists for the same academic year. This is a review flag, not a fraud finding.'));
      }
    }
    if (apaarRaw && APAAR_DEMO_PATTERN.test(apaarRaw)) {
      const student = await db.prepare('SELECT identity_status FROM students WHERE apaar_token = ? LIMIT 1').get(token);
      if (student && ['INVALID', 'MISMATCH'].includes(student.identity_status)) {
        issues.push(makeIssue('R_PRIOR_IDENTITY_ISSUE', 'REVIEW', 'apaar_id',
          `A prior identity check returned ${student.identity_status}. Keep format validation separate from provider verification.`));
      }
    }

    const hasError = issues.some((issue) => issue.severity === 'ERROR');
    const hasReview = issues.some((issue) => issue.severity === 'REVIEW');
    const rowStatus = hasError ? 'ERROR' : hasReview ? 'REVIEW' : 'VALID';
    if (hasError) errorCount += 1;
    else if (hasReview) reviewCount += 1;
    else validCount += 1;
    if (token) seenTokens.set(token, sourceRowNumber);
    if (rollNumber) seenRolls.set(rollNumber.toUpperCase(), sourceRowNumber);

    const payload = {
      apaar_id_ciphertext: apaarRaw && APAAR_DEMO_PATTERN.test(apaarRaw) ? encryptApaar(apaarRaw) : null,
      apaar_token: token,
      full_name: fullName,
      date_of_birth: dob,
      programme_code: programmeCode,
      academic_year: academicYear,
      roll_number: rollNumber,
      admission_date: admissionDate,
      seat_type: seatType,
      admission_category: category,
      nri_status: triState(record.nri_status),
      oci_status: triState(record.oci_status),
      foreign_national_status: triState(record.foreign_national_status)
    };
    prepared.push({ sourceRowNumber, payload, issues, rowStatus });
  }

  if (prepared.length === 0) {
    await insertIssue.run(uuid(), batch.id, null, 'E_NO_DATA_ROWS', 'ERROR', null,
      'The file has a header but no data rows. Add at least one student row.', now);
    await db.prepare(`UPDATE import_batches SET status='NEEDS_CORRECTION', counts=?, updated_at=?, version=version+1 WHERE id=?`)
      .run(JSON.stringify({ total: 0, valid: 0, error: 1, review: 0, warning: 0, committed: 0 }), now, batch.id);
    return { status: 'NEEDS_CORRECTION' };
  }

  const capacityWarnings = await buildCapacityWarnings(db, batch, approval, prepared);

  let warningCount = 0;
  for (const row of prepared) {
    if (capacityWarnings.length > 0 && row.rowStatus === 'VALID') {
      for (const warning of capacityWarnings) row.issues.push(warning);
    }
    warningCount += row.issues.filter((issue) => issue.severity === 'WARNING').length;
    const rowId = uuid();
    await insertRow.run(rowId, batch.id, row.sourceRowNumber, JSON.stringify(row.payload), row.rowStatus,
      JSON.stringify(row.issues.map((issue) => ({ rule_code: issue.rule_code, field: issue.field_name, severity: issue.severity }))), now);
    for (const issue of row.issues) {
      await insertIssue.run(uuid(), batch.id, rowId, issue.rule_code, issue.severity, issue.field_name, issue.message, now);
    }
  }

  const counts = {
    total: prepared.length,
    valid: validCount,
    error: errorCount,
    review: reviewCount,
    warning: warningCount,
    committed: 0
  };
  const status = errorCount > 0 ? 'NEEDS_CORRECTION' : 'READY_FOR_REVIEW';
  await db.prepare(`UPDATE import_batches SET status=?, counts=?, ruleset=?, rule_version=?, updated_at=?, version=version+1 WHERE id=?`)
    .run(status, JSON.stringify(counts), RULESET, RULE_VERSION, now, batch.id);
  await auditFor(db, user, {
    action: 'BATCH_VALIDATED', entityType: 'import_batch', entityId: batch.id,
    institutionId: batch.institution_id, correlationId,
    metadata: { status, counts }
  });
  return { status, counts };
}

async function buildCapacityWarnings(db, batch, approval, prepared) {
  if (!approval) return [];
  const counted = (await db.prepare(`SELECT COUNT(*) AS count FROM enrolments
    WHERE programme_id = ? AND academic_year = ? AND enrolment_status = 'ACTIVE' AND seat_type = 'REGULAR'`)
    .get(batch.programme_id, batch.academic_year)).count;
  const incoming = prepared.filter((row) => row.rowStatus === 'VALID' && row.payload.seat_type === 'REGULAR').length;
  const warnings = [];
  if (counted + incoming > approval.approved_intake) {
    warnings.push(makeIssue('W_INTAKE_PROJECTED_OVERAGE', 'WARNING', null,
      `Projected counted enrolment ${counted + incoming} exceeds approved intake ${approval.approved_intake} for rule version ${approval.rule_version}. Commit remains a human decision.`));
  }
  const categoryRules = safeJson(approval.category_rules, {});
  for (const [category, cap] of Object.entries(categoryRules)) {
    if (!Number.isFinite(Number(cap))) continue;
    const existing = (await db.prepare(`SELECT COUNT(*) AS count FROM enrolments
      WHERE programme_id = ? AND academic_year = ? AND admission_category = ?
        AND enrolment_status = 'ACTIVE' AND seat_type = 'REGULAR'`)
      .get(batch.programme_id, batch.academic_year, category)).count;
    const projected = prepared.filter((row) => row.rowStatus === 'VALID' && row.payload.admission_category === category).length;
    if (existing + projected > Number(cap)) {
      warnings.push(makeIssue('W_CATEGORY_PROJECTED_OVERAGE', 'WARNING', 'admission_category',
        `Projected ${category} count ${existing + projected} exceeds the category cap ${cap} in rule version ${approval.rule_version}.`));
      break;
    }
  }
  return warnings;
}

function safeJson(value, fallback) {
  if (!value) return fallback;
  try {
    return typeof value === 'string' ? JSON.parse(value) : value;
  } catch {
    return fallback;
  }
}

function publicRow(row) {
  const payload = safeJson(row.normalized_payload, {});
  return {
    id: row.id,
    source_row_number: row.source_row_number,
    status: row.status,
    full_name: payload.full_name || null,
    apaar_masked: payload.apaar_id_ciphertext ? maskApaar(payload.apaar_id_ciphertext) : 'Not captured',
    programme_code: payload.programme_code || null,
    academic_year: payload.academic_year || null,
    roll_number: payload.roll_number || null,
    admission_date: payload.admission_date || null,
    seat_type: payload.seat_type || null,
    admission_category: payload.admission_category || null,
    issues: safeJson(row.error_summary, [])
  };
}

module.exports = { parseCsv, csvEscape, buildTemplate, validateAndStage, publicRow, safeJson, isIsoDate };
