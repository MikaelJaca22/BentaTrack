import { Router } from 'express';
import { verifyToken, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  create,
  list,
  getById,
  decline,
  accept,
  deliver,
  verify,
  discrepancy,
  resend,
  createRequestSchema,
  declineSchema,
  deliverSchema,
  verifySchema,
  discrepancySchema,
  resendSchema,
} from '../controllers/restock.controller.js';

const router = Router();

router.use(verifyToken);

// Both roles can list and view (controller filters by caller).
router.get('/', list);
router.get('/:id', getById);

// Store owner actions.
router.post('/', requireRole('store_owner'), validate(createRequestSchema), create);
router.post('/:id/verify', requireRole('store_owner'), validate(verifySchema), verify);
router.post(
  '/:id/discrepancy',
  requireRole('store_owner'),
  validate(discrepancySchema),
  discrepancy
);
router.post('/:id/resend', requireRole('store_owner'), validate(resendSchema), resend);

// Supplier actions.
router.post('/:id/decline', requireRole('supplier'), validate(declineSchema), decline);
router.post('/:id/accept', requireRole('supplier'), accept);
router.post('/:id/deliver', requireRole('supplier'), validate(deliverSchema), deliver);

export default router;
