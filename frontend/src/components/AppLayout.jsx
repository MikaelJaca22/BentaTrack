import { useEffect, useState, useCallback } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import client from '../api/client.js';
import BottomNav from './BottomNav.jsx';
import TopBar from './TopBar.jsx';

const OWNER_NAV = [
  { to: '/owner', label: 'Dashboard', short: 'Home', icon: 'LayoutDashboard', end: true },
  { to: '/owner/sale', label: 'New Sale', short: 'Sale', icon: 'ShoppingCart' },
  { to: '/owner/products', label: 'Products', short: 'Stock', icon: 'Package' },
  { to: '/owner/restock', label: 'Restock', short: 'Restock', icon: 'Truck' },
  { to: '/owner/suppliers', label: 'Suppliers', short: 'Suppliers', icon: 'Users' },
  { to: '/owner/reports', label: 'Reports', short: 'Reports', icon: 'BarChart3' },
  { to: '/owner/notifications', label: 'Notifications', short: 'Alerts', icon: 'Bell' },
];

const SUPPLIER_NAV = [
  { to: '/supplier', label: 'Dashboard', short: 'Home', icon: 'LayoutDashboard', end: true },
  { to: '/supplier/requests', label: 'Requests', short: 'Requests', icon: 'Inbox' },
  { to: '/supplier/history', label: 'History', short: 'History', icon: 'History' },
  { to: '/supplier/notifications', label: 'Notifications', short: 'Alerts', icon: 'Bell' },
];

const ICONS = {};

// Lazily import lucide icons by name to keep nav data serializable.
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Truck,
  Users,
  BarChart3,
  Bell,
  Inbox,
  History,
} from 'lucide-react';
Object.assign(ICONS, {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Truck,
  Users,
  BarChart3,
  Bell,
  Inbox,
  History,
});

export default function AppLayout() {
  const { pathname } = useLocation();
  const [unread, setUnread] = useState(0);
  const role = pathname.startsWith('/supplier') ? 'supplier' : 'store_owner';
  const navBase = role === 'supplier' ? '/supplier' : '/owner';
  const baseNav = role === 'supplier' ? SUPPLIER_NAV : OWNER_NAV;

  const items = baseNav.map((n) => ({
    ...n,
    icon: ICONS[n.icon],
    badge: n.icon === 'Bell' ? unread : 0,
  }));

  const refreshUnread = useCallback(() => {
    client
      // limit=1 is enough: unreadCount is a COUNT(*) over the whole set, so it
      // is accurate without transferring every unread notification.
      .get('/notifications?unread=true&limit=1')
      .then((res) => setUnread(res.data.unreadCount))
      .catch(() => {});
  }, []);

  // Poll unread count lightly on route changes.
  useEffect(() => {
    refreshUnread();
    const t = setInterval(refreshUnread, 5000);
    return () => clearInterval(t);
  }, [refreshUnread, pathname]);

  return (
    <div className="min-h-screen flex flex-col bg-gray100">
      <TopBar
        unread={unread}
        notificationsPath={`${navBase}/notifications`}
      />
      <main className="flex-1 px-4 md:px-8 py-5 pb-28 max-w-5xl w-full mx-auto">
        <Outlet context={{ refreshUnread }} />
      </main>
      <BottomNav items={items} />
    </div>
  );
}
