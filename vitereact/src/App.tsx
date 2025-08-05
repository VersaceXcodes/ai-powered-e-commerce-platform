import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAppStore } from '@/store/main';

/* Views */
import GV_TopNav from '@/components/views/GV_TopNav.tsx';
import GV_Footer from '@/components/views/GV_Footer.tsx';
import GV_NotificationToasts from '@/components/views/GV_NotificationToasts.tsx';
import GV_NotificationCenter from '@/components/views/GV_NotificationCenter.tsx';
import GV_Modals from '@/components/views/GV_Modals.tsx';
import UV_Landing from '@/components/views/UV_Landing.tsx';
import UV_ProductList from '@/components/views/UV_ProductList.tsx';
import UV_ProductDetail from '@/components/views/UV_ProductDetail.tsx';
import UV_CartModal from '@/components/views/UV_CartModal.tsx';
import UV_Checkout from '@/components/views/UV_Checkout.tsx';
import UV_OrderConfirmation from '@/components/views/UV_OrderConfirmation.tsx';
import UV_OrderHistory from '@/components/views/UV_OrderHistory.tsx';
import UV_OrderDetail from '@/components/views/UV_OrderDetail.tsx';
import UV_WishlistModal from '@/components/views/UV_WishlistModal.tsx';
import UV_Profile from '@/components/views/UV_Profile.tsx';
import UV_Auth_Login from '@/components/views/UV_Auth_Login.tsx';
import UV_Auth_Register from '@/components/views/UV_Auth_Register.tsx';
import UV_Auth_PasswordResetRequest from '@/components/views/UV_Auth_PasswordResetRequest.tsx';
import UV_Auth_PasswordReset from '@/components/views/UV_Auth_PasswordReset.tsx';
import UV_404 from '@/components/views/UV_404.tsx';
import UV_AdminDashboard from '@/components/views/UV_AdminDashboard.tsx';
import UV_Admin_Products from '@/components/views/UV_Admin_Products.tsx';
import UV_Admin_ProductEdit from '@/components/views/UV_Admin_ProductEdit.tsx';
import UV_Admin_Orders from '@/components/views/UV_Admin_Orders.tsx';
import UV_Admin_OrderDetail from '@/components/views/UV_Admin_OrderDetail.tsx';
import UV_Admin_Users from '@/components/views/UV_Admin_Users.tsx';
import UV_Admin_Categories from '@/components/views/UV_Admin_Categories.tsx';
import UV_Admin_Analytics from '@/components/views/UV_Admin_Analytics.tsx';
import UV_Admin_Reviews from '@/components/views/UV_Admin_Reviews.tsx';
import UV_Admin_Notifications from '@/components/views/UV_Admin_Notifications.tsx';
import UV_VendorDashboard from '@/components/views/UV_VendorDashboard.tsx';
import UV_Vendor_Products from '@/components/views/UV_Vendor_Products.tsx';
import UV_Vendor_ProductEdit from '@/components/views/UV_Vendor_ProductEdit.tsx';
import UV_Vendor_Orders from '@/components/views/UV_Vendor_Orders.tsx';
import UV_Vendor_OrderDetail from '@/components/views/UV_Vendor_OrderDetail.tsx';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 1,
    },
  },
});

// --- Loading Spinner ---
const LoadingSpinner: React.FC = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
  </div>
);

// --- Protected Route Wrapper ---
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const isAuthenticated = useAppStore(state => state.authentication_state.authentication_status.is_authenticated);
  const isLoading = useAppStore(state => state.authentication_state.authentication_status.is_loading);

  if (isLoading) return <LoadingSpinner />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

// --- Admin Route Wrapper ---
const AdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const isAuthenticated = useAppStore(state => state.authentication_state.authentication_status.is_authenticated);
  const isLoading = useAppStore(state => state.authentication_state.authentication_status.is_loading);
  const user = useAppStore(state => state.authentication_state.current_user);

  if (isLoading) return <LoadingSpinner />;
  if (!isAuthenticated || !user || user.role !== 'admin') return <Navigate to="/" replace />;
  return <>{children}</>;
};

// --- Vendor Route Wrapper ---
const VendorRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const isAuthenticated = useAppStore(state => state.authentication_state.authentication_status.is_authenticated);
  const isLoading = useAppStore(state => state.authentication_state.authentication_status.is_loading);
  const user = useAppStore(state => state.authentication_state.current_user);

  if (isLoading) return <LoadingSpinner />;
  if (!isAuthenticated || !user || user.role !== 'vendor') return <Navigate to="/" replace />;
  return <>{children}</>;
};

// --- Views that use minimal/no chrome (NO TopNav/Footer/Toasts/Notifs/Modals) ---
const AUTH_MINIMAL_PATHS = [
  '/login',
  '/register',
  '/password-reset-request',
  '/password-reset',
  '/404'
];

function useShowGlobalChrome() {
  // We want global UI for all except minimal/standalone views
  const location = useLocation();
  return !(
    location.pathname === '/login' ||
    location.pathname === '/register' ||
    location.pathname === '/password-reset-request' ||
    location.pathname.startsWith('/password-reset') ||
    location.pathname === '/404'
  );
}

const App: React.FC = () => {
  // Zustand selectors (ALWAYS individual selectors!)
  const isLoading = useAppStore(state => state.authentication_state.authentication_status.is_loading);
  const initializeAuth = useAppStore(state => state.initialize_auth);

  useEffect(() => {
    initializeAuth();
    // eslint-disable-next-line
  }, []);

  if (isLoading) {
    return <LoadingSpinner />;
  }

  // App routes and shared chrome
  return (
    <Router>
      <QueryClientProvider client={queryClient}>
        <AppLayout />
      </QueryClientProvider>
    </Router>
  );
};

// Split out as wrapper to use useLocation inside component under Router
const AppLayout: React.FC = () => {
  const showGlobalChrome = useShowGlobalChrome();

  // NOTE: CartModal and WishlistModal should be controlled by state elsewhere (likely via modals context/store).
  return (
    <div className="flex flex-col min-h-screen bg-white relative">
      {showGlobalChrome && (
        <>
          {/* Top Nav */}
          <GV_TopNav />
        </>
      )}

      <main className="flex-1 flex flex-col">
        <Routes>
          {/* --- PUBLIC ROUTES --- */}
          <Route path="/" element={<UV_Landing />} />
          <Route path="/products" element={<UV_ProductList />} />
          <Route path="/products/:id" element={<UV_ProductDetail />} />
          <Route path="/login" element={<UV_Auth_Login />} />
          <Route path="/register" element={<UV_Auth_Register />} />
          <Route path="/password-reset-request" element={<UV_Auth_PasswordResetRequest />} />
          <Route path="/password-reset/:token" element={<UV_Auth_PasswordReset />} />

          {/* --- PROTECTED ROUTES (CUSTOMER) --- */}
          <Route
            path="/checkout"
            element={
              <ProtectedRoute>
                <UV_Checkout />
              </ProtectedRoute>
            }
          />
          <Route
            path="/order-confirmation/:orderId"
            element={
              <ProtectedRoute>
                <UV_OrderConfirmation />
              </ProtectedRoute>
            }
          />
          <Route
            path="/orders"
            element={
              <ProtectedRoute>
                <UV_OrderHistory />
              </ProtectedRoute>
            }
          />
          <Route
            path="/orders/:orderId"
            element={
              <ProtectedRoute>
                <UV_OrderDetail />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <UV_Profile />
              </ProtectedRoute>
            }
          />

          {/* --- ADMIN ROUTES (role: admin) --- */}
          <Route
            path="/admin"
            element={
              <AdminRoute>
                <UV_AdminDashboard />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/products"
            element={
              <AdminRoute>
                <UV_Admin_Products />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/products/:id"
            element={
              <AdminRoute>
                <UV_Admin_ProductEdit />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/orders"
            element={
              <AdminRoute>
                <UV_Admin_Orders />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/orders/:orderId"
            element={
              <AdminRoute>
                <UV_Admin_OrderDetail />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/users"
            element={
              <AdminRoute>
                <UV_Admin_Users />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/categories"
            element={
              <AdminRoute>
                <UV_Admin_Categories />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/analytics"
            element={
              <AdminRoute>
                <UV_Admin_Analytics />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/reviews"
            element={
              <AdminRoute>
                <UV_Admin_Reviews />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/notifications"
            element={
              <AdminRoute>
                <UV_Admin_Notifications />
              </AdminRoute>
            }
          />

          {/* --- VENDOR ROUTES (role: vendor) --- */}
          <Route
            path="/vendor"
            element={
              <VendorRoute>
                <UV_VendorDashboard />
              </VendorRoute>
            }
          />
          <Route
            path="/vendor/products"
            element={
              <VendorRoute>
                <UV_Vendor_Products />
              </VendorRoute>
            }
          />
          <Route
            path="/vendor/products/:id"
            element={
              <VendorRoute>
                <UV_Vendor_ProductEdit />
              </VendorRoute>
            }
          />
          <Route
            path="/vendor/orders"
            element={
              <VendorRoute>
                <UV_Vendor_Orders />
              </VendorRoute>
            }
          />
          <Route
            path="/vendor/orders/:orderId"
            element={
              <VendorRoute>
                <UV_Vendor_OrderDetail />
              </VendorRoute>
            }
          />

          {/* --- 404 / CATCH-ALL --- */}
          <Route path="/404" element={<UV_404 />} />
          <Route path="*" element={<Navigate to="/404" replace />} />
        </Routes>
      </main>

      {showGlobalChrome && (
        <>
          {/* Cart Modal - should be tied to global open/close state */}
          <UV_CartModal />
          {/* Wishlist Modal */}
          <UV_WishlistModal />
          {/* Global overlays */}
          <GV_NotificationCenter />
          <GV_NotificationToasts />
          <GV_Modals />
          {/* Footer */}
          <GV_Footer />
        </>
      )}
    </div>
  );
};

export default App;