import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { ToastProvider } from './components/Toast.jsx';
import ProtectedRoute from './routes/ProtectedRoute.jsx';
import AppLayout from './components/AppLayout.jsx';

import Login from './pages/auth/Login.jsx';
import CreateAccount from './pages/auth/CreateAccount.jsx';

import OwnerDashboard from './pages/owner/Dashboard.jsx';
import NewSale from './pages/owner/NewSale.jsx';
import Receipt from './pages/owner/Receipt.jsx';
import Products from './pages/owner/Products.jsx';
import Restock from './pages/owner/Restock.jsx';
import RestockDetail from './pages/owner/RestockDetail.jsx';
import Suppliers from './pages/owner/Suppliers.jsx';
import Reports from './pages/owner/Reports.jsx';
import OwnerNotifications from './pages/owner/Notifications.jsx';

import SupplierDashboard from './pages/supplier/Dashboard.jsx';
import Requests from './pages/supplier/Requests.jsx';
import RequestDetail from './pages/supplier/RequestDetail.jsx';
import History from './pages/supplier/History.jsx';
import SupplierNotifications from './pages/supplier/Notifications.jsx';

// Redirect "/" to the right dashboard based on auth.
function Home() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={user.role === 'store_owner' ? '/owner' : '/supplier'} replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/create-account" element={<CreateAccount />} />

            {/* Store Owner */}
            <Route
              path="/owner"
              element={
                <ProtectedRoute role="store_owner">
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<OwnerDashboard />} />
              <Route path="sale" element={<NewSale />} />
              <Route path="receipt/:id" element={<Receipt />} />
              <Route path="products" element={<Products />} />
              <Route path="restock" element={<Restock />} />
              <Route path="restock/:id" element={<RestockDetail />} />
              <Route path="suppliers" element={<Suppliers />} />
              <Route path="reports" element={<Reports />} />
              <Route path="notifications" element={<OwnerNotifications />} />
            </Route>

            {/* Supplier */}
            <Route
              path="/supplier"
              element={
                <ProtectedRoute role="supplier">
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<SupplierDashboard />} />
              <Route path="requests" element={<Requests />} />
              <Route path="request/:id" element={<RequestDetail />} />
              <Route path="history" element={<History />} />
              <Route path="notifications" element={<SupplierNotifications />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  );
}
