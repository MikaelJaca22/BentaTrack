import { Router } from 'express';
import { verifyToken, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  list,
  create,
  update,
  remove,
  adjustStock,
  createProductSchema,
  updateProductSchema,
  stockAdjustSchema,
} from '../controllers/products.controller.js';

const router = Router();

router.use(verifyToken, requireRole('store_owner'));

router.get('/', list);
router.post('/', validate(createProductSchema), create);
router.put('/:id', validate(updateProductSchema), update);
router.delete('/:id', remove);
router.patch('/:id/stock', validate(stockAdjustSchema), adjustStock);

export default router;
