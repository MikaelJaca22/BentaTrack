import { Router } from 'express';
import { verifyToken, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  linked,
  search,
  link,
  unlink,
  linkSchema,
} from '../controllers/suppliers.controller.js';

const router = Router();

router.use(verifyToken, requireRole('store_owner'));

router.get('/linked', linked);
router.get('/search', search);
router.post('/link', validate(linkSchema), link);
router.delete('/link/:supplierId', unlink);

export default router;
