const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { DATA_DIR } = require('./config');

function ensureDataDirs() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(path.join(DATA_DIR, 'uploads'), { recursive: true });
}

function envKeys() {
  const hmac = process.env.AVIP_HMAC_KEY;
  const encryption = process.env.AVIP_ENCRYPTION_KEY;
  if (!hmac && !encryption) return null;
  if (!hmac || !encryption) {
    throw new Error('Both AVIP_HMAC_KEY and AVIP_ENCRYPTION_KEY must be set together.');
  }
  const hmacKey = Buffer.from(hmac, 'base64');
  const encKey = Buffer.from(encryption, 'base64');
  if (hmacKey.length !== 32 || encKey.length !== 32) {
    throw new Error('AVIP_HMAC_KEY and AVIP_ENCRYPTION_KEY must each be 32-byte base64 values.');
  }
  return {
    keyId: process.env.AVIP_KEY_ID || 'k1-env',
    hmacKey,
    encKey
  };
}

function loadKeys() {
  const fromEnv = envKeys();
  if (fromEnv) return fromEnv;
  ensureDataDirs();
  const file = path.join(DATA_DIR, 'keys.json');
  if (!fs.existsSync(file)) {
    const keys = {
      keyId: `k1-${new Date().getUTCFullYear()}`,
      hmacKey: crypto.randomBytes(32).toString('base64'),
      encryptionKey: crypto.randomBytes(32).toString('base64'),
      createdAt: new Date().toISOString()
    };
    fs.writeFileSync(file, JSON.stringify(keys, null, 2), { mode: 0o600 });
  }
  const keys = JSON.parse(fs.readFileSync(file, 'utf8'));
  return {
    keyId: keys.keyId,
    hmacKey: Buffer.from(keys.hmacKey, 'base64'),
    encKey: Buffer.from(keys.encryptionKey, 'base64')
  };
}

const keys = loadKeys();

function normalizeApaar(raw) {
  return String(raw ?? '').trim().replace(/[\s-]/g, '');
}

function apaarToken(raw) {
  const normalized = normalizeApaar(raw);
  if (!normalized) return null;
  return crypto.createHmac('sha256', keys.hmacKey).update(normalized).digest('hex');
}

function encryptApaar(raw) {
  const value = normalizeApaar(raw);
  if (!value) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', keys.encKey, iv);
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString('base64')}:${tag.toString('base64')}:${ciphertext.toString('base64')}`;
}

function decryptApaar(stored) {
  if (!stored) return null;
  try {
    const [version, ivB64, tagB64, dataB64] = String(stored).split(':');
    if (version !== 'v1' || !ivB64 || !tagB64 || !dataB64) return null;
    const decipher = crypto.createDecipheriv('aes-256-gcm', keys.encKey, Buffer.from(ivB64, 'base64'));
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
    return Buffer.concat([
      decipher.update(Buffer.from(dataB64, 'base64')),
      decipher.final()
    ]).toString('utf8');
  } catch {
    return null;
  }
}

function maskApaar(stored) {
  const raw = decryptApaar(stored);
  if (!raw) return 'APAAR •••• •••• ••••';
  return `APAAR •••• •••• ${raw.slice(-4)}`;
}

function last4(stored) {
  const raw = decryptApaar(stored);
  return raw ? raw.slice(-4) : null;
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function sha256Bytes(value) {
  return crypto.createHash('sha256').update(value).digest();
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const derived = crypto.scryptSync(String(password), salt, 64);
  return `scrypt$${salt.toString('hex')}$${derived.toString('hex')}`;
}

function verifyPassword(password, stored) {
  try {
    const [scheme, saltHex, hashHex] = String(stored).split('$');
    if (scheme !== 'scrypt' || !saltHex || !hashHex) return false;
    const expected = Buffer.from(hashHex, 'hex');
    const actual = crypto.scryptSync(String(password), Buffer.from(saltHex, 'hex'), expected.length);
    return crypto.timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex');
}

function uuid() {
  return crypto.randomUUID();
}

function nowIso() {
  return new Date().toISOString();
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
}

function redact(text) {
  return String(text ?? '').replace(/\b\d{12}\b/g, '[redacted-apaar]');
}

function maskSensitivePayload(payload) {
  const clone = { ...payload };
  if (clone.apaar_id) clone.apaar_id = '••••';
  if (clone.apaar) clone.apaar = '••••';
  return clone;
}

module.exports = {
  keyId: keys.keyId,
  normalizeApaar,
  apaarToken,
  encryptApaar,
  decryptApaar,
  maskApaar,
  last4,
  sha256,
  sha256Bytes,
  hashPassword,
  verifyPassword,
  randomToken,
  uuid,
  nowIso,
  safeEqual,
  stableStringify,
  redact,
  maskSensitivePayload
};
