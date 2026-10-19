import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, Package, Truck } from 'lucide-react';
import client, { extractError } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from './Toast.jsx';
import Button from './Button.jsx';
import EmptyState from './EmptyState.jsx';
import { SkeletonList } from './Skeleton.jsx';

const TYPE_ICON = {
  low_stock: Package,
  restock_new: Truck,
  restock_accepted: Truck,
  restock_delivered: Truck,
  restock_completed: Truck,
  restock_declined: Truck,
  restock_discrepancy: Truck,
};

export default function NotificationsView({ refreshUnread }) {
  const toast = useToast();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    client
      .get('/notifications')
      .then((res) => setItems(res.data.notifications))
      .catch((e) => toast.error(extractError(e).message))
      .finally(() => setLoading(false));
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  async function markRead(n) {
    try {
      await client.patch(`/notifications/${n.id}/read`);
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)));
      if (refreshUnread) refreshUnread();
      // Deep-link restock notifications to the right area for the role.
      if (n.referenceType === 'restock_request') {
        if (user.role === 'store_owner') navigate(`/owner/restock/${n.referenceId}`);
        else navigate(`/supplier/request/${n.referenceId}`);
      }
    } catch (e) {
      toast.error(extractError(e).message);
    }
  }

  async function markAll() {
    try {
      await client.patch('/notifications/read-all');
      setItems((prev) => prev.map((x) => ({ ...x, isRead: true })));
      if (refreshUnread) refreshUnread();
      toast.success('All marked read');
    } catch (e) {
      toast.error(extractError(e).message);
    }
  }

  if (loading) return <SkeletonList rows={4} />;

  return (
    <div className="space-y-4">
      <div className="flex justify-end no-print">
        {items.some((n) => !n.isRead) ? (
          <Button variant="secondary" icon={CheckCheck} onClick={markAll}>
            Mark all read
          </Button>
        ) : null}
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="No notifications"
          hint="Low-stock alerts and restock updates will appear here."
        />
      ) : (
        <div className="bg-white border border-gray200 rounded-xl divide-y divide-gray200">
          {items.map((n) => {
            const Icon = TYPE_ICON[n.type] || Bell;
            return (
              <button
                key={n.id}
                onClick={() => !n.isRead && markRead(n)}
                className={`w-full flex gap-3 px-4 py-3 text-left ${
                  n.isRead ? 'opacity-60' : 'hover:bg-gray100'
                }`}
              >
                <span className="mt-0.5 text-gray600 shrink-0">
                  <Icon size={18} />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="flex items-center gap-2">
                    <span className="text-sm font-medium text-ink">{n.title}</span>
                    {!n.isRead ? (
                      <span className="w-2 h-2 rounded-full bg-black shrink-0" aria-label="unread" />
                    ) : null}
                  </span>
                  <span className="block text-xs text-gray600 mt-0.5">{n.body}</span>
                  <span className="block text-[11px] text-gray400 mt-0.5">{n.createdAt}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
