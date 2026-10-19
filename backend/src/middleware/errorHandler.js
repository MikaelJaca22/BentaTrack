// ApiError lets controllers throw structured HTTP errors.
export class ApiError extends Error {
  constructor(status, message, field) {
    super(message);
    this.status = status;
    this.field = field;
  }
}

// 404 handler for unknown routes.
export function notFound(req, res, next) {
  res.status(404).json({ error: { message: 'Route not found' } });
}

// Central error handler: consistent { error: { message, field? } } shape.
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  // If a response was already sent (e.g. a stream errored mid-send), we cannot
  // write another one. Delegate to Express's default handler to close the socket.
  if (res.headersSent) {
    return next(err);
  }

  // UNIQUE constraint violations -> friendly messages.
  if (err && err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
    // Two concurrent sales raced for the same receipt number. Retrying is safe:
    // the UNIQUE(owner_id, receipt_no) guarantee means no duplicate was stored.
    if (/sales\.owner_id, sales\.receipt_no|sales\.receipt_no/.test(err.message || '')) {
      return res
        .status(409)
        .json({ error: { message: 'Receipt number conflict, please retry the sale' } });
    }
    return res.status(409).json({ error: { message: 'That value is already taken' } });
  }
  if (err && err.code === 'SQLITE_CONSTRAINT_FOREIGNKEY') {
    return res.status(400).json({ error: { message: 'Referenced record does not exist' } });
  }
  // Invalid JSON from express.json()
  if (err && err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: { message: 'Request body is not valid JSON' } });
  }
  // Body larger than the express.json() limit.
  if (err && err.type === 'entity.too.large') {
    return res.status(413).json({ error: { message: 'Request body is too large' } });
  }
  const status = err.status || 500;
  const message = status === 500 ? 'Internal server error' : err.message;
  if (status === 500) {
    // eslint-disable-next-line no-console
    console.error(err);
  }
  res.status(status).json({
    error: { message, field: err.field },
  });
}
