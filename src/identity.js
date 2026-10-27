const { decryptApaar, sha256, nowIso, uuid } = require('./security');

function mockVerify({ apaarCiphertext, correlationId }) {
  const checkedAt = nowIso();
  const raw = decryptApaar(apaarCiphertext);
  if (!raw) {
    return {
      status: 'INVALID',
      providerReference: `MOCK-${uuid().slice(0, 8)}`,
      checkedAt,
      reasonCode: 'PROTECTED_REFERENCE_UNREADABLE'
    };
  }
  if (process.env.MOCK_PROVIDER_DOWN === '1') {
    return {
      status: 'UNAVAILABLE',
      providerReference: null,
      checkedAt,
      reasonCode: 'PROVIDER_UNAVAILABLE'
    };
  }
  const lastDigit = raw.slice(-1);
  const reference = `MOCK-${sha256(`${raw}:${correlationId}`).slice(0, 12).toUpperCase()}`;
  if (lastDigit === '0') {
    return { status: 'INVALID', providerReference: reference, checkedAt, reasonCode: 'APAAR_NOT_FOUND' };
  }
  if (lastDigit === '7') {
    return { status: 'PENDING', providerReference: reference, checkedAt, reasonCode: 'PROVIDER_TIMEOUT_RETRYABLE' };
  }
  if (lastDigit === '9') {
    return { status: 'MISMATCH', providerReference: reference, checkedAt, reasonCode: 'DEMOGRAPHIC_MISMATCH' };
  }
  return { status: 'VERIFIED', providerReference: reference, checkedAt, reasonCode: null };
}

module.exports = { mockVerify };
