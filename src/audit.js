const { sha256, stableStringify, uuid, nowIso } = require('./security');

async function appendAudit(db, event) {
  return db.transaction(async () => {
    await db.query('SELECT pg_advisory_xact_lock(7629173)');
    const previous = await db.prepare('SELECT event_hash FROM audit_events ORDER BY seq DESC LIMIT 1').get();
    const occurredAt = event.occurredAt || nowIso();
    const metadata = event.metadata ? stableStringify(event.metadata) : null;
    const base = {
      occurred_at: occurredAt,
      actor_type: event.actorType || 'user',
      actor_id: event.actorId || null,
      actor_label: event.actorLabel || null,
      institution_id: event.institutionId || null,
      action: event.action,
      entity_type: event.entityType,
      entity_id: event.entityId || null,
      entity_version: event.entityVersion ?? null,
      reason_code: event.reasonCode || null,
      before_digest: event.beforeDigest || null,
      after_digest: event.afterDigest || null,
      previous_event_hash: previous ? previous.event_hash : null,
      correlation_id: event.correlationId || null,
      metadata
    };
    const eventHash = sha256(stableStringify(base));
    const id = uuid();
    await db.prepare(`INSERT INTO audit_events
      (id, occurred_at, actor_type, actor_id, actor_label, institution_id, action,
       entity_type, entity_id, entity_version, reason_code, before_digest, after_digest,
       previous_event_hash, event_hash, correlation_id, metadata)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      id,
      base.occurred_at,
      base.actor_type,
      base.actor_id,
      base.actor_label,
      base.institution_id,
      base.action,
      base.entity_type,
      base.entity_id,
      base.entity_version,
      base.reason_code,
      base.before_digest,
      base.after_digest,
      base.previous_event_hash,
      eventHash,
      base.correlation_id,
      base.metadata
    );
    return { id, eventHash };
  });
}

async function auditFor(db, user, event) {
  return appendAudit(db, {
    ...event,
    actorType: user ? user.role : 'system',
    actorId: user ? user.id : null,
    actorLabel: user ? user.display_name : 'System',
    institutionId: event.institutionId !== undefined ? event.institutionId : (user ? user.institution_id : null)
  });
}

async function enqueueOutbox(db, { aggregateType, aggregateId, eventType, payload }) {
  await db.prepare(`INSERT INTO outbox_events
    (id, aggregate_type, aggregate_id, event_type, payload, created_at, attempts, status)
    VALUES (?,?,?,?,?,?,0,'PENDING')`).run(
    uuid(),
    aggregateType,
    aggregateId,
    eventType,
    stableStringify(payload || {}),
    nowIso()
  );
}

async function verifyAuditChain(db) {
  const rows = await db.prepare('SELECT * FROM audit_events ORDER BY seq ASC').all();
  let previous = null;
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const base = {
      occurred_at: row.occurred_at,
      actor_type: row.actor_type,
      actor_id: row.actor_id,
      actor_label: row.actor_label,
      institution_id: row.institution_id,
      action: row.action,
      entity_type: row.entity_type,
      entity_id: row.entity_id,
      entity_version: row.entity_version,
      reason_code: row.reason_code,
      before_digest: row.before_digest,
      after_digest: row.after_digest,
      previous_event_hash: row.previous_event_hash,
      correlation_id: row.correlation_id,
      metadata: row.metadata
    };
    const expected = sha256(stableStringify(base));
    if (expected !== row.event_hash || row.previous_event_hash !== previous) {
      return { valid: false, checked: index + 1, total: rows.length, brokenAt: row.id };
    }
    previous = row.event_hash;
  }
  return { valid: true, checked: rows.length, total: rows.length, brokenAt: null };
}

module.exports = { appendAudit, auditFor, enqueueOutbox, verifyAuditChain };
