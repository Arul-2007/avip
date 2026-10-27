const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { PORT, HOST, ROOT } = require('./config');
const { getDb, closeDb } = require('./db');
const { handleApi } = require('./api');
const { HttpError, notFound, tooMany, tooLarge } = require('./errors');
const { uuid, nowIso, redact } = require('./security');

const PUBLIC_DIR = path.join(ROOT, 'public');
const MAX_BODY_BYTES = 6 * 1024 * 1024;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8'
};

const rateBuckets = new Map();

function rateLimit(key, limit, windowMs) {
  const now = Date.now();
  let bucket = rateBuckets.get(key);
  if (!bucket || now > bucket.resetAt) {
    bucket = { count: 0, resetAt: now + windowMs };
    rateBuckets.set(key, bucket);
  }
  bucket.count += 1;
  if (bucket.count > limit) throw tooMany();
}

setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of rateBuckets) {
    if (now > bucket.resetAt) rateBuckets.delete(key);
  }
}, 60_000).unref();

function securityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Content-Security-Policy',
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; " +
    "connect-src 'self'; font-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(tooLarge());
        req.pause();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function parseRawBody(raw, contentType) {
  if (!raw) return null;
  if (contentType.includes('application/json')) {
    try {
      return JSON.parse(raw);
    } catch {
      throw new HttpError(400, 'INVALID_JSON', 'Request body must be valid JSON.');
    }
  }
  return { content: raw };
}

function serveStatic(req, res, pathname) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { 'Content-Type': 'application/json; charset=utf-8', Allow: 'GET, HEAD' });
    return res.end(JSON.stringify({ error: { code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed.' } }));
  }
  let relative = decodeURIComponent(pathname);
  if (relative === '/' || relative === '') relative = '/index.html';
  const target = path.resolve(PUBLIC_DIR, `.${relative}`);
  if (!target.startsWith(PUBLIC_DIR + path.sep) && target !== PUBLIC_DIR) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('Forbidden');
  }
  let file = target;
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(PUBLIC_DIR, 'index.html');
  const ext = path.extname(file).toLowerCase();
  const type = MIME[ext] || 'application/octet-stream';
  const content = fs.readFileSync(file);
  res.writeHead(200, {
    'Content-Type': type,
    'Content-Length': content.length,
    'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=300'
  });
  if (req.method === 'HEAD') return res.end();
  res.end(content);
}

function createHandler(db) {
  return async (req, res) => {
    const started = Date.now();
    const correlationId = String(req.headers['x-correlation-id'] || uuid());
    req.correlationId = correlationId;
    securityHeaders(res);
    res.setHeader('X-Correlation-ID', correlationId);

    let url;
    try {
      url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    } catch {
      res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('Bad request');
    }

    const ip = req.socket.remoteAddress || 'unknown';
    try {
      if (url.pathname.startsWith('/api/v1/')) {
        rateLimit(`api:${ip}`, 600, 60_000);
        if (url.pathname === '/api/v1/auth/login' && req.method === 'POST') {
          rateLimit(`login:${ip}`, 10, 5 * 60_000);
        }
        let body = null;
        if (!['GET', 'HEAD'].includes(req.method)) {
          const contentType = String(req.headers['content-type'] || '');
          let preParsed;
          try {
            preParsed = req.body;
          } catch {
            throw new HttpError(400, 'INVALID_JSON', 'Request body must be valid JSON.');
          }
          if (preParsed !== undefined && preParsed !== null) {
            body = (typeof preParsed === 'string' || Buffer.isBuffer(preParsed))
              ? parseRawBody(preParsed.toString(), contentType)
              : preParsed;
          } else {
            body = parseRawBody(await readBody(req), contentType);
          }
        }
        await handleApi({ req, res, db, url, body });
      } else {
        serveStatic(req, res, url.pathname);
      }
    } catch (error) {
      if (res.headersSent) {
        if (!res.writableEnded) res.end();
      } else if (error instanceof HttpError) {
        res.writeHead(error.status, {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-store'
        });
        res.end(JSON.stringify({
          error: { code: error.code, message: error.message, details: error.details || null },
          correlation_id: correlationId
        }));
      } else {
        console.error(`[${nowIso()}] ${redact(error && error.stack ? error.stack : error)}`);
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
        res.end(JSON.stringify({
          error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred. Reference the correlation ID when contacting support.' },
          correlation_id: correlationId
        }));
      }
    } finally {
      const duration = Date.now() - started;
      console.log(`${nowIso()} ${req.method} ${url.pathname} ${res.statusCode || '-'} ${duration}ms cid=${correlationId}`);
    }
  };
}

function createApp(db) {
  return http.createServer(createHandler(db));
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`[${nowIso()}] Startup failed: ${redact(error && error.stack ? error.stack : error)}`);
    process.exit(1);
  });
}

async function main() {
  const db = await getDb();
  const server = createApp(db);
  server.listen(PORT, HOST, () => {
    console.log('');
    console.log('  AVIP — APAAR Verify Intelligence Platform (prototype)');
    console.log(`  URL: http://${HOST}:${PORT}`);
    console.log('  Data: SYNTHETIC ONLY — identity verification is simulated');
    console.log('');
    console.log('  Demo accounts (password: Demo@1234)');
    console.log('   admin@aicte.demo      AICTE Administrator (MFA code 246810)');
    console.log('   registrar@sit.demo    Institution Administrator');
    console.log('   submitter@sit.demo    Institution Data Submitter');
    console.log('   verifier@aicte.demo   Verification Officer');
    console.log('   auditor@aicte.demo    Auditor (read-only)');
    console.log('   operator@aicte.demo   System Operator');
    console.log('');
  });
  const shutdown = () => {
    console.log('\nShutting down AVIP...');
    server.close(async () => {
      try {
        await closeDb();
      } catch (error) {
        console.error(`[${nowIso()}] Failed to close database: ${redact(error && error.stack ? error.stack : error)}`);
      }
      process.exit(0);
    });
    setTimeout(() => process.exit(0), 3000).unref();
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

module.exports = { createApp, createHandler };
