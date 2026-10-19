import { Router } from 'express';
import { verifyToken, requireRole } from '../middleware/auth.js';
import { sales, inventory, restock } from '../controllers/reports.controller.js';

const router = Router();

router.use(verifyToken, requireRole('store_owner'));

router.get('/sales', sales);
router.get('/inventory', inventory);
router.get('/restock', restock);

export default router;
