import { Router } from 'express';
import { verifyToken } from '../middleware/auth.js';
import { list, markRead, markAllRead, clearAll } from '../controllers/notifications.controller.js';

const router = Router();

router.use(verifyToken);

router.get('/', list);
// Static path before the parameterized one.
router.patch('/read-all', markAllRead);
// Clear (delete) all notifications for the authenticated user. Multiple
// method/path aliases are accepted for client compatibility.
router.delete('/', clearAll);
router.delete('/clear', clearAll);
router.delete('/clear-all', clearAll);
router.patch('/clear', clearAll);
router.patch('/clear-all', clearAll);
router.patch('/:id/read', markRead);

export default router;
