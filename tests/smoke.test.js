'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'avip-test-'));
process.env.AVIP_DATA_DIR = tempDir;

const { DATABASE_URL } = require('../src/config');
const { openDatabase, closeDb } = require('../src/db');
const { createApp } = require('../src/server');

function cookieFrom(response) {
  const header = response.headers.get('set-cookie') || '';
  return header.split(';')[0];
}

async function login(base, email, password, mfaCode) {
  const response = await fetch(`${base}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, mfaCode })
  });
  return response;
}

test('AVIP end-to-end smoke flow', { skip: !DATABASE_URL && 'DATABASE_URL is not configured' }, async (t) => {
  const db = await openDatabase();
  const server = createApp(db);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await closeDb();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  const health = await fetch(`${base}/api/v1/health`).then((response) => response.json());
  assert.equal(health.status, 'ok');
  assert.equal(health.ruleset, 'AVIP-RULES-1.0.0');

  const unauth = await fetch(`${base}/api/v1/dashboard`);
  assert.equal(unauth.status, 401);

  const noMfa = await login(base, 'admin@aicte.demo', 'Demo@1234', '');
  assert.equal(noMfa.status, 401);
  assert.equal((await noMfa.json()).error.code, 'MFA_REQUIRED');

  const response = await login(base, 'admin@aicte.demo', 'Demo@1234', '246810');
  assert.equal(response.status, 200);
  const cookie = cookieFrom(response);
  assert.match(cookie, /^session_token=/);
  const headers = { Cookie: cookie };

  const dashboard = await fetch(`${base}/api/v1/dashboard`, { headers }).then((res) => res.json());
  assert.equal(dashboard.counts.institutions, 3);
  assert.equal(dashboard.counts.conflicts_open, 1);
  assert.equal(dashboard.counts.ready_for_review, 1);

  const imports = await fetch(`${base}/api/v1/imports`, { headers }).then((res) => res.json());
  const ready = imports.items.find((batch) => batch.status === 'READY_FOR_REVIEW');
  assert.ok(ready, 'seeded READY_FOR_REVIEW batch exists');

  const detail = await fetch(`${base}/api/v1/imports/${ready.id}`, { headers }).then((res) => res.json());
  assert.ok(detail.batch.rows.length >= 2);
  assert.equal(detail.batch.counts.error, 0);

  const approved = await fetch(`${base}/api/v1/imports/${ready.id}/approve`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason_code: 'SMOKE_TEST_APPROVAL' })
  });
  assert.equal(approved.status, 200);
  assert.equal((await approved.json()).batch.status, 'APPROVED');

  const committed = await fetch(`${base}/api/v1/imports/${ready.id}/commit`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: '{}'
  });
  assert.equal(committed.status, 201);
  const commitBody = await committed.json();
  assert.equal(commitBody.created, 2);
  assert.equal(commitBody.batch.status, 'COMMITTED');

  const pending = await fetch(`${base}/api/v1/identity/pending`, { headers }).then((res) => res.json());
  assert.ok(pending.items.length > 0);
  const check = await fetch(`${base}/api/v1/identity-checks/${pending.items[0].enrolment_id}/verify`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: '{}'
  });
  assert.equal(check.status, 200);
  assert.ok((await check.json()).student_identity_status);

  const analytics = await fetch(`${base}/api/v1/analytics/intake?academic_year=2026-27`, { headers }).then((res) => res.json());
  assert.equal(analytics.academic_year, '2026-27');
  assert.ok(analytics.rows.length >= 4);

  const csv = await fetch(`${base}/api/v1/reports/intake.csv?academic_year=2026-27`, { headers });
  assert.equal(csv.status, 200);
  assert.match(csv.headers.get('content-type'), /text\/csv/);
  assert.match(await csv.text(), /^institution,programme_code/);

  const audit = await fetch(`${base}/api/v1/audit/verify`, { headers }).then((res) => res.json());
  assert.equal(audit.valid, true);
  assert.ok(audit.checked > 0);

  const operatorResponse = await login(base, 'operator@aicte.demo', 'Demo@1234', '');
  assert.equal(operatorResponse.status, 200);
  const operatorCookie = cookieFrom(operatorResponse);
  const forbidden = await fetch(`${base}/api/v1/institutions`, {
    method: 'POST',
    headers: { Cookie: operatorCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ legal_name: 'Unauthorised Institute', approval_status: 'ACTIVE' })
  });
  assert.equal(forbidden.status, 403);
});
