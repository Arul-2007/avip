const {
  DEMO_PASSWORD, RULESET, RULE_VERSION
} = require('./config');
const {
  uuid, hashPassword, apaarToken, encryptApaar, sha256
} = require('./security');
const { appendAudit, enqueueOutbox } = require('./audit');

function daysAgo(days, hour = 9) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  date.setUTCHours(hour, 0, 0, 0);
  return date.toISOString();
}

function rowPayload(raw, name, dob, code, year, roll, admission, seat, category) {
  return {
    apaar_id_ciphertext: encryptApaar(raw),
    apaar_token: apaarToken(raw),
    full_name: name,
    date_of_birth: dob,
    programme_code: code,
    academic_year: year,
    roll_number: roll,
    admission_date: admission,
    seat_type: seat,
    admission_category: category,
    nri_status: 'NO',
    oci_status: 'NO',
    foreign_national_status: 'NO'
  };
}

async function seedDatabase(db) {
  const existing = await db.prepare('SELECT COUNT(*) AS count FROM institutions').get();
  if (existing.count > 0) return false;

  const passwordHash = hashPassword(DEMO_PASSWORD);
  const createdAt = daysAgo(40);
  const year = '2026-27';

  const institutions = {
    A: { id: uuid(), code: 'SIT-001', name: 'Sunrise Institute of Technology', state: 'KA', status: 'ACTIVE' },
    B: { id: uuid(), code: 'NCE-002', name: 'Northern College of Engineering', state: 'DL', status: 'ACTIVE' },
    C: { id: uuid(), code: 'CASC-003', name: 'Coastal Arts and Science College', state: 'KL', status: 'PENDING' }
  };

  const users = {
    admin: { id: uuid(), email: 'admin@aicte.demo', name: 'AICTE Administrator', role: 'AICTE_ADMIN', institution: null, mfa: 1 },
    sitAdmin: { id: uuid(), email: 'registrar@sit.demo', name: 'Kavita Rao', role: 'INSTITUTION_ADMIN', institution: institutions.A.id, mfa: 0 },
    sitSubmitter: { id: uuid(), email: 'submitter@sit.demo', name: 'Vikram Shetty', role: 'SUBMITTER', institution: institutions.A.id, mfa: 0 },
    nceAdmin: { id: uuid(), email: 'registrar@nce.demo', name: 'Amit Malhotra', role: 'INSTITUTION_ADMIN', institution: institutions.B.id, mfa: 0 },
    verifier: { id: uuid(), email: 'verifier@aicte.demo', name: 'Neha Kulkarni', role: 'VERIFIER', institution: null, mfa: 0 },
    auditor: { id: uuid(), email: 'auditor@aicte.demo', name: 'Rahul Desai', role: 'AUDITOR', institution: null, mfa: 0 },
    operator: { id: uuid(), email: 'operator@aicte.demo', name: 'Sandeep Joshi', role: 'OPERATOR', institution: null, mfa: 0 }
  };

  const programmes = {
    sitCse: { id: uuid(), institution: institutions.A.id, code: 'CSE-UG', name: 'B.Tech Computer Science and Engineering', level: 'UG' },
    sitEce: { id: uuid(), institution: institutions.A.id, code: 'ECE-UG', name: 'B.Tech Electronics and Communication', level: 'UG' },
    nceCse: { id: uuid(), institution: institutions.B.id, code: 'CSE-UG', name: 'B.Tech Computer Science and Engineering', level: 'UG' },
    cascBa: { id: uuid(), institution: institutions.C.id, code: 'BA-ENG', name: 'B.A. English Literature', level: 'UG' }
  };

  const approvals = {
    sitCse: { id: uuid(), programme: programmes.sitCse.id, intake: 120 },
    sitEce: { id: uuid(), programme: programmes.sitEce.id, intake: 60 },
    nceCse: { id: uuid(), programme: programmes.nceCse.id, intake: 90 }
  };

  await db.transaction(async () => {
    const insertInstitution = db.prepare(`INSERT INTO institutions
      (id, institution_code, legal_name, approval_status, approval_reference, state_code, created_at, updated_at, version)
      VALUES (?,?,?,?,?,?,?,?,1)`);
    for (const inst of Object.values(institutions)) {
      await insertInstitution.run(inst.id, inst.code, inst.name, inst.status,
        inst.status === 'PENDING' ? null : `AICTE/APR/${inst.code}/2026`,
        inst.state, createdAt, createdAt);
    }

    const insertUser = db.prepare(`INSERT INTO institution_users
      (id, institution_id, email, display_name, role, status, password_hash, mfa_required, created_at, updated_at)
      VALUES (?,?,?,?,?,'ACTIVE',?,?,?,?)`);
    for (const user of Object.values(users)) {
      await insertUser.run(user.id, user.institution, user.email, user.name, user.role, passwordHash, user.mfa, createdAt, createdAt);
    }

    const insertProgramme = db.prepare(`INSERT INTO programmes
      (id, institution_id, programme_code, programme_name, programme_level, approval_status, created_at, updated_at)
      VALUES (?,?,?,?,?,'ACTIVE',?,?)`);
    for (const programme of Object.values(programmes)) {
      await insertProgramme.run(programme.id, programme.institution, programme.code, programme.name, programme.level, createdAt, createdAt);
    }

    const categoryRules = { GENERAL: 48, OBC: 32, SC: 18, ST: 9, EWS: 13 };
    const insertApproval = db.prepare(`INSERT INTO intake_approvals
      (id, programme_id, academic_year, approval_reference, approved_intake, supernumerary_rules, category_rules,
       effective_from, effective_to, rule_version, status, created_by, created_at)
      VALUES (?,?,?,?,?,?,?,?,?,1,'ACTIVE',?,?)`);
    await insertApproval.run(approvals.sitCse.id, approvals.sitCse.programme, year,
      'AICTE/INTAKE/SIT/CSE/2026-27', approvals.sitCse.intake,
      JSON.stringify({ allowed: 6, policy: 'Approved supernumerary allocation only' }),
      JSON.stringify(categoryRules), '2026-06-01', '2027-05-31', users.admin.id, createdAt);
    await insertApproval.run(approvals.sitEce.id, approvals.sitEce.programme, year,
      'AICTE/INTAKE/SIT/ECE/2026-27', approvals.sitEce.intake,
      JSON.stringify({ allowed: 3, policy: 'Approved supernumerary allocation only' }),
      JSON.stringify({ GENERAL: 30, OBC: 14, SC: 9, ST: 4, EWS: 3 }),
      '2026-06-01', '2027-05-31', users.admin.id, createdAt);
    await insertApproval.run(approvals.nceCse.id, approvals.nceCse.programme, year,
      'AICTE/INTAKE/NCE/CSE/2026-27', approvals.nceCse.intake,
      JSON.stringify({ allowed: 4, policy: 'Approved supernumerary allocation only' }),
      JSON.stringify({ GENERAL: 40, OBC: 22, SC: 13, ST: 6, EWS: 9 }),
      '2026-06-01', '2027-05-31', users.admin.id, createdAt);

    const students = {};
    const insertStudent = db.prepare(`INSERT INTO students
      (id, apaar_id_ciphertext, apaar_token, apaar_token_key_id, full_name, date_of_birth,
       identity_status, created_at, updated_at, version)
      VALUES (?,?,?,?,?,?,?,?,?,1)`);
    const insertEnrolment = db.prepare(`INSERT INTO enrolments
      (id, student_id, institution_id, programme_id, academic_year, roll_number, admission_date,
       enrolment_status, seat_type, admission_category, intake_approval_id, created_at, updated_at, version)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,1)`);
    const insertIdentity = db.prepare(`INSERT INTO identity_checks
      (id, student_id, enrolment_id, provider_code, status, provider_reference, checked_at, reason_code, response_digest, created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?)`);

    const enroll = async (key, raw, name, dob, programme, inst, roll, admission, status, seat, category, identityStatus) => {
      const studentId = uuid();
      const enrolmentId = uuid();
      const token = apaarToken(raw);
      await insertStudent.run(studentId, encryptApaar(raw), token, 'k1', name, dob, identityStatus, createdAt, createdAt);
      await insertEnrolment.run(enrolmentId, studentId, inst, programme.id, year, roll, admission, status, seat, category,
        programme === programmes.sitCse ? approvals.sitCse.id
          : programme === programmes.sitEce ? approvals.sitEce.id
            : approvals.nceCse.id, createdAt, createdAt);
      if (identityStatus !== 'PENDING' && identityStatus !== 'UNVERIFIED') {
        await insertIdentity.run(uuid(), studentId, enrolmentId, 'MOCK-AVIP', identityStatus,
          `MOCK-${roll}`, daysAgo(20), identityStatus === 'VERIFIED' ? null : 'SIMULATED_PROVIDER_RESULT',
          sha256(`mock:${roll}`), daysAgo(20));
      }
      students[key] = { id: studentId, enrolmentId, raw, name };
      return students[key];
    };

    await enroll('raviA', '910000000001', 'Ravi Kumar', '2005-04-12', programmes.sitCse, institutions.A.id, 'SIT-CSE-001', '2026-07-20', 'ACTIVE', 'REGULAR', 'GENERAL', 'VERIFIED');
    await enroll('ananyaA', '910000000002', 'Ananya Sharma', '2006-01-08', programmes.sitCse, institutions.A.id, 'SIT-CSE-002', '2026-07-21', 'ACTIVE', 'REGULAR', 'OBC', 'VERIFIED');
    await enroll('priyaA', '910000000004', 'Priya Nair', '2005-11-02', programmes.sitCse, institutions.A.id, 'SIT-CSE-003', '2026-07-22', 'ACTIVE', 'REGULAR', 'SC', 'PENDING');
    await enroll('arjunA', '910000000005', 'Arjun Reddy', '2005-03-19', programmes.sitCse, institutions.A.id, 'SIT-CSE-004', '2026-07-23', 'WITHDRAWN', 'REGULAR', 'OBC', 'VERIFIED');
    await enroll('irfanA', '910000000003', 'Mohammed Irfan', '2006-06-30', programmes.sitEce, institutions.A.id, 'SIT-ECE-001', '2026-07-24', 'ACTIVE', 'REGULAR', 'GENERAL', 'VERIFIED');
    await enroll('snehaA', '910000000006', 'Sneha Patil', '2005-09-14', programmes.sitEce, institutions.A.id, 'SIT-ECE-002', '2026-07-25', 'ACTIVE', 'REGULAR', 'SC', 'INVALID');
    await enroll('raviB', '910000000001', 'Ravi Kumar', '2005-04-12', programmes.nceCse, institutions.B.id, 'NCE-CSE-014', '2026-07-18', 'ACTIVE', 'REGULAR', 'GENERAL', 'VERIFIED');
    await enroll('kiranB', '910000000021', 'Kiran Rao', '2005-12-01', programmes.nceCse, institutions.B.id, 'NCE-CSE-015', '2026-07-19', 'ACTIVE', 'REGULAR', 'GENERAL', 'VERIFIED');
    await enroll('meeraB', '910000000022', 'Meera Iyer', '2006-02-22', programmes.nceCse, institutions.B.id, 'NCE-CSE-016', '2026-07-20', 'ACTIVE', 'REGULAR', 'OBC', 'PENDING');
    await enroll('rohitB', '910000000023', 'Rohit Verma', '2005-08-09', programmes.nceCse, institutions.B.id, 'NCE-CSE-017', '2026-07-21', 'ACTIVE', 'REGULAR', 'EWS', 'UNVERIFIED');

    const insertBatch = db.prepare(`INSERT INTO import_batches
      (id, institution_id, programme_id, intake_approval_id, academic_year, created_by, original_name,
       file_object_key, file_sha256, idempotency_key, status, rule_version, ruleset, counts, created_at, updated_at, version)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1)`);
    const insertRow = db.prepare(`INSERT INTO import_rows
      (id, batch_id, source_row_number, normalized_payload, status, error_summary, created_at)
      VALUES (?,?,?,?,?,?,?)`);
    const insertIssue = db.prepare(`INSERT INTO validation_issues
      (id, batch_id, import_row_id, rule_code, severity, field_name, message, status, created_at)
      VALUES (?,?,?,?,?,?,?,'OPEN',?)`);

    const committedBatchId = uuid();
    const committedDate = daysAgo(12);
    const committedCounts = { total: 4, valid: 4, error: 0, review: 0, warning: 0, committed: 4 };
    await insertBatch.run(committedBatchId, institutions.A.id, programmes.sitCse.id, approvals.sitCse.id, year,
      users.sitSubmitter.id, 'sit_cse_2026_batch01.csv',
      `seed/${committedBatchId}.csv`, sha256('seed-batch-01'), 'seed-batch-01',
      'COMMITTED', RULE_VERSION, RULESET, JSON.stringify(committedCounts), committedDate, committedDate);
    const committedRows = [
      ['raviA', '910000000001', 'Ravi Kumar', '2005-04-12', 'SIT-CSE-001', 'GENERAL'],
      ['ananyaA', '910000000002', 'Ananya Sharma', '2006-01-08', 'SIT-CSE-002', 'OBC'],
      ['priyaA', '910000000004', 'Priya Nair', '2005-11-02', 'SIT-CSE-003', 'SC'],
      ['arjunA', '910000000005', 'Arjun Reddy', '2005-03-19', 'SIT-CSE-004', 'OBC']
    ];
    for (let index = 0; index < committedRows.length; index += 1) {
      const entry = committedRows[index];
      await insertRow.run(uuid(), committedBatchId, index + 2,
        JSON.stringify(rowPayload(entry[1], entry[2], entry[3], 'CSE-UG', year, entry[4], '2026-07-20', 'REGULAR', entry[5])),
        'COMMITTED', '[]', committedDate);
    }

    const readyBatchId = uuid();
    const readyDate = daysAgo(2);
    const readyCounts = { total: 2, valid: 2, error: 0, review: 0, warning: 0, committed: 0 };
    await insertBatch.run(readyBatchId, institutions.B.id, programmes.nceCse.id, approvals.nceCse.id, year,
      users.nceAdmin.id, 'nce_cse_2026_batch02.csv',
      `seed/${readyBatchId}.csv`, sha256('seed-batch-02'), 'seed-batch-02',
      'READY_FOR_REVIEW', RULE_VERSION, RULESET, JSON.stringify(readyCounts), readyDate, readyDate);
    const readyRows = [
      ['Ritu Singh', '910000000031', '2006-03-15', 'NCE-CSE-018', 'GENERAL'],
      ['Karan Mehta', '910000000032', '2005-10-07', 'NCE-CSE-019', 'SC']
    ];
    for (let index = 0; index < readyRows.length; index += 1) {
      const entry = readyRows[index];
      await insertRow.run(uuid(), readyBatchId, index + 2,
        JSON.stringify(rowPayload(entry[1], entry[0], entry[2], 'CSE-UG', year, entry[3], '2026-07-22', 'REGULAR', entry[4])),
        'VALID', '[]', readyDate);
    }

    const correctionBatchId = uuid();
    const correctionDate = daysAgo(1);
    const correctionCounts = { total: 3, valid: 1, error: 2, review: 0, warning: 0, committed: 0 };
    await insertBatch.run(correctionBatchId, institutions.A.id, programmes.sitEce.id, approvals.sitEce.id, year,
      users.sitSubmitter.id, 'sit_ece_2026_intake.csv',
      `seed/${correctionBatchId}.csv`, sha256('seed-batch-03'), 'seed-batch-03',
      'NEEDS_CORRECTION', RULE_VERSION, RULESET, JSON.stringify(correctionCounts), correctionDate, correctionDate);
    const goodEce = rowPayload('910000000041', 'Aditya Kamath', '2006-05-11', 'ECE-UG', year, 'SIT-ECE-003', '2026-07-26', 'REGULAR', 'GENERAL');
    await insertRow.run(uuid(), correctionBatchId, 2, JSON.stringify(goodEce), 'VALID', '[]', correctionDate);
    const badEce = rowPayload('12345', 'Farah Khan', '2006-07-01', 'ECE-UG', year, 'SIT-ECE-004', '2026-07-26', 'REGULAR', 'OBC');
    const badRowId = uuid();
    await insertRow.run(badRowId, correctionBatchId, 3, JSON.stringify(badEce), 'ERROR',
      JSON.stringify([{ rule_code: 'E_APAAR_FORMAT', field: 'apaar_id' }]), correctionDate);
    await insertIssue.run(uuid(), correctionBatchId, badRowId, 'E_APAAR_FORMAT', 'ERROR', 'apaar_id',
      'APAAR identifier must be a 12-digit synthetic identifier in this prototype.', correctionDate);
    const missingRoll = rowPayload('910000000043', 'Nisha Verma', '2006-09-25', 'ECE-UG', year, '', '2026-07-26', 'REGULAR', 'ST');
    const missingRollId = uuid();
    await insertRow.run(missingRollId, correctionBatchId, 4, JSON.stringify(missingRoll), 'ERROR',
      JSON.stringify([{ rule_code: 'E_ROLL_REQUIRED', field: 'roll_number' }]), correctionDate);
    await insertIssue.run(uuid(), correctionBatchId, missingRollId, 'E_ROLL_REQUIRED', 'ERROR', 'roll_number',
      'Roll number is required for this institution and programme.', correctionDate);

    const caseId = uuid();
    await db.prepare(`INSERT INTO conflict_cases
      (id, case_code, case_type, status, priority, assigned_to, reason_codes, created_at, updated_at, version)
      VALUES (?,?,?,?,?,?,?,?,?,1)`).run(caseId, 'CC-2026-0001', 'CROSS_INSTITUTION', 'OPEN', 'HIGH', null,
      JSON.stringify(['CROSS_INSTITUTION', 'PERIOD_OVERLAP', 'SAME_ACADEMIC_YEAR']), daysAgo(2), daysAgo(2));
    await db.prepare('INSERT INTO conflict_case_items (id, case_id, enrolment_id, relationship) VALUES (?,?,?,?)')
      .run(uuid(), caseId, students.raviA.enrolmentId, 'PRIMARY');
    await db.prepare('INSERT INTO conflict_case_items (id, case_id, enrolment_id, relationship) VALUES (?,?,?,?)')
      .run(uuid(), caseId, students.raviB.enrolmentId, 'CANDIDATE');

    await enqueueOutbox(db, {
      aggregateType: 'import_batch',
      aggregateId: committedBatchId,
      eventType: 'BATCH_COMMITTED',
      payload: { batchId: committedBatchId, institutionId: institutions.A.id, committed: 4 }
    });

    const actor = { actorType: 'AICTE_ADMIN', actorId: users.admin.id, actorLabel: users.admin.name };
    await appendAudit(db, { ...actor, action: 'INSTITUTION_CREATED', entityType: 'institution', entityId: institutions.A.id, institutionId: institutions.A.id, occurredAt: createdAt });
    await appendAudit(db, { ...actor, action: 'INSTITUTION_CREATED', entityType: 'institution', entityId: institutions.B.id, institutionId: institutions.B.id, occurredAt: createdAt });
    await appendAudit(db, { ...actor, action: 'INSTITUTION_CREATED', entityType: 'institution', entityId: institutions.C.id, institutionId: institutions.C.id, occurredAt: createdAt });
    await appendAudit(db, { ...actor, action: 'INTAKE_APPROVAL_PUBLISHED', entityType: 'intake_approval', entityId: approvals.sitCse.id, institutionId: institutions.A.id, occurredAt: createdAt,
      metadata: { rule_version: 1, approved_intake: 120, academic_year: year } });
    await appendAudit(db, { ...actor, action: 'BATCH_COMMITTED', entityType: 'import_batch', entityId: committedBatchId, institutionId: institutions.A.id, occurredAt: committedDate,
      metadata: committedCounts });
    await appendAudit(db, { ...actor, actorType: 'SUBMITTER', actorId: users.sitSubmitter.id, actorLabel: users.sitSubmitter.name,
      action: 'BATCH_VALIDATED', entityType: 'import_batch', entityId: correctionBatchId, institutionId: institutions.A.id,
      occurredAt: correctionDate, metadata: correctionCounts });
    await appendAudit(db, { ...actor, action: 'CONFLICT_CASE_OPENED', entityType: 'conflict_case', entityId: caseId, institutionId: null,
      occurredAt: daysAgo(2), metadata: { case_type: 'CROSS_INSTITUTION', priority: 'HIGH' } });
    await appendAudit(db, { ...actor, actorType: 'INSTITUTION_ADMIN', actorId: users.sitAdmin.id, actorLabel: users.sitAdmin.name,
      action: 'ENROLMENT_STATUS_CHANGED', entityType: 'enrolment', entityId: students.arjunA.enrolmentId,
      institutionId: institutions.A.id, entityVersion: 2, reasonCode: 'STUDENT_WITHDRAWAL',
      occurredAt: daysAgo(5), metadata: { from: 'ACTIVE', to: 'WITHDRAWN' } });
  });
  return true;
}

module.exports = { seedDatabase };
