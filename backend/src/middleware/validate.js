// validate: zod wrapper. Parses req[where] and replaces it with the
// transformed data, or returns a consistent 400 error.
//
// Query strings are validated by the controllers themselves (see utils/query.js)
// rather than by this middleware, because coercion there is lenient by design:
// ?limit=abc should degrade to a default page rather than return a 400.
export function validate(schema, where = 'body') {
  return (req, res, next) => {
    const result = schema.safeParse(req[where]);
    if (!result.success) {
      const issue = result.error.issues[0] || {};
      return res.status(400).json({
        error: {
          message: issue.message || 'Invalid input',
          field: issue.path ? issue.path.join('.') : undefined,
        },
      });
    }
    req[where] = result.data;
    next();
  };
}
