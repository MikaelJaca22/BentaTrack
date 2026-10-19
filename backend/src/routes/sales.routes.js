import { Router } from 'express';
import { verifyToken, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  create,
  list,
  getById,
  createSaleSchema,
} from '../controllers/sales.controller.js';

const router = Router();

router.use(verifyToken, requireRole('store_owner'));

router.post('/', validate(createSaleSchema), create);
router.get('/', list);
router.get('/:id', getById);

export default router;
