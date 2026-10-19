import { Router } from 'express';
import { verifyToken } from '../middleware/auth.js';
import { list, markRead, markAllRead } from '../controllers/notifications.controller.js';

const router = Router();

router.use(verifyToken);

router.get('/', list);
// Static path before the parameterized one.
router.patch('/read-all', markAllRead);
router.patch('/:id/read', markRead);

export default router;
