import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import Skeleton from '../components/Skeleton.jsx';

// Gate a route by auth and role. Redirects to the correct dashboard.
export default function ProtectedRoute({ role, children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray100">
        <div className="w-64 space-y-3">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (role && user.role !== role) {
    // Signed in but wrong area: send to their own dashboard.
    return (
      <Navigate
        to={user.role === 'store_owner' ? '/owner' : '/supplier'}
        replace
      />
    );
  }

  return children;
}
