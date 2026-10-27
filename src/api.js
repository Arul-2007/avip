const fs = require('node:fs');
const path = require('node:path');
const {
  UPLOAD_DIR, ROLE_LABELS, RULESET, RULE_VERSION, CURRENT_YEAR, ACADEMIC_YEARS,
  ROLES, CAPABILITIES, SEAT_TYPES, CATEGORIES, ENROLMENT_STATUSES, BATCH_STATUSES,
  IDENTITY_STATUSES, CONFLICT_RESOLUTIONS, TRI_STATE, MAX_UPLOAD_BYTES
} = require('./config');
const {
  maskApaar, sha256, uuid, nowIso, keyId
} = require('./security');
const {
  publicUser, login, createSession, destroySession, getSessionUser,
  requireCapability, can, assertInstitutionScope, isReadOnly
} = require('./auth');
const {
  HttpError, badRequest, forbidden, notFound, conflict, unauthorized
} = require('./errors');
const { auditFor, enqueueOutbox, verifyAuditChain } = require('./audit');
const { validateAndStage, buildTemplate, publicRow, safeJson } = require('./validation');
const { mockVerify } = require('./identity');

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  });
  res.end(body);
}

function sendCsv(res, filename, content) {
  res.writeHead(200, {
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename="${filename}"`,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  });
  res.end(content);
}

function parseCookies(header) {
  const cookies = {};
  for (const part of String(header || '').split(';')) {
    const index = part.indexOf('=');
    if (index === -1) continue;
    const key = part.slice(0, index).trim();
    if (!key) continue;
    cookies[key] = decodeURIComponent(part.slice(index + 1).trim());
  }
  return cookies;
}

function paging(url) {
  const page = Math.max(1, Number(url.searchParams.get('page') || 1));
  const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get('pageSize') || 25)));
  return { page, pageSize, offset: (page - 1) * pageSize };
}

function normalizeYear(value) {
  const text = String(value || '').trim();
  if (!/^\d{4}-\d{2}$/.test(text)) throw badRequest('Academic year must use the format YYYY-YY.');
  const start = Number(text.slice(0, 4));
  if (Number(text.slice(5)) !== (start + 1) % 100) throw badRequest('Academic year range is invalid.');
  return text;
}

function isoOrNull(value) {
  if (!value) return null;
  const text = String(value).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) throw badRequest('Dates must use YYYY-MM-DD.');
  return text;
}

function defaultApprovalDates(year) {
  const start = Number(year.slice(0, 4));
  return { from: `${start}-06-01`, to: `${start + 1}-05-31` };
}

function parseMetadata(row) {
  return { ...row, metadata: safeJson(row.metadata, null) };
}

async function getEnrolmentAccess(db, user, enrolmentId) {
  const row = await db.prepare(`SELECT e.*, s.full_name, s.identity_status, s.apaar_id_ciphertext,
      p.programme_name, p.programme_code, i.legal_name AS institution_name,
      ia.rule_version AS approval_rule_version
    FROM enrolments e
    JOIN students s ON s.id = e.student_id
    JOIN programmes p ON p.id = e.programme_id
    JOIN institutions i ON i.id = e.institution_id
    LEFT JOIN intake_approvals ia ON ia.id = e.intake_approval_id
    WHERE e.id = ?`).get(enrolmentId);
  if (!row) throw notFound();
  assertInstitutionScope(user, row.institution_id);
  return row;
}

async function getImportDetail(db, user, batchId) {
  const batch = await db.prepare(`SELECT b.*, p.programme_name, p.programme_code, i.legal_name AS institution_name,
      u.display_name AS created_by_name
    FROM import_batches b
    JOIN programmes p ON p.id = b.programme_id
    JOIN institutions i ON i.id = b.institution_id
    JOIN institution_users u ON u.id = b.created_by
    WHERE b.id = ?`).get(batchId);
  if (!batch) throw notFound('Import batch not found.');
  assertInstitutionScope(user, batch.institution_id);
  const rows = await db.prepare('SELECT * FROM import_rows WHERE batch_id = ? ORDER BY source_row_number').all(batchId);
  const issues = await db.prepare(`SELECT vi.*, ir.source_row_number
    FROM validation_issues vi LEFT JOIN import_rows ir ON ir.id = vi.import_row_id
    WHERE vi.batch_id = ? ORDER BY ir.source_row_number, vi.severity`).all(batchId);
  return {
    ...batch,
    counts: safeJson(batch.counts, {}),
    rows: rows.map(publicRow),
    issues
  };
}

async function buildConflictCase(db, { primaryEnrolmentId, candidateEnrolmentId, institutionId, academicYear, user, correlationId }) {
  const existing = await db.prepare(`SELECT c.id FROM conflict_cases c
    JOIN conflict_case_items a ON a.case_id = c.id AND a.enrolment_id = ?
    JOIN conflict_case_items b ON b.case_id = c.id AND b.enrolment_id = ?
    WHERE c.status IN ('OPEN','ASSIGNED','NEEDS_INFO','ESCALATED') LIMIT 1`)
    .get(primaryEnrolmentId, candidateEnrolmentId);
  if (existing) return existing.id;
  const total = (await db.prepare('SELECT COUNT(*) AS count FROM conflict_cases').get()).count;
  let sequence = total + 1;
  let caseCode = `CC-${academicYear}-${String(sequence).padStart(4, '0')}`;
  while (await db.prepare('SELECT 1 FROM conflict_cases WHERE case_code = ?').get(caseCode)) {
    sequence += 1;
    caseCode = `CC-${academicYear}-${String(sequence).padStart(4, '0')}`;
  }
  const caseId = uuid();
  const now = nowIso();
  await db.prepare(`INSERT INTO conflict_cases
    (id, case_code, case_type, status, priority, assigned_to, reason_codes, created_at, updated_at, version)
    VALUES (?,?,?,?,?,?,?,?,?,1)`).run(caseId, caseCode, 'CROSS_INSTITUTION', 'OPEN', 'HIGH', null,
    JSON.stringify(['CROSS_INSTITUTION', 'PERIOD_OVERLAP', 'SAME_ACADEMIC_YEAR']), now, now);
  const insertItem = db.prepare('INSERT INTO conflict_case_items (id, case_id, enrolment_id, relationship) VALUES (?,?,?,?)');
  await insertItem.run(uuid(), caseId, primaryEnrolmentId, 'PRIMARY');
  await insertItem.run(uuid(), caseId, candidateEnrolmentId, 'CANDIDATE');
  await auditFor(db, user, {
    action: 'CONFLICT_CASE_OPENED', entityType: 'conflict_case', entityId: caseId,
    institutionId, correlationId,
    metadata: { case_type: 'CROSS_INSTITUTION', priority: 'HIGH', reason_codes: ['CROSS_INSTITUTION', 'PERIOD_OVERLAP'] }
  });
  await enqueueOutbox(db, {
    aggregateType: 'conflict_case', aggregateId: caseId, eventType: 'CONFLICT_CASE_OPENED',
    payload: { caseId, caseCode, institutionId, academicYear }
  });
  return caseId;
}

async function commitBatch(db, { batch, user, correlationId }) {
  if (batch.status === 'COMMITTED') {
    return { alreadyCommitted: true, detail: await getImportDetail(db, user, batch.id) };
  }
  if (batch.status !== 'APPROVED') {
    throw conflict('Only an approved batch can be committed.', 'BATCH_NOT_APPROVED');
  }
  const rows = await db.prepare(`SELECT * FROM import_rows WHERE batch_id = ? AND status IN ('VALID','REVIEW')
    ORDER BY source_row_number`).all(batch.id);
  if (rows.length === 0) throw conflict('This batch has no committable rows.', 'NO_COMMITTABLE_ROWS');
  const approval = await db.prepare('SELECT * FROM intake_approvals WHERE id = ?').get(batch.intake_approval_id);
  const now = nowIso();
  let created = 0;
  const caseIds = [];

  await db.transaction(async () => {
    for (const row of rows) {
      const payload = safeJson(row.normalized_payload, {});
      if (!payload.apaar_token || !payload.apaar_id_ciphertext) {
        throw conflict(`Source row ${row.source_row_number} has no valid protected identity reference.`, 'INVALID_IDENTITY_REFERENCE');
      }
      const duplicate = await db.prepare(`SELECT e.id FROM enrolments e JOIN students s ON s.id = e.student_id
        WHERE s.apaar_token = ? AND e.programme_id = ? AND e.academic_year = ?
          AND e.enrolment_status IN ('ACTIVE','TRANSFERRED') LIMIT 1`)
        .get(payload.apaar_token, batch.programme_id, batch.academic_year);
      if (duplicate) {
        throw conflict(`Source row ${row.source_row_number} already has an active enrolment for this programme and year.`, 'DUPLICATE_ENROLMENT');
      }

      let student = await db.prepare('SELECT * FROM students WHERE apaar_token = ? ORDER BY created_at LIMIT 1').get(payload.apaar_token);
      if (!student) {
        const studentId = uuid();
        await db.prepare(`INSERT INTO students
          (id, apaar_id_ciphertext, apaar_token, apaar_token_key_id, full_name, date_of_birth,
           identity_status, created_at, updated_at, version)
          VALUES (?,?,?,?,?,?,?,?,?,1)`).run(studentId, payload.apaar_id_ciphertext, payload.apaar_token,
          keyId, payload.full_name, payload.date_of_birth || null, 'PENDING', now, now);
        student = await db.prepare('SELECT * FROM students WHERE id = ?').get(studentId);
      }

      const enrolmentId = uuid();
      await db.prepare(`INSERT INTO enrolments
        (id, student_id, institution_id, programme_id, academic_year, roll_number, admission_date,
         enrolment_status, seat_type, admission_category, nri_status, oci_status, foreign_national_status,
         intake_approval_id, source_import_row_id, created_at, updated_at, version)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1)`).run(
        enrolmentId, student.id, batch.institution_id, batch.programme_id, batch.academic_year,
        payload.roll_number || null, payload.admission_date || null, 'ACTIVE', payload.seat_type,
        payload.admission_category || null, payload.nri_status || 'NOT_APPLICABLE',
        payload.oci_status || 'NOT_APPLICABLE', payload.foreign_national_status || 'NOT_APPLICABLE',
        batch.intake_approval_id, row.id, now, now
      );

      const check = mockVerify({ apaarCiphertext: payload.apaar_id_ciphertext, correlationId });
      await db.prepare(`INSERT INTO identity_checks
        (id, student_id, enrolment_id, provider_code, status, provider_reference, checked_at, reason_code, response_digest, created_at)
        VALUES (?,?,?,?,?,?,?,?,?,?)`).run(uuid(), student.id, enrolmentId, 'MOCK-AVIP', check.status,
        check.providerReference, check.checkedAt, check.reasonCode,
        sha256(`${check.status}:${check.providerReference || ''}`), now);
      await db.prepare('UPDATE students SET identity_status = ?, updated_at = ?, version = version + 1 WHERE id = ?')
        .run(check.status, now, student.id);

      await auditFor(db, user, {
        action: 'ENROLMENT_CREATED', entityType: 'enrolment', entityId: enrolmentId,
        institutionId: batch.institution_id, entityVersion: 1, correlationId,
        metadata: {
          batch_id: batch.id, programme_id: batch.programme_id, academic_year: batch.academic_year,
          identity_status: check.status, rule_version: approval ? approval.rule_version : null
        }
      });
      await enqueueOutbox(db, {
        aggregateType: 'enrolment', aggregateId: enrolmentId, eventType: 'ENROLMENT_CREATED',
        payload: {
          enrolmentId, institutionId: batch.institution_id, programmeId: batch.programme_id,
          academicYear: batch.academic_year, identityStatus: check.status
        }
      });

      const matches = await db.prepare(`SELECT e.id, e.institution_id FROM enrolments e
        JOIN students s ON s.id = e.student_id
        WHERE s.apaar_token = ? AND e.institution_id <> ? AND e.academic_year = ?
          AND e.enrolment_status IN ('ACTIVE','TRANSFERRED') AND e.id <> ?`)
        .all(payload.apaar_token, batch.institution_id, batch.academic_year, enrolmentId);
      for (const match of matches) {
        caseIds.push(await buildConflictCase(db, {
          primaryEnrolmentId: enrolmentId,
          candidateEnrolmentId: match.id,
          institutionId: batch.institution_id,
          academicYear: batch.academic_year,
          user,
          correlationId
        }));
      }

      await db.prepare("UPDATE import_rows SET status = 'COMMITTED' WHERE id = ?").run(row.id);
      created += 1;
    }

    const priorBatches = await db.prepare(`SELECT id FROM import_batches
      WHERE institution_id = ? AND programme_id = ? AND academic_year = ?
        AND status = 'COMMITTED' AND id <> ?`).all(batch.institution_id, batch.programme_id, batch.academic_year, batch.id);
    for (const prior of priorBatches) {
      await db.prepare("UPDATE import_batches SET status = 'SUPERSEDED', updated_at = ?, version = version + 1 WHERE id = ?")
        .run(now, prior.id);
      await auditFor(db, user, {
        action: 'BATCH_SUPERSEDED', entityType: 'import_batch', entityId: prior.id,
        institutionId: batch.institution_id, correlationId, metadata: { replacement_batch_id: batch.id }
      });
    }

    const counts = { ...safeJson(batch.counts, {}), committed: created };
    await db.prepare(`UPDATE import_batches SET status = 'COMMITTED', counts = ?, updated_at = ?, version = version + 1 WHERE id = ?`)
      .run(JSON.stringify(counts), now, batch.id);

    const counted = (await db.prepare(`SELECT COUNT(*) AS count FROM enrolments
      WHERE programme_id = ? AND academic_year = ? AND enrolment_status = 'ACTIVE' AND seat_type = 'REGULAR'`)
      .get(batch.programme_id, batch.academic_year)).count;
    const overage = approval ? counted > approval.approved_intake : false;

    await auditFor(db, user, {
      action: 'BATCH_COMMITTED', entityType: 'import_batch', entityId: batch.id,
      institutionId: batch.institution_id, correlationId,
      metadata: { counts, conflict_cases_opened: caseIds.length, counted_enrolments: counted, intake_overage: overage }
    });
    await enqueueOutbox(db, {
      aggregateType: 'import_batch', aggregateId: batch.id, eventType: 'BATCH_COMMITTED',
      payload: { batchId: batch.id, institutionId: batch.institution_id, committed: created, conflicts: caseIds.length }
    });
  });
  return { alreadyCommitted: false, created, conflictCases: caseIds.length, detail: await getImportDetail(db, user, batch.id) };
}

async function intakeAnalytics(db, user, academicYear) {
  const year = normalizeYear(academicYear || CURRENT_YEAR);
  const params = [];
  let sql = `SELECT p.*, i.legal_name AS institution_name, i.institution_code
    FROM programmes p JOIN institutions i ON i.id = p.institution_id
    WHERE p.approval_status = 'ACTIVE'`;
  if (user.institution_id) {
    sql += ' AND p.institution_id = ?';
    params.push(user.institution_id);
  }
  sql += ' ORDER BY i.legal_name, p.programme_name';
  const programmes = await db.prepare(sql).all(...params);
  const rows = [];
  let totalApproved = 0;
  let totalCounted = 0;
  let totalSupernumerary = 0;

  for (const programme of programmes) {
    const approval = await db.prepare(`SELECT * FROM intake_approvals
      WHERE programme_id = ? AND academic_year = ? AND status = 'ACTIVE'
      ORDER BY rule_version DESC LIMIT 1`).get(programme.id, year);
    const statusRows = await db.prepare(`SELECT enrolment_status, COUNT(*) AS count FROM enrolments
      WHERE programme_id = ? AND academic_year = ? GROUP BY enrolment_status`).all(programme.id, year);
    const statusCounts = Object.fromEntries(statusRows.map((row) => [row.enrolment_status, row.count]));
    const counted = statusCounts.ACTIVE || 0;
    const supernumerary = (await db.prepare(`SELECT COUNT(*) AS count FROM enrolments
      WHERE programme_id = ? AND academic_year = ? AND enrolment_status = 'ACTIVE' AND seat_type = 'SUPERNUMERARY'`)
      .get(programme.id, year)).count;
    const regularCounted = (await db.prepare(`SELECT COUNT(*) AS count FROM enrolments
      WHERE programme_id = ? AND academic_year = ? AND enrolment_status = 'ACTIVE' AND seat_type = 'REGULAR'`)
      .get(programme.id, year)).count;
    const categoryRows = await db.prepare(`SELECT admission_category AS category, COUNT(*) AS count FROM enrolments
      WHERE programme_id = ? AND academic_year = ? AND enrolment_status = 'ACTIVE' AND seat_type = 'REGULAR'
      GROUP BY admission_category`).all(programme.id, year);
    const categoryMap = Object.fromEntries(categoryRows.map((row) => [row.category || 'UNSPECIFIED', row.count]));
    const categoryRules = safeJson(approval ? approval.category_rules : null, {});
    const categories = Object.entries(categoryRules).map(([category, cap]) => ({
      category,
      cap: Number(cap),
      count: categoryMap[category] || 0,
      over: Number.isFinite(Number(cap)) && (categoryMap[category] || 0) > Number(cap)
    }));
    const approved = approval ? approval.approved_intake : null;
    totalApproved += approved || 0;
    totalCounted += regularCounted;
    totalSupernumerary += supernumerary;
    rows.push({
      programme_id: programme.id,
      institution_id: programme.institution_id,
      institution_name: programme.institution_name,
      institution_code: programme.institution_code,
      programme_code: programme.programme_code,
      programme_name: programme.programme_name,
      programme_level: programme.programme_level,
      academic_year: year,
      approval_id: approval ? approval.id : null,
      approval_reference: approval ? approval.approval_reference : null,
      approved_intake: approved,
      rule_version: approval ? approval.rule_version : null,
      counted_regular: regularCounted,
      active_total: counted,
      supernumerary,
      utilization: approved ? Math.round((regularCounted / approved) * 1000) / 10 : null,
      alert: approved !== null && regularCounted > approved,
      status_counts: statusCounts,
      categories
    });
  }
  return {
    academic_year: year,
    rows,
    totals: {
      approved: totalApproved,
      counted: totalCounted,
      supernumerary: totalSupernumerary,
      utilization: totalApproved ? Math.round((totalCounted / totalApproved) * 1000) / 10 : null,
      alerts: rows.filter((row) => row.alert).length
    }
  };
}

async function getDashboard(db, user) {
  const own = user.institution_id;
  const params = own ? [own] : [];
  const instWhere = own ? ' WHERE i.id = ?' : '';
  const institutions = (await db.prepare(`SELECT COUNT(*) AS count FROM institutions i${instWhere}`).get(...params)).count;
  const programmes = (await db.prepare(`SELECT COUNT(*) AS count FROM programmes p JOIN institutions i ON i.id = p.institution_id${instWhere}`)
    .get(...params)).count;
  const programmeWhere = own ? ' AND e.institution_id = ?' : '';
  const activeEnrolments = (await db.prepare(`SELECT COUNT(*) AS count FROM enrolments e WHERE e.enrolment_status = 'ACTIVE'${programmeWhere}`)
    .get(...params)).count;
  const students = (await db.prepare(`SELECT COUNT(DISTINCT e.student_id) AS count FROM enrolments e WHERE 1=1${programmeWhere}`)
    .get(...params)).count;
  const batchRows = await db.prepare(`SELECT status, COUNT(*) AS count FROM import_batches b WHERE 1=1${own ? ' AND b.institution_id = ?' : ''} GROUP BY status`)
    .all(...params);
  const batchesByStatus = Object.fromEntries(batchRows.map((row) => [row.status, row.count]));
  const conflicts = (await db.prepare(`SELECT COUNT(*) AS count FROM conflict_cases c
    WHERE c.status IN ('OPEN','ASSIGNED','NEEDS_INFO','ESCALATED')
      AND EXISTS (SELECT 1 FROM conflict_case_items ci JOIN enrolments e ON e.id = ci.enrolment_id
        WHERE ci.case_id = c.id${own ? ' AND e.institution_id = ?' : ''})`).get(...params)).count;
  const identityRows = await db.prepare(`SELECT s.identity_status, COUNT(DISTINCT s.id) AS count FROM students s
    WHERE EXISTS (SELECT 1 FROM enrolments e WHERE e.student_id = s.id${own ? ' AND e.institution_id = ?' : ''})
    GROUP BY s.identity_status`).all(...params);
  const identitySummary = Object.fromEntries(identityRows.map((row) => [row.identity_status, row.count]));
  const recentBatches = (await db.prepare(`SELECT b.id, b.original_name, b.status, b.academic_year, b.counts, b.created_at,
      p.programme_code, p.programme_name, i.legal_name AS institution_name
    FROM import_batches b JOIN programmes p ON p.id = b.programme_id JOIN institutions i ON i.id = b.institution_id
    WHERE 1=1${own ? ' AND b.institution_id = ?' : ''}
    ORDER BY b.created_at DESC LIMIT 6`).all(...params))
    .map((row) => ({ ...row, counts: safeJson(row.counts, {}) }));
  const recentConflicts = await db.prepare(`SELECT c.id, c.case_code, c.status, c.priority, c.created_at,
      (SELECT STRING_AGG(DISTINCT i2.legal_name, ',') FROM conflict_case_items ci2
        JOIN enrolments e2 ON e2.id = ci2.enrolment_id JOIN institutions i2 ON i2.id = e2.institution_id
        WHERE ci2.case_id = c.id) AS institutions
    FROM conflict_cases c
    WHERE EXISTS (SELECT 1 FROM conflict_case_items ci JOIN enrolments e ON e.id = ci.enrolment_id
      WHERE ci.case_id = c.id${own ? ' AND e.institution_id = ?' : ''})
    ORDER BY c.created_at DESC LIMIT 5`).all(...params);
  const analytics = await intakeAnalytics(db, user, CURRENT_YEAR);
  const audit = (await db.prepare(`SELECT * FROM audit_events ${own ? 'WHERE institution_id = ?' : ''}
    ORDER BY occurred_at DESC, seq DESC LIMIT 6`).all(...params)).map(parseMetadata);

  return {
    environment: {
      mode: 'PROTOTYPE',
      data: 'SYNTHETIC',
      identity_provider: 'MOCK-AVIP',
      demo: true
    },
    counts: {
      institutions, programmes, students, active_enrolments: activeEnrolments,
      conflicts_open: conflicts, batches_by_status: batchesByStatus,
      ready_for_review: batchesByStatus.READY_FOR_REVIEW || 0,
      needs_correction: batchesByStatus.NEEDS_CORRECTION || 0
    },
    identity_summary: identitySummary,
    intake_alerts: analytics.rows.filter((row) => row.alert || row.categories.some((category) => category.over)),
    recent_batches: recentBatches,
    recent_conflicts: recentConflicts,
    recent_audit: audit
  };
}

function scopedConflictIdsSql(own) {
  return own
    ? ` AND EXISTS (SELECT 1 FROM conflict_case_items ci JOIN enrolments e ON e.id = ci.enrolment_id
        WHERE ci.case_id = c.id AND e.institution_id = ?)`
    : '';
}

async function handleApi({ req, res, db, url, body }) {
  const method = req.method;
  const route = url.pathname.replace(/^\/api\/v1/, '') || '/';
  const correlationId = req.correlationId;
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies.session_token;

  if (method !== 'GET' && route !== '/auth/login') {
    const origin = req.headers.origin;
    if (origin) {
      try {
        if (new URL(origin).host !== req.headers.host) throw forbidden('Cross-origin requests are not allowed.');
      } catch (error) {
        if (error instanceof HttpError) throw error;
        throw forbidden('Invalid request origin.');
      }
    }
  }

  if (route === '/health' && method === 'GET') {
    const dbOk = (await db.prepare('SELECT 1 AS ok').get()).ok === 1;
    return sendJson(res, 200, {
      status: dbOk ? 'ok' : 'degraded',
      service: 'AVIP API',
      version: '1.0.0',
      ruleset: RULESET,
      identity_provider: process.env.MOCK_PROVIDER_DOWN === '1' ? 'MOCK-AVIP (unavailable)' : 'MOCK-AVIP',
      time: nowIso()
    });
  }

  if (route === '/auth/login' && method === 'POST') {
    const user = await login(db, body || {});
    const session = await createSession(db, user.id);
    res.setHeader('Set-Cookie', `session_token=${session.token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800`);
    await auditFor(db, user, {
      action: 'USER_LOGIN', entityType: 'institution_user', entityId: user.id,
      institutionId: user.institution_id, correlationId
    });
    return sendJson(res, 200, { user: publicUser(user), expires_at: session.expiresAt });
  }

  const user = await getSessionUser(db, token);
  if (!user) throw unauthorized();

  if (route === '/auth/logout' && method === 'POST') {
    await destroySession(db, token);
    res.setHeader('Set-Cookie', 'session_token=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');
    return sendJson(res, 200, { ok: true });
  }

  if (route === '/auth/me' && method === 'GET') {
    return sendJson(res, 200, { user: publicUser(user) });
  }

  if (route === '/meta' && method === 'GET') {
    return sendJson(res, 200, {
      user: publicUser(user),
      roles: ROLES.map((role) => ({ role, label: ROLE_LABELS[role], capabilities: CAPABILITIES[role] })),
      seat_types: SEAT_TYPES,
      categories: CATEGORIES,
      enrolment_statuses: ENROLMENT_STATUSES,
      batch_statuses: BATCH_STATUSES,
      identity_statuses: IDENTITY_STATUSES,
      conflict_resolutions: CONFLICT_RESOLUTIONS,
      tri_state: TRI_STATE,
      academic_years: ACADEMIC_YEARS,
      current_year: CURRENT_YEAR,
      ruleset: RULESET,
      rule_version: RULE_VERSION,
      environment: {
        mode: 'PROTOTYPE', data: 'SYNTHETIC', identity_provider: 'MOCK-AVIP',
        note: 'Prototype only. No live APAAR, ABC, DigiLocker or AICTE production integration.'
      }
    });
  }

  if (route === '/dashboard' && method === 'GET') {
    return sendJson(res, 200, await getDashboard(db, user));
  }

  if (route === '/institutions' && method === 'GET') {
    const params = [];
    let sql = `SELECT i.*,
      (SELECT COUNT(*) FROM programmes p WHERE p.institution_id = i.id) AS programmes_count,
      (SELECT COUNT(*) FROM institution_users u WHERE u.institution_id = i.id) AS users_count,
      (SELECT COUNT(*) FROM enrolments e WHERE e.institution_id = i.id AND e.enrolment_status = 'ACTIVE') AS active_enrolments
      FROM institutions i WHERE 1=1`;
    if (user.institution_id) { sql += ' AND i.id = ?'; params.push(user.institution_id); }
    sql += ' ORDER BY i.legal_name';
    return sendJson(res, 200, { items: await db.prepare(sql).all(...params) });
  }

  if (route === '/institutions' && method === 'POST') {
    requireCapability(user, 'institution:manage');
    if (isReadOnly(user)) throw forbidden();
    const { institution_code, legal_name, approval_status, approval_reference, state_code } = body || {};
    if (!legal_name || String(legal_name).trim().length < 3) throw badRequest('Legal name is required.');
    if (!['PENDING', 'ACTIVE', 'SUSPENDED', 'EXPIRED'].includes(approval_status)) throw badRequest('Invalid approval status.');
    if (state_code && !/^[A-Z]{2,3}$/.test(String(state_code))) throw badRequest('State code must be 2-3 uppercase letters.');
    const now = nowIso();
    const id = uuid();
    try {
      await db.prepare(`INSERT INTO institutions
        (id, institution_code, legal_name, approval_status, approval_reference, state_code, created_at, updated_at, version)
        VALUES (?,?,?,?,?,?,?,?,1)`).run(id, institution_code ? String(institution_code).trim().toUpperCase() : null,
        String(legal_name).trim(), approval_status, approval_reference || null, state_code || null, now, now);
    } catch (error) {
      if (error.code === '23505' || String(error.message).includes('UNIQUE')) throw conflict('Institution code already exists.', 'DUPLICATE_INSTITUTION_CODE');
      throw error;
    }
    await auditFor(db, user, {
      action: 'INSTITUTION_CREATED', entityType: 'institution', entityId: id, institutionId: id,
      correlationId, metadata: { institution_code, approval_status }
    });
    const created = await db.prepare('SELECT * FROM institutions WHERE id = ?').get(id);
    return sendJson(res, 201, { institution: created });
  }

  let match = route.match(/^\/institutions\/([^/]+)$/);
  if (match && method === 'PATCH') {
    requireCapability(user, 'institution:manage');
    const institution = await db.prepare('SELECT * FROM institutions WHERE id = ?').get(match[1]);
    if (!institution) throw notFound('Institution not found.');
    const { approval_status, approval_reference, reason_code, version } = body || {};
    if (approval_status && !['PENDING', 'ACTIVE', 'SUSPENDED', 'EXPIRED'].includes(approval_status)) {
      throw badRequest('Invalid approval status.');
    }
    const expectedVersion = version ?? institution.version;
    const result = await db.prepare(`UPDATE institutions SET approval_status = ?, approval_reference = ?, updated_at = ?, version = version + 1
      WHERE id = ? AND version = ?`).run(approval_status || institution.approval_status,
      approval_reference === undefined ? institution.approval_reference : approval_reference,
      nowIso(), institution.id, expectedVersion);
    if (result.changes === 0) throw conflict('The institution was modified by another request. Reload and retry.', 'VERSION_CONFLICT');
    await auditFor(db, user, {
      action: 'INSTITUTION_UPDATED', entityType: 'institution', entityId: institution.id,
      institutionId: institution.id, reasonCode: reason_code || 'ADMIN_UPDATE', correlationId,
      metadata: { from_status: institution.approval_status, to_status: approval_status || institution.approval_status }
    });
    return sendJson(res, 200, { institution: await db.prepare('SELECT * FROM institutions WHERE id = ?').get(institution.id) });
  }

  if (route === '/programmes' && method === 'GET') {
    const params = [];
    let sql = `SELECT p.*, i.legal_name AS institution_name, i.institution_code,
      (SELECT COUNT(*) FROM enrolments e WHERE e.programme_id = p.id AND e.enrolment_status = 'ACTIVE') AS active_enrolments,
      (SELECT ia.approved_intake FROM intake_approvals ia WHERE ia.programme_id = p.id AND ia.status = 'ACTIVE'
        ORDER BY ia.rule_version DESC LIMIT 1) AS approved_intake,
      (SELECT ia.rule_version FROM intake_approvals ia WHERE ia.programme_id = p.id AND ia.status = 'ACTIVE'
        ORDER BY ia.rule_version DESC LIMIT 1) AS latest_rule_version
      FROM programmes p JOIN institutions i ON i.id = p.institution_id WHERE 1=1`;
    if (user.institution_id) { sql += ' AND p.institution_id = ?'; params.push(user.institution_id); }
    else if (url.searchParams.get('institution_id')) { sql += ' AND p.institution_id = ?'; params.push(url.searchParams.get('institution_id')); }
    sql += ' ORDER BY i.legal_name, p.programme_name';
    return sendJson(res, 200, { items: await db.prepare(sql).all(...params) });
  }

  if (route === '/programmes' && method === 'POST') {
    requireCapability(user, 'programme:manage');
    if (isReadOnly(user)) throw forbidden();
    const { institution_id, programme_code, programme_name, programme_level } = body || {};
    const institutionId = user.institution_id || institution_id;
    if (!institutionId) throw badRequest('Institution is required.');
    assertInstitutionScope(user, institutionId);
    if (!await db.prepare('SELECT 1 FROM institutions WHERE id = ?').get(institutionId)) throw notFound('Institution not found.');
    if (!programme_code || !programme_name) throw badRequest('Programme code and name are required.');
    const id = uuid();
    const now = nowIso();
    try {
      await db.prepare(`INSERT INTO programmes
        (id, institution_id, programme_code, programme_name, programme_level, approval_status, created_at, updated_at)
        VALUES (?,?,?,?,?,'ACTIVE',?,?)`).run(id, institutionId, String(programme_code).trim().toUpperCase(),
        String(programme_name).trim(), programme_level || 'UG', now, now);
    } catch (error) {
      if (error.code === '23505' || String(error.message).includes('UNIQUE')) throw conflict('Programme code already exists for this institution.', 'DUPLICATE_PROGRAMME_CODE');
      throw error;
    }
    await auditFor(db, user, {
      action: 'PROGRAMME_CREATED', entityType: 'programme', entityId: id, institutionId,
      correlationId, metadata: { programme_code }
    });
    return sendJson(res, 201, { programme: await db.prepare('SELECT * FROM programmes WHERE id = ?').get(id) });
  }

  if (route === '/intake' && method === 'GET') {
    const params = [];
    let sql = `SELECT ia.*, p.programme_code, p.programme_name, i.legal_name AS institution_name, i.id AS institution_id,
      u.display_name AS created_by_name
      FROM intake_approvals ia
      JOIN programmes p ON p.id = ia.programme_id
      JOIN institutions i ON i.id = p.institution_id
      LEFT JOIN institution_users u ON u.id = ia.created_by
      WHERE 1=1`;
    if (user.institution_id) { sql += ' AND p.institution_id = ?'; params.push(user.institution_id); }
    if (url.searchParams.get('programme_id')) { sql += ' AND ia.programme_id = ?'; params.push(url.searchParams.get('programme_id')); }
    if (url.searchParams.get('academic_year')) { sql += ' AND ia.academic_year = ?'; params.push(url.searchParams.get('academic_year')); }
    sql += ' ORDER BY ia.academic_year DESC, ia.rule_version DESC';
    const items = (await db.prepare(sql).all(...params)).map((row) => ({
      ...row,
      category_rules: safeJson(row.category_rules, {}),
      supernumerary_rules: safeJson(row.supernumerary_rules, {})
    }));
    return sendJson(res, 200, { items });
  }

  if (route === '/intake' && method === 'POST') {
    requireCapability(user, 'intake:manage');
    if (isReadOnly(user)) throw forbidden();
    const { programme_id, academic_year, approved_intake, approval_reference, category_rules, supernumerary_rules, effective_from, effective_to } = body || {};
    const year = normalizeYear(academic_year);
    const programme = await db.prepare('SELECT * FROM programmes WHERE id = ?').get(programme_id);
    if (!programme) throw notFound('Programme not found.');
    const intake = Number(approved_intake);
    if (!Number.isInteger(intake) || intake < 0) throw badRequest('Approved intake must be a non-negative integer.');
    if (!approval_reference) throw badRequest('Approval reference is required.');
    const defaults = defaultApprovalDates(year);
    const from = isoOrNull(effective_from) || defaults.from;
    const to = isoOrNull(effective_to) || defaults.to;
    if (to < from) throw badRequest('Effective end date cannot be before the start date.');
    const version = (await db.prepare('SELECT COALESCE(MAX(rule_version),0) AS v FROM intake_approvals WHERE programme_id = ? AND academic_year = ?')
      .get(programme_id, year)).v + 1;
    const id = uuid();
    const now = nowIso();
    await db.transaction(async () => {
      await db.prepare(`UPDATE intake_approvals SET status = 'SUPERSEDED'
        WHERE programme_id = ? AND academic_year = ? AND status = 'ACTIVE'`).run(programme_id, year);
      await db.prepare(`INSERT INTO intake_approvals
        (id, programme_id, academic_year, approval_reference, approved_intake, supernumerary_rules, category_rules,
         effective_from, effective_to, rule_version, status, created_by, created_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,'ACTIVE',?,?)`).run(id, programme_id, year, approval_reference, intake,
        JSON.stringify(supernumerary_rules || {}), JSON.stringify(category_rules || {}), from, to, version, user.id, now);
    });
    await auditFor(db, user, {
      action: 'INTAKE_APPROVAL_PUBLISHED', entityType: 'intake_approval', entityId: id,
      institutionId: programme.institution_id, correlationId,
      metadata: { rule_version: version, approved_intake: intake, academic_year: year, approval_reference }
    });
    await enqueueOutbox(db, {
      aggregateType: 'intake_approval', aggregateId: id, eventType: 'INTAKE_APPROVAL_PUBLISHED',
      payload: { approvalId: id, programmeId: programme_id, academicYear: year, ruleVersion: version }
    });
    return sendJson(res, 201, {
      intake: { ...await db.prepare('SELECT * FROM intake_approvals WHERE id = ?').get(id), category_rules: category_rules || {} }
    });
  }

  if (route === '/students' && method === 'GET') {
    requireCapability(user, 'student:view');
    const { page, pageSize, offset } = paging(url);
    const search = String(url.searchParams.get('search') || '').trim();
    const params = [];
    let where = ' WHERE 1=1';
    if (user.institution_id) {
      where += ' AND EXISTS (SELECT 1 FROM enrolments e WHERE e.student_id = s.id AND e.institution_id = ?)';
      params.push(user.institution_id);
    }
    if (search) {
      const clauses = [
        's.full_name ILIKE ?',
        'EXISTS (SELECT 1 FROM enrolments e2 WHERE e2.student_id = s.id AND (e2.roll_number ILIKE ? OR e2.academic_year ILIKE ?))'
      ];
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
      if (/^\d{12}$/.test(search)) {
        clauses.push('s.apaar_token = ?');
        params.push(require('./security').apaarToken(search));
      }
      where += ` AND (${clauses.join(' OR ')})`;
    }
    const total = (await db.prepare(`SELECT COUNT(*) AS count FROM students s${where}`).get(...params)).count;
    const items = (await db.prepare(`SELECT s.id, s.full_name, s.date_of_birth, s.identity_status, s.apaar_id_ciphertext,
        (SELECT COUNT(*) FROM enrolments e WHERE e.student_id = s.id) AS enrolment_count
      FROM students s${where} ORDER BY s.full_name LIMIT ? OFFSET ?`).all(...params, pageSize, offset))
      .map((row) => ({
        ...row,
        apaar_masked: row.apaar_id_ciphertext ? maskApaar(row.apaar_id_ciphertext) : 'Not captured',
        apaar_id_ciphertext: undefined
      }));
    return sendJson(res, 200, { items, page, pageSize, total });
  }

  match = route.match(/^\/students\/([^/]+)$/);
  if (match && method === 'GET') {
    requireCapability(user, 'student:view');
    const student = await db.prepare('SELECT * FROM students WHERE id = ?').get(match[1]);
    if (!student) throw notFound('Student not found.');
    const enrolments = await db.prepare(`SELECT e.*, p.programme_name, p.programme_code, i.legal_name AS institution_name,
        ia.rule_version AS approval_rule_version
      FROM enrolments e JOIN programmes p ON p.id = e.programme_id JOIN institutions i ON i.id = e.institution_id
      LEFT JOIN intake_approvals ia ON ia.id = e.intake_approval_id
      WHERE e.student_id = ? ORDER BY e.academic_year DESC, e.created_at DESC`).all(student.id);
    if (user.institution_id && !enrolments.some((row) => row.institution_id === user.institution_id)) throw notFound('Student not found.');
    const checks = await db.prepare(`SELECT ic.*, e.roll_number, p.programme_code
      FROM identity_checks ic
      LEFT JOIN enrolments e ON e.id = ic.enrolment_id
      LEFT JOIN programmes p ON p.id = e.programme_id
      WHERE ic.student_id = ? ORDER BY ic.checked_at DESC`).all(student.id);
    return sendJson(res, 200, {
      student: {
        id: student.id,
        full_name: student.full_name,
        date_of_birth: student.date_of_birth,
        identity_status: student.identity_status,
        apaar_masked: student.apaar_id_ciphertext ? maskApaar(student.apaar_id_ciphertext) : 'Not captured',
        version: student.version
      },
      enrolments,
      identity_checks: checks
    });
  }

  if (route === '/enrolments' && method === 'GET') {
    requireCapability(user, 'student:view');
    const { page, pageSize, offset } = paging(url);
    const params = [];
    let where = ' WHERE 1=1';
    if (user.institution_id) { where += ' AND e.institution_id = ?'; params.push(user.institution_id); }
    for (const [param, column] of [['institution_id', 'e.institution_id'], ['programme_id', 'e.programme_id'], ['academic_year', 'e.academic_year'], ['status', 'e.enrolment_status']]) {
      if (url.searchParams.get(param) && !user.institution_id) { where += ` AND ${column} = ?`; params.push(url.searchParams.get(param)); }
    }
    if (user.institution_id && url.searchParams.get('programme_id')) {
      where += ' AND e.programme_id = ?';
      params.push(url.searchParams.get('programme_id'));
    }
    if (user.institution_id && url.searchParams.get('academic_year')) {
      where += ' AND e.academic_year = ?';
      params.push(url.searchParams.get('academic_year'));
    }
    if (user.institution_id && url.searchParams.get('status')) {
      where += ' AND e.enrolment_status = ?';
      params.push(url.searchParams.get('status'));
    }
    const search = String(url.searchParams.get('search') || '').trim();
    if (search) {
      where += ' AND (s.full_name ILIKE ? OR e.roll_number ILIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }
    const total = (await db.prepare(`SELECT COUNT(*) AS count FROM enrolments e JOIN students s ON s.id = e.student_id${where}`).get(...params)).count;
    const rows = await db.prepare(`SELECT e.*, s.full_name, s.identity_status, s.apaar_id_ciphertext,
        p.programme_name, p.programme_code, i.legal_name AS institution_name,
        ia.rule_version AS approval_rule_version
      FROM enrolments e JOIN students s ON s.id = e.student_id
      JOIN programmes p ON p.id = e.programme_id JOIN institutions i ON i.id = e.institution_id
      LEFT JOIN intake_approvals ia ON ia.id = e.intake_approval_id
      ${where} ORDER BY e.created_at DESC LIMIT ? OFFSET ?`).all(...params, pageSize, offset);
    return sendJson(res, 200, {
      items: rows.map((row) => ({ ...row, apaar_masked: row.apaar_id_ciphertext ? maskApaar(row.apaar_id_ciphertext) : 'Not captured', apaar_id_ciphertext: undefined })),
      page, pageSize, total
    });
  }

  match = route.match(/^\/enrolments\/([^/]+)$/);
  if (match && method === 'PATCH') {
    requireCapability(user, 'enrolment:correct');
    if (isReadOnly(user)) throw forbidden();
    const enrolment = await getEnrolmentAccess(db, user, match[1]);
    const { enrolment_status, reason_code, notes, version } = body || {};
    if (!ENROLMENT_STATUSES.includes(enrolment_status)) throw badRequest('Invalid enrolment status.');
    if (!reason_code || String(reason_code).trim().length < 3) throw badRequest('A reason code is required for a sensitive correction.', 'REASON_REQUIRED');
    if (enrolment_status === enrolment.enrolment_status) throw badRequest('The enrolment already has this status.');
    const expected = version ?? enrolment.version;
    const now = nowIso();
    const result = await db.prepare(`UPDATE enrolments SET enrolment_status = ?, updated_at = ?, version = version + 1
      WHERE id = ? AND version = ?`).run(enrolment_status, now, enrolment.id, expected);
    if (result.changes === 0) throw conflict('The enrolment was modified by another request. Reload and retry.', 'VERSION_CONFLICT');
    await auditFor(db, user, {
      action: 'ENROLMENT_STATUS_CHANGED', entityType: 'enrolment', entityId: enrolment.id,
      institutionId: enrolment.institution_id, entityVersion: expected + 1, reasonCode: reason_code,
      correlationId, beforeDigest: sha256(`${enrolment.enrolment_status}:${expected}`),
      afterDigest: sha256(`${enrolment_status}:${expected + 1}`),
      metadata: { from: enrolment.enrolment_status, to: enrolment_status, notes: notes || null }
    });
    await enqueueOutbox(db, {
      aggregateType: 'enrolment', aggregateId: enrolment.id, eventType: 'ENROLMENT_STATUS_CHANGED',
      payload: { enrolmentId: enrolment.id, institutionId: enrolment.institution_id, status: enrolment_status }
    });
    return sendJson(res, 200, { enrolment: await db.prepare('SELECT * FROM enrolments WHERE id = ?').get(enrolment.id) });
  }

  match = route.match(/^\/enrolments\/([^/]+)\/history$/);
  if (match && method === 'GET') {
    requireCapability(user, 'student:view');
    const enrolment = await getEnrolmentAccess(db, user, match[1]);
    const items = (await db.prepare(`SELECT * FROM audit_events WHERE entity_type = 'enrolment' AND entity_id = ?
      ORDER BY occurred_at DESC, seq DESC`).all(enrolment.id)).map(parseMetadata);
    return sendJson(res, 200, { items });
  }

  if (route === '/imports/template' && method === 'GET') {
    return sendCsv(res, 'avip-student-enrolment-template.csv', buildTemplate());
  }

  if (route === '/imports' && method === 'GET') {
    if (!can(user, 'import:submit') && !can(user, 'audit:view')) throw forbidden();
    const { page, pageSize, offset } = paging(url);
    const params = [];
    let where = ' WHERE 1=1';
    if (user.institution_id) { where += ' AND b.institution_id = ?'; params.push(user.institution_id); }
    if (url.searchParams.get('status') && !user.institution_id) { where += ' AND b.status = ?'; params.push(url.searchParams.get('status')); }
    if (user.institution_id && url.searchParams.get('status')) { where += ' AND b.status = ?'; params.push(url.searchParams.get('status')); }
    if (url.searchParams.get('programme_id')) { where += ' AND b.programme_id = ?'; params.push(url.searchParams.get('programme_id')); }
    const total = (await db.prepare(`SELECT COUNT(*) AS count FROM import_batches b${where}`).get(...params)).count;
    const rows = (await db.prepare(`SELECT b.*, p.programme_code, p.programme_name, i.legal_name AS institution_name,
        u.display_name AS created_by_name
      FROM import_batches b JOIN programmes p ON p.id = b.programme_id
      JOIN institutions i ON i.id = b.institution_id JOIN institution_users u ON u.id = b.created_by
      ${where} ORDER BY b.created_at DESC LIMIT ? OFFSET ?`).all(...params, pageSize, offset))
      .map((row) => ({ ...row, counts: safeJson(row.counts, {}) }));
    return sendJson(res, 200, { items: rows, page, pageSize, total });
  }

  if (route === '/imports' && method === 'POST') {
    requireCapability(user, 'import:submit');
    if (isReadOnly(user)) throw forbidden();
    const { programme_id, academic_year, filename, content, intake_approval_id } = body || {};
    const idempotencyKey = String(req.headers['idempotency-key'] || (body && body.idempotency_key) || '').trim();
    if (!idempotencyKey) throw badRequest('An Idempotency-Key header is required for imports.', 'IDEMPOTENCY_KEY_REQUIRED');
    if (idempotencyKey.length < 6 || idempotencyKey.length > 120) throw badRequest('Idempotency key must be 6-120 characters.');
    const existing = await db.prepare('SELECT id FROM import_batches WHERE created_by = ? AND idempotency_key = ?')
      .get(user.id, idempotencyKey);
    if (existing) {
      return sendJson(res, 200, { idempotent: true, batch: await getImportDetail(db, user, existing.id) });
    }
    const programme = await db.prepare('SELECT * FROM programmes WHERE id = ?').get(programme_id);
    if (!programme) throw notFound('Programme not found.');
    assertInstitutionScope(user, programme.institution_id);
    const year = normalizeYear(academic_year);
    if (!filename || !/\.csv$/i.test(String(filename))) throw badRequest('Only CSV files are supported by this prototype.');
    if (typeof content !== 'string' || content.trim().length === 0) throw badRequest('The uploaded file is empty.');
    if (Buffer.byteLength(content, 'utf8') > MAX_UPLOAD_BYTES) throw new HttpError(413, 'FILE_TOO_LARGE', 'The file exceeds the 5 MB upload limit.');
    let approval = null;
    if (intake_approval_id) {
      approval = await db.prepare('SELECT * FROM intake_approvals WHERE id = ?').get(intake_approval_id);
      if (!approval || approval.programme_id !== programme.id || approval.academic_year !== year) {
        throw badRequest('The selected intake approval does not match this programme and academic year.');
      }
    } else {
      approval = await db.prepare(`SELECT * FROM intake_approvals WHERE programme_id = ? AND academic_year = ? AND status = 'ACTIVE'
        ORDER BY rule_version DESC LIMIT 1`).get(programme.id, year);
    }
    if (!approval) throw conflict('No active intake approval exists for this programme and academic year. An AICTE administrator must publish one first.', 'NO_ACTIVE_INTAKE');
    const batchId = uuid();
    const now = nowIso();
    const digest = sha256(content);
    const objectKey = `${programme.institution_id}/${batchId}.csv`;
    const filePath = path.join(UPLOAD_DIR, programme.institution_id);
    fs.mkdirSync(filePath, { recursive: true });
    fs.writeFileSync(path.join(filePath, `${batchId}.csv`), content, { mode: 0o600 });
    await db.prepare(`INSERT INTO import_batches
      (id, institution_id, programme_id, intake_approval_id, academic_year, created_by, original_name,
       file_object_key, file_sha256, idempotency_key, status, rule_version, ruleset, counts, created_at, updated_at, version)
      VALUES (?,?,?,?,?,?,?,?,?,?,'UPLOADED',?,?,'{}',?,?,1)`).run(
      batchId, programme.institution_id, programme.id, approval.id, year, user.id, String(filename),
      objectKey, digest, idempotencyKey, RULE_VERSION, RULESET, now, now
    );
    await auditFor(db, user, {
      action: 'BATCH_UPLOADED', entityType: 'import_batch', entityId: batchId,
      institutionId: programme.institution_id, correlationId,
      metadata: { filename: String(filename), file_sha256: digest, programme_id: programme.id, academic_year: year }
    });
    let batch = await db.prepare('SELECT * FROM import_batches WHERE id = ?').get(batchId);
    try {
      await validateAndStage(db, { batch, user, csvText: content, correlationId });
    } catch (error) {
      if (error instanceof HttpError) throw error;
      await db.prepare(`UPDATE import_batches SET status = 'NEEDS_CORRECTION', updated_at = ?, version = version + 1 WHERE id = ?`)
        .run(nowIso(), batchId);
      await db.prepare(`INSERT INTO validation_issues
        (id, batch_id, import_row_id, rule_code, severity, field_name, message, status, created_at)
        VALUES (?,?,?,?,?,?,?,'OPEN',?)`).run(uuid(), batchId, null, 'E_IMPORT_PROCESSING', 'ERROR', null,
        'The file could not be processed safely. Download the template and retry.', nowIso());
      await auditFor(db, user, {
        action: 'BATCH_VALIDATION_FAILED', entityType: 'import_batch', entityId: batchId,
        institutionId: programme.institution_id, correlationId, metadata: { reason: 'PROCESSING_ERROR' }
      });
    }
    batch = await db.prepare('SELECT * FROM import_batches WHERE id = ?').get(batchId);
    return sendJson(res, 201, { batch: await getImportDetail(db, user, batchId), status: batch.status });
  }

  match = route.match(/^\/imports\/([^/]+)$/);
  if (match && method === 'GET') {
    return sendJson(res, 200, { batch: await getImportDetail(db, user, match[1]) });
  }

  match = route.match(/^\/imports\/([^/]+)\/approve$/);
  if (match && method === 'POST') {
    requireCapability(user, 'import:approve');
    if (isReadOnly(user)) throw forbidden();
    const batch = await db.prepare('SELECT * FROM import_batches WHERE id = ?').get(match[1]);
    if (!batch) throw notFound('Import batch not found.');
    assertInstitutionScope(user, batch.institution_id);
    if (batch.status !== 'READY_FOR_REVIEW') throw conflict('Only a batch that is ready for review can be approved.', 'INVALID_BATCH_STATE');
    const now = nowIso();
    await db.prepare(`UPDATE import_batches SET status = 'APPROVED', updated_at = ?, version = version + 1 WHERE id = ?`).run(now, batch.id);
    await auditFor(db, user, {
      action: 'BATCH_APPROVED', entityType: 'import_batch', entityId: batch.id,
      institutionId: batch.institution_id, correlationId,
      reasonCode: (body && body.reason_code) || 'ADMIN_APPROVAL',
      metadata: { counts: safeJson(batch.counts, {}) }
    });
    return sendJson(res, 200, { batch: await getImportDetail(db, user, batch.id) });
  }

  match = route.match(/^\/imports\/([^/]+)\/reject$/);
  if (match && method === 'POST') {
    requireCapability(user, 'import:approve');
    if (isReadOnly(user)) throw forbidden();
    const batch = await db.prepare('SELECT * FROM import_batches WHERE id = ?').get(match[1]);
    if (!batch) throw notFound('Import batch not found.');
    assertInstitutionScope(user, batch.institution_id);
    if (!['READY_FOR_REVIEW', 'NEEDS_CORRECTION', 'APPROVED'].includes(batch.status)) {
      throw conflict('This batch cannot be rejected in its current state.', 'INVALID_BATCH_STATE');
    }
    const reason = String((body && body.reason_code) || '').trim();
    if (reason.length < 3) throw badRequest('A rejection reason is required.', 'REASON_REQUIRED');
    await db.prepare(`UPDATE import_batches SET status = 'REJECTED', updated_at = ?, version = version + 1 WHERE id = ?`).run(nowIso(), batch.id);
    await auditFor(db, user, {
      action: 'BATCH_REJECTED', entityType: 'import_batch', entityId: batch.id,
      institutionId: batch.institution_id, correlationId, reasonCode: reason,
      metadata: { notes: (body && body.notes) || null }
    });
    return sendJson(res, 200, { batch: await getImportDetail(db, user, batch.id) });
  }

  match = route.match(/^\/imports\/([^/]+)\/commit$/);
  if (match && method === 'POST') {
    requireCapability(user, 'import:commit');
    if (isReadOnly(user)) throw forbidden();
    const batch = await db.prepare('SELECT * FROM import_batches WHERE id = ?').get(match[1]);
    if (!batch) throw notFound('Import batch not found.');
    assertInstitutionScope(user, batch.institution_id);
    const result = await commitBatch(db, { batch, user, correlationId });
    return sendJson(res, result.alreadyCommitted ? 200 : 201, {
      idempotent: result.alreadyCommitted,
      created: result.created || 0,
      conflict_cases: result.conflictCases || 0,
      batch: result.detail
    });
  }

  if (route === '/identity/pending' && method === 'GET') {
    requireCapability(user, 'student:view');
    const params = [];
    let sql = `SELECT e.id AS enrolment_id, s.id AS student_id, s.full_name, s.identity_status,
        s.apaar_id_ciphertext, i.legal_name AS institution_name, p.programme_code, p.programme_name,
        e.roll_number, e.academic_year
      FROM enrolments e JOIN students s ON s.id = e.student_id
      JOIN institutions i ON i.id = e.institution_id JOIN programmes p ON p.id = e.programme_id
      WHERE e.enrolment_status = 'ACTIVE' AND s.identity_status IN ('PENDING','UNVERIFIED','UNAVAILABLE','ERROR')`;
    if (user.institution_id) { sql += ' AND e.institution_id = ?'; params.push(user.institution_id); }
    sql += ' ORDER BY s.full_name LIMIT 100';
    const items = (await db.prepare(sql).all(...params)).map((row) => ({
      ...row, apaar_masked: row.apaar_id_ciphertext ? maskApaar(row.apaar_id_ciphertext) : 'Not captured',
      apaar_id_ciphertext: undefined
    }));
    return sendJson(res, 200, { items });
  }

  if (route === '/identity-checks' && method === 'GET') {
    requireCapability(user, 'student:view');
    const { page, pageSize, offset } = paging(url);
    const params = [];
    let where = ' WHERE 1=1';
    if (user.institution_id) { where += ' AND e.institution_id = ?'; params.push(user.institution_id); }
    if (url.searchParams.get('status')) { where += ' AND ic.status = ?'; params.push(url.searchParams.get('status')); }
    const total = (await db.prepare(`SELECT COUNT(*) AS count FROM identity_checks ic
      LEFT JOIN enrolments e ON e.id = ic.enrolment_id JOIN students s ON s.id = ic.student_id ${where}`).get(...params)).count;
    const rows = await db.prepare(`SELECT ic.*, s.full_name, s.apaar_id_ciphertext, e.roll_number, e.academic_year,
        p.programme_code, i.legal_name AS institution_name
      FROM identity_checks ic
      LEFT JOIN enrolments e ON e.id = ic.enrolment_id
      JOIN students s ON s.id = ic.student_id
      LEFT JOIN programmes p ON p.id = e.programme_id
      LEFT JOIN institutions i ON i.id = e.institution_id
      ${where} ORDER BY ic.checked_at DESC LIMIT ? OFFSET ?`).all(...params, pageSize, offset);
    return sendJson(res, 200, {
      items: rows.map((row) => ({ ...row, apaar_masked: row.apaar_id_ciphertext ? maskApaar(row.apaar_id_ciphertext) : 'Not captured', apaar_id_ciphertext: undefined })),
      page, pageSize, total
    });
  }

  match = route.match(/^\/identity-checks\/([^/]+)\/verify$/);
  if (match && method === 'POST') {
    requireCapability(user, 'identity:verify');
    if (isReadOnly(user)) throw forbidden();
    const enrolment = await getEnrolmentAccess(db, user, match[1]);
    if (!enrolment.apaar_id_ciphertext) throw badRequest('No protected identity reference is available for this enrolment.');
    const check = mockVerify({ apaarCiphertext: enrolment.apaar_id_ciphertext, correlationId });
    const now = nowIso();
    const id = uuid();
    await db.prepare(`INSERT INTO identity_checks
      (id, student_id, enrolment_id, provider_code, status, provider_reference, checked_at, reason_code, response_digest, created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?)`).run(id, enrolment.student_id, enrolment.id, 'MOCK-AVIP', check.status,
      check.providerReference, check.checkedAt, check.reasonCode, sha256(`${check.status}:${check.providerReference || ''}`), now);
    await db.prepare('UPDATE students SET identity_status = ?, updated_at = ?, version = version + 1 WHERE id = ?')
      .run(check.status, now, enrolment.student_id);
    await auditFor(db, user, {
      action: 'IDENTITY_CHECK_RECORDED', entityType: 'enrolment', entityId: enrolment.id,
      institutionId: enrolment.institution_id, correlationId,
      metadata: { provider: 'MOCK-AVIP', status: check.status, reason_code: check.reasonCode }
    });
    await enqueueOutbox(db, {
      aggregateType: 'enrolment', aggregateId: enrolment.id, eventType: 'IDENTITY_CHECK_RECORDED',
      payload: { enrolmentId: enrolment.id, status: check.status, provider: 'MOCK-AVIP' }
    });
    return sendJson(res, 200, {
      check: { id, ...check, provider_code: 'MOCK-AVIP', provider_reference: check.providerReference },
      student_identity_status: check.status
    });
  }

  if (route === '/conflicts' && method === 'GET') {
    requireCapability(user, 'conflict:view');
    const { page, pageSize, offset } = paging(url);
    const params = [];
    let where = ' WHERE 1=1';
    if (url.searchParams.get('status')) { where += ' AND c.status = ?'; params.push(url.searchParams.get('status')); }
    if (user.institution_id) {
      where += scopedConflictIdsSql(true);
      params.push(user.institution_id);
    }
    if (user.role === 'VERIFIER') {
      where += ' AND (c.assigned_to IS NULL OR c.assigned_to = ?)';
      params.push(user.id);
    }
    const total = (await db.prepare(`SELECT COUNT(*) AS count FROM conflict_cases c${where}`).get(...params)).count;
    const rows = (await db.prepare(`SELECT c.*, u.display_name AS assigned_name,
        (SELECT STRING_AGG(DISTINCT i.legal_name, ',') FROM conflict_case_items ci
          JOIN enrolments e ON e.id = ci.enrolment_id JOIN institutions i ON i.id = e.institution_id
          WHERE ci.case_id = c.id) AS institutions,
        (SELECT COUNT(*) FROM conflict_case_items ci WHERE ci.case_id = c.id) AS candidate_count
      FROM conflict_cases c LEFT JOIN institution_users u ON u.id = c.assigned_to
      ${where} ORDER BY CASE c.priority WHEN 'HIGH' THEN 1 WHEN 'MEDIUM' THEN 2 ELSE 3 END,
      c.created_at DESC LIMIT ? OFFSET ?`).all(...params, pageSize, offset))
      .map((row) => ({ ...row, reason_codes: safeJson(row.reason_codes, []) }));
    return sendJson(res, 200, { items: rows, page, pageSize, total });
  }

  match = route.match(/^\/conflicts\/([^/]+)$/);
  if (match && method === 'GET') {
    requireCapability(user, 'conflict:view');
    const conflictCase = await db.prepare('SELECT * FROM conflict_cases WHERE id = ?').get(match[1]);
    if (!conflictCase) throw notFound('Conflict case not found.');
    if (user.role === 'VERIFIER' && conflictCase.assigned_to && conflictCase.assigned_to !== user.id) {
      throw notFound('Conflict case not found.');
    }
    const items = await db.prepare(`SELECT ci.relationship, e.id AS enrolment_id, e.roll_number, e.academic_year,
        e.enrolment_status, e.seat_type, e.admission_category, e.created_at,
        s.full_name, s.identity_status, s.apaar_id_ciphertext,
        p.programme_code, p.programme_name, i.id AS institution_id, i.legal_name AS institution_name
      FROM conflict_case_items ci
      JOIN enrolments e ON e.id = ci.enrolment_id
      JOIN students s ON s.id = e.student_id
      JOIN programmes p ON p.id = e.programme_id
      JOIN institutions i ON i.id = e.institution_id
      WHERE ci.case_id = ? ORDER BY ci.relationship DESC, e.created_at`).all(conflictCase.id);
    if (user.institution_id && !items.some((item) => item.institution_id === user.institution_id)) {
      throw notFound('Conflict case not found.');
    }
    const audit = (await db.prepare(`SELECT * FROM audit_events WHERE entity_type = 'conflict_case' AND entity_id = ?
      ORDER BY occurred_at DESC, seq DESC LIMIT 20`).all(conflictCase.id)).map(parseMetadata);
    return sendJson(res, 200, {
      conflict: {
        ...conflictCase,
        reason_codes: safeJson(conflictCase.reason_codes, []),
        assigned_name: conflictCase.assigned_to
          ? ((await db.prepare('SELECT display_name FROM institution_users WHERE id = ?').get(conflictCase.assigned_to)) || {}).display_name
          : null
      },
      items: items.map((item) => ({
        ...item,
        apaar_masked: item.apaar_id_ciphertext ? maskApaar(item.apaar_id_ciphertext) : 'Not captured',
        apaar_id_ciphertext: undefined
      })),
      audit
    });
  }

  match = route.match(/^\/conflicts\/([^/]+)\/assign$/);
  if (match && method === 'POST') {
    requireCapability(user, 'conflict:review');
    if (isReadOnly(user)) throw forbidden();
    const conflictCase = await db.prepare('SELECT * FROM conflict_cases WHERE id = ?').get(match[1]);
    if (!conflictCase) throw notFound('Conflict case not found.');
    const targetId = body && body.assigned_to;
    let target = null;
    if (targetId) {
      target = await db.prepare(`SELECT * FROM institution_users WHERE id = ? AND status = 'ACTIVE'
        AND role IN ('VERIFIER','AICTE_ADMIN')`).get(targetId);
      if (!target) throw badRequest('Assigned user must be an active verification officer or AICTE administrator.');
      if (user.role === 'VERIFIER' && target.id !== user.id) throw forbidden('Verification officers may assign cases only to themselves.');
    }
    await db.prepare(`UPDATE conflict_cases SET assigned_to = ?, status = ?, updated_at = ?, version = version + 1
      WHERE id = ?`).run(target ? target.id : null, target ? 'ASSIGNED' : 'OPEN', nowIso(), conflictCase.id);
    await auditFor(db, user, {
      action: 'CONFLICT_CASE_ASSIGNED', entityType: 'conflict_case', entityId: conflictCase.id,
      institutionId: null, correlationId, reasonCode: 'CASE_ASSIGNMENT',
      metadata: { assigned_to: target ? target.id : null, assigned_name: target ? target.display_name : null }
    });
    return sendJson(res, 200, {
      conflict: { ...(await db.prepare('SELECT * FROM conflict_cases WHERE id = ?').get(conflictCase.id)), reason_codes: safeJson(conflictCase.reason_codes, []) }
    });
  }

  match = route.match(/^\/conflicts\/([^/]+)\/resolve$/);
  if (match && method === 'POST') {
    requireCapability(user, 'conflict:review');
    if (isReadOnly(user)) throw forbidden();
    const conflictCase = await db.prepare('SELECT * FROM conflict_cases WHERE id = ?').get(match[1]);
    if (!conflictCase) throw notFound('Conflict case not found.');
    if (user.role === 'VERIFIER' && conflictCase.assigned_to && conflictCase.assigned_to !== user.id) {
      throw forbidden('This case is assigned to another review officer.');
    }
    const resolutionCode = String((body && body.resolution_code) || '');
    const notes = String((body && body.notes) || '').trim();
    if (!CONFLICT_RESOLUTIONS.includes(resolutionCode)) throw badRequest('A valid resolution code is required.');
    if (notes.length < 5) throw badRequest('Resolution notes are required.', 'RESOLUTION_NOTES_REQUIRED');
    if (['RESOLVED', 'FALSE_POSITIVE', 'ESCALATED'].includes(conflictCase.status)) {
      throw conflict('This conflict case is already closed.', 'CASE_CLOSED');
    }
    const status = resolutionCode === 'FALSE_POSITIVE' ? 'FALSE_POSITIVE'
      : resolutionCode === 'ESCALATED' ? 'ESCALATED'
        : resolutionCode === 'UNRESOLVED' ? 'NEEDS_INFO' : 'RESOLVED';
    await db.prepare(`UPDATE conflict_cases SET status = ?, resolution_code = ?, resolution_notes = ?,
      assigned_to = COALESCE(assigned_to, ?), updated_at = ?, version = version + 1 WHERE id = ?`)
      .run(status, resolutionCode, notes, user.id, nowIso(), conflictCase.id);
    await auditFor(db, user, {
      action: 'CONFLICT_CASE_RESOLVED', entityType: 'conflict_case', entityId: conflictCase.id,
      institutionId: null, correlationId, reasonCode: resolutionCode,
      metadata: { resolution_code: resolutionCode, notes, status }
    });
    await enqueueOutbox(db, {
      aggregateType: 'conflict_case', aggregateId: conflictCase.id, eventType: 'CONFLICT_CASE_RESOLVED',
      payload: { caseId: conflictCase.id, resolutionCode, status }
    });
    return sendJson(res, 200, {
      conflict: { ...(await db.prepare('SELECT * FROM conflict_cases WHERE id = ?').get(conflictCase.id)), reason_codes: safeJson(conflictCase.reason_codes, []) }
    });
  }

  if (route === '/users' && method === 'GET') {
    requireCapability(user, 'audit:view');
    const params = [];
    let sql = `SELECT u.id, u.display_name, u.email, u.role, u.institution_id, u.status, i.legal_name AS institution_name
      FROM institution_users u LEFT JOIN institutions i ON i.id = u.institution_id WHERE u.status = 'ACTIVE'`;
    if (user.institution_id) { sql += ' AND u.institution_id = ?'; params.push(user.institution_id); }
    if (url.searchParams.get('role')) { sql += ' AND u.role = ?'; params.push(url.searchParams.get('role')); }
    sql += ' ORDER BY u.display_name';
    return sendJson(res, 200, { items: await db.prepare(sql).all(...params) });
  }

  if (route === '/analytics/intake' && method === 'GET') {
    return sendJson(res, 200, await intakeAnalytics(db, user, url.searchParams.get('academic_year') || CURRENT_YEAR));
  }

  if (route === '/reports/enrolments.csv' && method === 'GET') {
    requireCapability(user, 'report:view');
    const params = [];
    let sql = `SELECT e.id, s.full_name, s.apaar_id_ciphertext, i.legal_name AS institution_name,
        p.programme_code, p.programme_name, e.academic_year, e.roll_number, e.admission_date,
        e.enrolment_status, e.seat_type, e.admission_category, s.identity_status
      FROM enrolments e JOIN students s ON s.id = e.student_id
      JOIN programmes p ON p.id = e.programme_id JOIN institutions i ON i.id = e.institution_id WHERE 1=1`;
    if (user.institution_id) { sql += ' AND e.institution_id = ?'; params.push(user.institution_id); }
    sql += ' ORDER BY i.legal_name, p.programme_code, e.roll_number';
    const rows = await db.prepare(sql).all(...params);
    const { csvEscape } = require('./validation');
    const header = ['enrolment_id', 'student_name', 'apaar_masked', 'institution', 'programme_code', 'programme_name',
      'academic_year', 'roll_number', 'admission_date', 'status', 'seat_type', 'category', 'identity_status'];
    const lines = [header.join(',')];
    for (const row of rows) {
      lines.push([
        row.id, row.full_name, row.apaar_id_ciphertext ? maskApaar(row.apaar_id_ciphertext) : 'Not captured',
        row.institution_name, row.programme_code, row.programme_name, row.academic_year, row.roll_number,
        row.admission_date, row.enrolment_status, row.seat_type, row.admission_category, row.identity_status
      ].map(csvEscape).join(','));
    }
    await auditFor(db, user, {
      action: 'REPORT_EXPORTED', entityType: 'report', entityId: 'enrolments', institutionId: user.institution_id,
      correlationId, metadata: { rows: rows.length, format: 'CSV' }
    });
    return sendCsv(res, 'avip-enrolments.csv', `${lines.join('\n')}\n`);
  }

  if (route === '/reports/intake.csv' && method === 'GET') {
    requireCapability(user, 'report:view');
    const analytics = await intakeAnalytics(db, user, url.searchParams.get('academic_year') || CURRENT_YEAR);
    const { csvEscape } = require('./validation');
    const header = ['institution', 'programme_code', 'programme_name', 'academic_year', 'approved_intake',
      'counted_regular', 'supernumerary', 'utilization_percent', 'rule_version', 'approval_reference', 'alert'];
    const lines = [header.join(',')];
    for (const row of analytics.rows) {
      lines.push([row.institution_name, row.programme_code, row.programme_name, row.academic_year,
        row.approved_intake ?? '', row.counted_regular, row.supernumerary, row.utilization ?? '',
        row.rule_version ?? '', row.approval_reference ?? '', row.alert ? 'YES' : 'NO'].map(csvEscape).join(','));
    }
    await auditFor(db, user, {
      action: 'REPORT_EXPORTED', entityType: 'report', entityId: 'intake', institutionId: user.institution_id,
      correlationId, metadata: { rows: analytics.rows.length, format: 'CSV' }
    });
    return sendCsv(res, 'avip-intake-utilization.csv', `${lines.join('\n')}\n`);
  }

  if (route === '/audit' && method === 'GET') {
    requireCapability(user, 'audit:view');
    const { page, pageSize, offset } = paging(url);
    const params = [];
    let where = ' WHERE 1=1';
    if (user.institution_id) { where += ' AND institution_id = ?'; params.push(user.institution_id); }
    for (const [param, column] of [['action', 'action'], ['entity_type', 'entity_type'], ['entity_id', 'entity_id'], ['correlation_id', 'correlation_id']]) {
      if (url.searchParams.get(param)) { where += ` AND ${column} = ?`; params.push(url.searchParams.get(param)); }
    }
    if (url.searchParams.get('actor')) { where += ' AND (actor_id = ? OR actor_label ILIKE ?)'; params.push(url.searchParams.get('actor'), `%${url.searchParams.get('actor')}%`); }
    if (url.searchParams.get('from')) { where += ' AND occurred_at >= ?'; params.push(url.searchParams.get('from')); }
    if (url.searchParams.get('to')) { where += ' AND occurred_at <= ?'; params.push(url.searchParams.get('to')); }
    const total = (await db.prepare(`SELECT COUNT(*) AS count FROM audit_events${where}`).get(...params)).count;
    const items = (await db.prepare(`SELECT * FROM audit_events${where} ORDER BY occurred_at DESC, seq DESC LIMIT ? OFFSET ?`)
      .all(...params, pageSize, offset)).map(parseMetadata);
    return sendJson(res, 200, { items, page, pageSize, total });
  }

  if (route === '/audit/verify' && method === 'GET') {
    requireCapability(user, 'audit:verify');
    const result = await verifyAuditChain(db);
    await auditFor(db, user, {
      action: 'AUDIT_CHAIN_VERIFIED', entityType: 'audit_chain', entityId: 'primary',
      institutionId: user.institution_id, correlationId,
      metadata: { valid: result.valid, checked: result.checked, broken_at: result.brokenAt }
    });
    return sendJson(res, result.valid ? 200 : 409, { ...result, checked_at: nowIso() });
  }

  match = route.match(/^\/audit\/([^/]+)$/);
  if (match && method === 'GET') {
    requireCapability(user, 'audit:view');
    const event = await db.prepare('SELECT * FROM audit_events WHERE id = ?').get(match[1]);
    if (!event) throw notFound('Audit event not found.');
    if (user.institution_id && event.institution_id !== user.institution_id) throw notFound('Audit event not found.');
    return sendJson(res, 200, { event: parseMetadata(event) });
  }

  if (route === '/settings' && method === 'GET') {
    return sendJson(res, 200, {
      integrations: [
        { name: 'Identity verification', provider: 'MOCK-AVIP', status: 'SIMULATED', detail: 'Replaceable adapter. No live APAAR, ABC or DigiLocker access.' },
        { name: 'File storage', provider: 'Private local object storage', status: 'PRIVATE', detail: 'Files are stored outside the web root with SHA-256 integrity checks.' },
        { name: 'Queue', provider: 'Synchronous staging worker', status: 'PROTOTYPE', detail: 'Redis/BullMQ is the production target. Jobs are idempotent by design.' },
        { name: 'Audit integrity', provider: 'SHA-256 hash chain', status: 'ACTIVE', detail: 'Append-only event chain with on-demand integrity verification.' }
      ],
      security: {
        sessions: 'HttpOnly cookie, SameSite=Strict, 8-hour expiry',
        identifier_protection: 'AES-256-GCM encryption plus keyed HMAC matching token',
        masking: 'Raw APAAR values are never returned by the API',
        mfa: 'Privileged AICTE administrator demo accounts require MFA code 246810',
        authorization: 'Role and institution scope checked on every object access',
        logs: 'Raw identifiers redacted from application logs'
      },
      retention: {
        staging: '90 days (proposed)',
        committed_enrolments: 'Per official retention schedule',
        audit_events: 'Append-only; retention policy pending approval',
        exports: 'Logged and time-limited'
      },
      ruleset: { name: RULESET, version: RULE_VERSION, note: 'APAAR format rule is a documented synthetic rule for the prototype.' },
      environment: { mode: 'PROTOTYPE', data: 'SYNTHETIC' }
    });
  }

  throw notFound('API route not found.');
}

module.exports = { handleApi, getDashboard, intakeAnalytics, parseCookies };
