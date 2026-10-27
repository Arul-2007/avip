let dbModule = null;
let loadError = null;
let handlerPromise = null;

try {
  dbModule = require('../src/db');
} catch (error) {
  loadError = error;
}

function redact(text) {
  return String(text ?? '').replace(/\b\d{12}\b/g, '[redacted-apaar]');
}

function getHandler() {
  if (!handlerPromise) {
    handlerPromise = Promise.resolve()
      .then(async () => {
        if (loadError) throw loadError;
        const { createHandler } = require('../src/server');
        const db = await dbModule.getDb();
        return createHandler(db);
      })
      .catch((error) => {
        handlerPromise = null;
        throw error;
      });
  }
  return handlerPromise;
}

module.exports = async (req, res) => {
  const correlationId = String(req.headers['x-correlation-id'] || `${Date.now()}-${Math.random().toString(16).slice(2)}`);
  try {
    const handler = await getHandler();
    return handler(req, res);
  } catch (error) {
    const message = redact(error && error.message ? error.message : 'Server startup failed.');
    console.error(`${new Date().toISOString()} STARTUP_FAILED ${message} cid=${correlationId}`);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
    }
    res.end(JSON.stringify({
      error: { code: 'STARTUP_FAILED', message },
      correlation_id: correlationId
    }));
  }
};
