class HttpError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const badRequest = (message, code = 'VALIDATION_ERROR', details) => new HttpError(400, code, message, details);
const unauthorized = (message = 'Authentication required.') => new HttpError(401, 'UNAUTHENTICATED', message);
const forbidden = (message = 'You do not have permission to perform this action.') => new HttpError(403, 'FORBIDDEN', message);
const notFound = (message = 'The requested resource was not found.') => new HttpError(404, 'NOT_FOUND', message);
const conflict = (message, code = 'CONFLICT') => new HttpError(409, code, message);
const tooLarge = (message = 'Request is too large.') => new HttpError(413, 'PAYLOAD_TOO_LARGE', message);
const tooMany = (message = 'Too many requests. Please retry shortly.') => new HttpError(429, 'RATE_LIMITED', message);

module.exports = {
  HttpError, badRequest, unauthorized, forbidden, notFound, conflict, tooLarge, tooMany
};
