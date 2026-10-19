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
  // UNIQUE constraint violations -> friendly messages.
  if (err && err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
    return res.status(409).json({ error: { message: 'That value is already taken' } });
  }
  if (err && err.code === 'SQLITE_CONSTRAINT_FOREIGNKEY') {
    return res.status(400).json({ error: { message: 'Referenced record does not exist' } });
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
