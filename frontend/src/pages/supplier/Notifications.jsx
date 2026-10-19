import { useOutletContext } from 'react-router-dom';
import NotificationsView from '../../components/NotificationsView.jsx';

export default function SupplierNotifications() {
  const ctx = useOutletContext() || {};
  return <NotificationsView refreshUnread={ctx.refreshUnread} />;
}
