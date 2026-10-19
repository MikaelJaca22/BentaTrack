// validate: zod wrapper. Parses req[where] and replaces it with the
// transformed data, or returns a consistent 400 error.
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
    if (where === 'query') {
      // Express 5 makes req.query a getter; expose parsed value separately.
      req.validatedQuery = result.data;
    } else {
      req[where] = result.data;
    }
    next();
  };
}
