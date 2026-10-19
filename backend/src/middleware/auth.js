import jwt from 'jsonwebtoken';
import env from '../config/env.js';
import db from '../db/connection.js';

// verifyToken: extract Bearer JWT, validate, load the user, attach to req.user.
export function verifyToken(req, res, next) {
  const header = req.headers.authorization || '';
  const parts = header.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer' || !parts[1]) {
    return res.status(401).json({ error: { message: 'Authentication required' } });
  }
  let payload;
  try {
    payload = jwt.verify(parts[1], env.jwtSecret);
  } catch {
    return res.status(401).json({ error: { message: 'Invalid or expired token' } });
  }
  const user = db
    .prepare('SELECT id, role, name, username FROM users WHERE id = ?')
    .get(payload.sub);
  if (!user) {
    return res.status(401).json({ error: { message: 'Account no longer exists' } });
  }
  req.user = user;
  next();
}

// requireRole: restrict a route to one or more roles.
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: { message: 'Authentication required' } });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: { message: 'Insufficient permissions' } });
    }
    next();
  };
}
