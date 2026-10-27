const { CAPABILITIES, SESSION_TTL_MS, DEMO_MFA_CODE } = require('./config');
const { verifyPassword, randomToken, sha256, nowIso, uuid } = require('./security');
const { badRequest, unauthorized, forbidden } = require('./errors');

function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    display_name: user.display_name,
    role: user.role,
    institution_id: user.institution_id,
    institution_name: user.institution_name || null,
    mfa_required: Boolean(user.mfa_required),
    capabilities: CAPABILITIES[user.role] || []
  };
}

async function login(db, { email, password, mfaCode }) {
  const user = await db.prepare(`SELECT u.*, i.legal_name AS institution_name
    FROM institution_users u LEFT JOIN institutions i ON i.id = u.institution_id
    WHERE lower(u.email) = lower(?)`).get(String(email || '').trim());
  if (!user || !verifyPassword(password, user.password_hash)) {
    throw unauthorized('Invalid email or password.');
  }
  if (user.status !== 'ACTIVE') throw forbidden('This account is not active.');
  if (user.mfa_required && String(mfaCode || '') !== DEMO_MFA_CODE) {
    throw new (require('./errors').HttpError)(401, 'MFA_REQUIRED', 'A multi-factor code is required for this privileged account.');
  }
  return user;
}

async function createSession(db, userId) {
  const token = randomToken(32);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  await db.prepare('INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?,?,?,?)')
    .run(sha256(token), userId, nowIso(), expiresAt);
  await db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(nowIso());
  return { token, expiresAt };
}

async function destroySession(db, token) {
  if (!token) return;
  await db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha256(token));
}

async function getSessionUser(db, token) {
  if (!token) return null;
  const row = await db.prepare(`SELECT u.*, i.legal_name AS institution_name, s.expires_at
    FROM sessions s
    JOIN institution_users u ON u.id = s.user_id
    LEFT JOIN institutions i ON i.id = u.institution_id
    WHERE s.token_hash = ?`).get(sha256(token));
  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) {
    await destroySession(db, token);
    return null;
  }
  if (row.status !== 'ACTIVE') return null;
  return row;
}

function requireUser(user) {
  if (!user) throw unauthorized();
  return user;
}

function can(user, capability) {
  return Boolean(user && (CAPABILITIES[user.role] || []).includes(capability));
}

function requireCapability(user, capability) {
  requireUser(user);
  if (!can(user, capability)) throw forbidden();
  return user;
}

function assertInstitutionScope(user, institutionId) {
  if (!user) throw unauthorized();
  if (!user.institution_id) return;
  if (institutionId !== user.institution_id) {
    throw new (require('./errors').HttpError)(404, 'NOT_FOUND', 'The requested resource was not found.');
  }
}

function isReadOnly(user) {
  return user && (user.role === 'AUDITOR' || user.role === 'OPERATOR');
}

function requireWritable(user) {
  requireUser(user);
  if (isReadOnly(user)) throw forbidden('This role is read-only.');
  return user;
}

function verifyMfaForPrivileged(user, code) {
  if (user.mfa_required && String(code || '') !== DEMO_MFA_CODE) {
    throw badRequest('A valid MFA code is required for this action.', 'MFA_REQUIRED');
  }
}

module.exports = {
  login, createSession, destroySession, getSessionUser, publicUser,
  requireUser, can, requireCapability, assertInstitutionScope, isReadOnly, requireWritable,
  verifyMfaForPrivileged, uid: uuid
};
