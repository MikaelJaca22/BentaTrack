import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import db from '../db/connection.js';
import env from '../config/env.js';
import { ApiError } from '../middleware/errorHandler.js';

const usernameRe = /^[A-Za-z0-9_.]{4,20}$/;

export const registerSchema = z.object({
  role: z.enum(['store_owner', 'supplier'], {
    errorMap: () => ({ message: 'Account type must be Store Owner or Supplier' }),
  }),
  name: z.string().trim().min(1, 'Name is required').max(120),
  username: z
    .string()
    .trim()
    .regex(usernameRe, 'Username must be 4-20 chars: letters, numbers, underscore, period'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const loginSchema = z.object({
  username: z.string().trim().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});

function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, env.jwtSecret, { expiresIn: '7d' });
}

function publicUser(user) {
  return { id: user.id, role: user.role, name: user.name, username: user.username };
}

export function register(req, res, next) {
  try {
    const { role, name, username, password } = req.body;
    const existing = db
      .prepare('SELECT id FROM users WHERE username = ?')
      .get(username);
    if (existing) {
      throw new ApiError(409, 'That username is already taken', 'username');
    }
    const hash = bcrypt.hashSync(password, 10);
    const info = db
      .prepare(
        'INSERT INTO users (role, name, username, password_hash) VALUES (?, ?, ?, ?)'
      )
      .run(role, name, username, hash);
    const user = db
      .prepare('SELECT id, role, name, username FROM users WHERE id = ?')
      .get(info.lastInsertRowid);
    res.status(201).json({ token: signToken(user), user: publicUser(user) });
  } catch (e) {
    next(e);
  }
}

export function login(req, res, next) {
  try {
    const { username, password } = req.body;
    const user = db
      .prepare('SELECT * FROM users WHERE username = ?')
      .get(username);
    // Generic message for both unknown user and bad password.
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      throw new ApiError(401, 'Invalid username or password');
    }
    res.json({ token: signToken(user), user: publicUser(user) });
  } catch (e) {
    next(e);
  }
}

export function me(req, res) {
  res.json({ user: req.user });
}
