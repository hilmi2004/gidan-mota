import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck } from 'lucide-react';
import { Badge, Button, Card, EmptyState, Skeleton, useToast } from '../../components/ui';
import { apiRequest } from '../../lib/api';
import { useAppStore } from '../../stores/useAppStore';

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string;
  actionUrl?: string;
  readAt: string | null;
  createdAt: string;
}

export const NotificationsPage: React.FC = () => {
  const navigate = useNavigate();
  const { pushToast } = useToast();
  const user = useAppStore((s) => s.user);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const res = await apiRequest<{ unreadCount: number; items: NotificationItem[] }>(
        '/notifications',
      );
      setItems(res.items);
      setUnreadCount(res.unreadCount);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    void loadNotifications();
  }, [user]);

  const handleMarkAllRead = async () => {
    await apiRequest('/notifications/read-all', { method: 'POST' });
    await loadNotifications();
    pushToast({ type: 'success', title: 'All notifications marked as read' });
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink">Notifications & Alerts</h1>
          <p className="text-xs text-ink-secondary mt-0.5">
            {unreadCount} unread updates on your chats, offers, and live auctions.
          </p>
        </div>
        {unreadCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            leftIcon={<CheckCheck className="w-4 h-4" />}
            onClick={handleMarkAllRead}
          >
            Mark All Read
          </Button>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-20 w-full rounded-card" />
          <Skeleton className="h-20 w-full rounded-card" />
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Bell className="w-6 h-6" />}
          title="No notifications yet"
          description="You’ll receive instant alerts here when a buyer messages you, sends an offer, or outbids you on an auction."
        />
      ) : (
        <div className="space-y-2.5">
          {items.map((n) => (
            <Card
              key={n.id}
              interactive={Boolean(n.actionUrl)}
              onClick={() => {
                if (n.actionUrl) navigate(n.actionUrl);
              }}
              className={`flex items-start justify-between gap-4 ${
                !n.readAt ? 'border-brand-500/40 bg-emerald-500/5' : ''
              }`}
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-ink">{n.title}</span>
                  {!n.readAt && <Badge variant="phone_verified">New</Badge>}
                </div>
                <p className="text-xs text-ink-secondary">{n.body}</p>
              </div>
              <span className="text-[11px] font-mono tabular-nums text-ink-muted shrink-0">
                {new Date(n.createdAt).toLocaleTimeString('en-NG', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

