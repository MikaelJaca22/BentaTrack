import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { verifyToken } from '../middleware/auth.js';
import {
  register,
  login,
  me,
  registerSchema,
  loginSchema,
} from '../controllers/auth.controller.js';

const router = Router();

router.post('/register', validate(registerSchema), register);
router.post('/login', validate(loginSchema), login);
router.get('/me', verifyToken, me);

export default router;
