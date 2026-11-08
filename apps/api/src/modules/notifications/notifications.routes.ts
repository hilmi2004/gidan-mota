import { Router, type Request, type Response, type NextFunction } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { NotificationModel } from '../../models/index.js';

export const notificationsRouter = Router();

notificationsRouter.get(
  '/notifications',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.sub;
      const [items, unreadCount] = await Promise.all([
        NotificationModel.find({ userId }).sort({ createdAt: -1 }).limit(50).lean(),
        NotificationModel.countDocuments({ userId, readAt: null }),
      ]);

      res.status(200).json({
        unreadCount,
        items: items.map((n) => ({
          id: n._id.toString(),
          type: n.type,
          title: n.title,
          body: n.body,
          actionUrl: n.actionUrl,
          readAt: n.readAt ? n.readAt.toISOString() : null,
          createdAt: n.createdAt.toISOString(),
        })),
      });
    } catch (err) {
      next(err);
    }
  },
);

notificationsRouter.post(
  '/notifications/:id/read',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await NotificationModel.findOneAndUpdate(
        { _id: req.params.id, userId: req.user!.sub },
        { $set: { readAt: new Date() } },
      );
      res.status(200).json({ message: 'Notification marked as read.' });
    } catch (err) {
      next(err);
    }
  },
);

notificationsRouter.post(
  '/notifications/read-all',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await NotificationModel.updateMany(
        { userId: req.user!.sub, readAt: null },
        { $set: { readAt: new Date() } },
      );
      res.status(200).json({ message: 'All notifications marked as read.' });
    } catch (err) {
      next(err);
    }
  },
);

