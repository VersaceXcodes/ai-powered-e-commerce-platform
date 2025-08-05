import React, { useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { useAppStore } from '@/store/main';

// Zod types from schema
type AdminDashboardState = {
  revenue_total: number;
  avg_order_value: number;
  total_orders: number;
  inventory_low_count: number;
  top_products: { product_id: string; name: string; sales_count: number }[];
  user_registration_count: number;
  last_updated: string;
};

type NotificationEntity = {
  notification_id: string;
  user_id: string | null;
  content: string;
  type: string;
  is_read: boolean;
  related_entity_type?: string | null;
  related_entity_id?: string | null;
  created_at: string;
};

// --- API FN: fetchDashboardAnalytics ---
const fetchDashboardAnalytics = async (token: string): Promise<AdminDashboardState> => {
  const { data } = await axios.get(
    `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/admin/analytics?limit=1`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!data.analytics_snapshots || data.analytics_snapshots.length === 0) {
    throw new Error('No analytics data available');
  }
  const snap = data.analytics_snapshots[0];
  // Robust mapping: ensure all fields and fallback to 0/[] for undefined
  return {
    revenue_total: typeof snap.revenue_total === 'number' ? snap.revenue_total : 0,
    avg_order_value: typeof snap.avg_order_value === 'number' ? snap.avg_order_value : 0,
    total_orders: typeof snap.total_orders === 'number' ? snap.total_orders : 0,
    inventory_low_count: typeof snap.inventory_low_count === 'number' ? snap.inventory_low_count : 0,
    top_products: Array.isArray(snap.top_products) ? snap.top_products : [],
    user_registration_count: typeof snap.user_registration_count === 'number' ? snap.user_registration_count : 0,
    last_updated: snap.created_at || '',
  };
};

// --- API FN: fetchAdminNotifications ---
const fetchAdminNotifications = async (token: string): Promise<NotificationEntity[]> => {
  const params = new URLSearchParams();
  params.append('type', 'system,event,order,inventory');
  params.append('limit', '20');
  const { data } = await axios.get(
    `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/notifications?${params.toString()}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return data.notifications || [];
};

const UV_AdminDashboard: React.FC = () => {
  // --- Auth/Token selectors (ALWAYS individual selectors, never destructure) ---
  const currentUser = useAppStore(state => state.authentication_state.current_user);
  const authToken = useAppStore(state => state.authentication_state.auth_token);
  const realtimeConnection = useAppStore(state => state.realtime_connection);
  const setAdminDashboardState = useAppStore(state => state.set_admin_dashboard_state);
  const setNotificationState = useAppStore(state => state.set_notification_state);

  // --- Admin dashboard/store state ---
  const dashboardState = useAppStore(state => state.admin_dashboard_state);
  const notifications = useAppStore(state => state.notification_state.notifications);

  // --- Global loading ---
  const setGlobalLoading = useAppStore(state => state.set_global_loading);
  const clearGlobalLoading = useAppStore(state => state.clear_global_loading);

  // For error display when fetching
  const [errorBanner, setErrorBanner] = React.useState<string | null>(null);

  const firstLoadComplete = useRef(false);

  // --- React Query: Analytics snapshot ---
  const {
    isLoading: isLoadingDash,
    refetch: refetchDash,
  } = useQuery<AdminDashboardState, Error>({
    queryKey: ['admin-dashboard:analytics'],
    queryFn: async () => {
      if (!authToken) throw new Error('Not authenticated');
      return await fetchDashboardAnalytics(authToken);
    },
    enabled: !!authToken,
    refetchOnWindowFocus: false, // Real-time handles general freshness
  });

  // --- React Query: Notifications ---
  const {
    isLoading: isNotifLoading,
    refetch: refetchNotifs,
  } = useQuery<NotificationEntity[], Error>({
    queryKey: ['admin-dashboard:notifications'],
    queryFn: async () => {
      if (!authToken) throw new Error('Not authenticated');
      return await fetchAdminNotifications(authToken);
    },
    enabled: !!authToken,
    refetchOnWindowFocus: false,
  });

  // Handle successful data fetching
  React.useEffect(() => {
    if (isLoadingDash) return;
    
    // Fetch and set dashboard analytics
    if (authToken) {
      fetchDashboardAnalytics(authToken)
        .then(metrics => setAdminDashboardState(metrics))
        .catch(err => setErrorBanner(err.message));
    }
  }, [isLoadingDash, authToken, setAdminDashboardState]);

  React.useEffect(() => {
    if (isNotifLoading) return;
    
    // Fetch and set notifications
    if (authToken) {
      fetchAdminNotifications(authToken)
        .then(result => setNotificationState({ notifications: result }))
        .catch(err => {
          setErrorBanner(err.message);
        });
    }
  }, [isNotifLoading, authToken, setNotificationState]);

  // --- WebSocket: Listen for real-time updates ---
  // Store is updated by socket event listeners already
  useEffect(() => {
    // On first mount, trigger manual refetch if RT missed, only once
    if (!firstLoadComplete.current && !isLoadingDash && !isNotifLoading) {
      refetchDash();
      refetchNotifs();
      firstLoadComplete.current = true;
    }
    // Optionally, re-refetch on reconnection
    // eslint-disable-next-line
  }, [realtimeConnection]);

  // --- Allow manual refresh ---
  const refreshAll = async () => {
    setGlobalLoading('dashboard-refresh');
    setErrorBanner(null);
    try {
      await Promise.all([refetchDash(), refetchNotifs()]);
    } catch (e: any) {
      setErrorBanner(e?.message || 'Failed to refresh dashboard');
    }
    clearGlobalLoading();
  };

  // --- Helper: Banner formatting for currency, date ---
  const formatCurrency = (n: number) =>
    n.toLocaleString(undefined, { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
  const formatDate = (s: string) => {
    if (!s) return '';
    const d = new Date(s);
    return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  };

  // --- Access security: Block if not admin (UI rendered only if routed here via correct guard, but extra safety) ---
  if (!currentUser || currentUser.role !== 'admin') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
        <div className="bg-red-100 border border-red-300 text-red-700 p-8 rounded shadow-md">
          <h1 className="font-bold text-2xl mb-2">Access Denied</h1>
          <p className="mb-2">You must be signed in as an admin to view this page.</p>
          <Link to="/" className="text-blue-600 underline">
            Return to Home
          </Link>
        </div>
      </div>
    );
  }

  // --- Loading state full-page spinner ---
  if (isLoadingDash || isNotifLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center">
          <svg className="animate-spin h-8 w-8 text-blue-500 mb-3" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <div className="mt-2 text-gray-700 text-lg font-medium">Loading admin dashboard...</div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-gray-50">
        {/* Banner/Error Display */}
        {errorBanner && (
          <div className="w-full bg-red-100 border border-red-300 text-red-800 px-4 py-3 mb-4 flex items-center justify-between" role="alert" aria-live="polite">
            <div>{errorBanner}</div>
            <button
              type="button"
              className="ml-3 text-red-600 hover:text-red-800 focus:outline-none"
              aria-label="Dismiss error"
              onClick={() => setErrorBanner(null)}
              tabIndex={0}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 20 20" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 6l8 8M6 14L14 6" /></svg>
            </button>
          </div>
        )}

        {/* Header */}
        <div className="py-7 px-6 bg-white shadow-sm border-b flex flex-col sm:flex-row items-start sm:items-center justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1">Admin Dashboard</h1>
            <p className="text-gray-600">Welcome, <span className="font-semibold">{currentUser?.name}</span>!</p>
          </div>
          <div className="flex items-center gap-3 mt-4 sm:mt-0">
            <button
              type="button"
              onClick={refreshAll}
              disabled={isLoadingDash || isNotifLoading}
              className={`px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 transition disabled:opacity-60`}
              aria-label="Refresh dashboard"
              tabIndex={0}
            >
              <span className="inline-block align-middle">{isLoadingDash || isNotifLoading ? "Refreshing..." : "Refresh Data"}</span>
            </button>
            <span
              className={`inline-flex items-center rounded px-2.5 py-1 text-xs font-semibold ${
                realtimeConnection === 'connected'
                  ? 'bg-green-100 text-green-700'
                  : realtimeConnection === 'connecting'
                  ? 'bg-yellow-100 text-yellow-800'
                  : 'bg-red-100 text-red-700'
              }`}
              aria-label={`Realtime status: ${realtimeConnection}`}
              tabIndex={0}
            >
              <svg
                className={`inline-block mr-1 h-3 w-3 ${
                  realtimeConnection === 'connected'
                    ? 'text-green-500'
                    : realtimeConnection === 'connecting'
                    ? 'text-yellow-500'
                    : 'text-red-500'
                }`}
                fill="currentColor"
                viewBox="0 0 8 8"
              >
                <circle cx="4" cy="4" r="4" />
              </svg>
              {realtimeConnection === 'connected'
                ? 'Realtime'
                : realtimeConnection === 'connecting'
                ? 'Connecting'
                : 'Offline'}
            </span>
          </div>
        </div>

        {/* Main Grid */}
        <main className="max-w-7xl mx-auto p-4 sm:p-8 grid grid-cols-1 gap-y-8">
          {/* Metrics/Stats Cards */}
          <section aria-labelledby="metrics-heading">
            <h2 id="metrics-heading" className="sr-only">Metrics overview</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="bg-white p-5 rounded-lg shadow flex flex-col" tabIndex={0}>
                <dt className="text-sm font-medium text-gray-600">Total Revenue</dt>
                <dd className="mt-2 text-2xl font-extrabold text-green-600">
                  {formatCurrency(dashboardState.revenue_total)}
                </dd>
              </div>
              <div className="bg-white p-5 rounded-lg shadow flex flex-col" tabIndex={0}>
                <dt className="text-sm font-medium text-gray-600">Average Order Value</dt>
                <dd className="mt-2 text-2xl font-extrabold text-blue-700">
                  {formatCurrency(dashboardState.avg_order_value)}
                </dd>
              </div>
              <div className="bg-white p-5 rounded-lg shadow flex flex-col" tabIndex={0}>
                <dt className="text-sm font-medium text-gray-600">Total Orders</dt>
                <dd className="mt-2 text-2xl font-extrabold text-purple-700">
                  {dashboardState.total_orders}
                </dd>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-6">
              <div className="bg-white p-5 rounded-lg shadow flex flex-col" tabIndex={0}>
                <dt className="text-sm font-medium text-gray-600">Registered Users</dt>
                <dd className="mt-2 text-2xl font-extrabold text-indigo-600">{dashboardState.user_registration_count}</dd>
              </div>
              <div
                className={`p-5 rounded-lg shadow flex flex-col border-2 ${
                  dashboardState.inventory_low_count > 0
                    ? 'bg-yellow-50 border-yellow-400'
                    : 'bg-white border-gray-200'
                }`}
                tabIndex={0}
              >
                <dt className="text-sm font-medium text-gray-600">Low Inventory Products</dt>
                <dd className={`mt-2 text-2xl font-extrabold ${
                  dashboardState.inventory_low_count > 0 ? 'text-yellow-700' : 'text-gray-700'
                }`}>
                  {dashboardState.inventory_low_count}
                </dd>
                {dashboardState.inventory_low_count > 0 && (
                  <div className="mt-1 text-xs text-yellow-700 font-semibold flex items-center">
                    <svg className="h-4 w-4 mr-1 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path d="M12 9v2m0 4h.01M6.938 17h10.124c1.054 0 1.702-1.128 1.122-2.05l-5.062-8.197c-.53-.86-1.708-.86-2.237 0l-5.062 8.197c-.58.922.068 2.05 1.122 2.05z" strokeWidth="2" strokeLinejoin="round" />
                    </svg>
                    Attention: replenish stock!
                  </div>
                )}
              </div>
              <div className="bg-white p-5 rounded-lg shadow flex flex-col" tabIndex={0}>
                <dt className="text-sm font-medium text-gray-600">Data Last Updated</dt>
                <dd className="mt-2 text-base text-gray-700">{formatDate(dashboardState.last_updated)}</dd>
              </div>
            </div>
          </section>
          
          {/* Shortcuts Area */}
          <section aria-labelledby="admin-shortcuts-heading">
            <h2 id="admin-shortcuts-heading" className="text-lg font-semibold text-gray-900 mb-2">Quick Shortcuts</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
              <Link to="/admin/products" className="flex flex-col items-center bg-blue-50 hover:bg-blue-100 p-4 rounded-lg transition group shadow" tabIndex={0} aria-label="Manage Products">
                <span className="bg-blue-100 p-2 rounded-full mb-2">
                  <svg className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="2" d="M3 7v13h18V7M16.5 3h-9A1.5 1.5 0 005 4.5V7h14V4.5A1.5 1.5 0 0016.5 3z" /></svg>
                </span>
                <span className="text-sm font-medium text-blue-900">Products</span>
              </Link>
              <Link to="/admin/orders" className="flex flex-col items-center bg-purple-50 hover:bg-purple-100 p-4 rounded-lg transition group shadow" tabIndex={0} aria-label="Manage Orders">
                <span className="bg-purple-100 p-2 rounded-full mb-2">
                  <svg className="h-6 w-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="2" d="M9 17V9a3 3 0 016 0v8m-6 0a3 3 0 01-6 0M15 17a3 3 0 006 0" /></svg>
                </span>
                <span className="text-sm font-medium text-purple-900">Orders</span>
              </Link>
              <Link to="/admin/users" className="flex flex-col items-center bg-green-50 hover:bg-green-100 p-4 rounded-lg transition group shadow" tabIndex={0} aria-label="Manage Users">
                <span className="bg-green-100 p-2 rounded-full mb-2">
                  <svg className="h-6 w-6 text-green-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="2" d="M17 20h5v-2a4 4 0 00-3-3.87M9 20h6M3 20h5v-2a4 4 0 013-3.87M7 7a4 4 0 018 0v4a4 4 0 01-8 0V7z" /></svg>
                </span>
                <span className="text-sm font-medium text-green-900">Users</span>
              </Link>
              <Link to="/admin/categories" className="flex flex-col items-center bg-pink-50 hover:bg-pink-100 p-4 rounded-lg transition group shadow" tabIndex={0} aria-label="Manage Categories">
                <span className="bg-pink-100 p-2 rounded-full mb-2">
                  <svg className="h-6 w-6 text-pink-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="2" d="M6 8V6h12v2M6 12v2a2 2 0 002 2h8a2 2 0 002-2v-2" /></svg>
                </span>
                <span className="text-sm font-medium text-pink-900">Categories</span>
              </Link>
              <Link to="/admin/notifications" className="flex flex-col items-center bg-orange-50 hover:bg-orange-100 p-4 rounded-lg transition group shadow" tabIndex={0} aria-label="Notifications and Alerts">
                <span className="bg-orange-100 p-2 rounded-full mb-2">
                  <svg className="h-6 w-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="2" d="M15 17h5v-2a4 4 0 00-3-3.87M9 17H4v-2a4 4 0 013-3.87M12 3v1m0 16v1M7 5l1.5 1.5M17 5l-1.5 1.5" /></svg>
                </span>
                <span className="text-sm font-medium text-orange-900">Notifications</span>
              </Link>
              <Link to="/admin/analytics" className="flex flex-col items-center bg-indigo-50 hover:bg-indigo-100 p-4 rounded-lg transition group shadow" tabIndex={0} aria-label="View Analytics">
                <span className="bg-indigo-100 p-2 rounded-full mb-2">
                  <svg className="h-6 w-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="2" d="M3 17v-2c0-1.104.896-2 2-2h1c1.104 0 2 .896 2 2v2m4-4v6m4-10v10m4-2v2" /></svg>
                </span>
                <span className="text-sm font-medium text-indigo-900">Analytics</span>
              </Link>
            </div>
          </section>

          {/* Top-Sellers */}
          <section aria-labelledby="top-products-heading">
            <div className="flex items-center mb-2">
              <h2 id="top-products-heading" className="text-lg font-semibold text-gray-900">Top Selling Products</h2>
              {dashboardState.top_products.length > 0 && (
                <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700">{dashboardState.top_products.length}</span>
              )}
            </div>
            {dashboardState.top_products.length === 0 ? (
              <div className="bg-gray-50 text-gray-500 p-4 rounded">
                <span>No top sellers yet for this period.</span>
              </div>
            ) : (
              <div className="overflow-auto">
                <table className="w-full text-sm mt-1 min-w-[350px]">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium text-gray-700">Product</th>
                      <th className="text-right px-3 py-2 font-medium text-gray-700">Sales</th>
                      <th className="text-center px-3 py-2 font-medium text-gray-700">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboardState.top_products.map((product) => (
                      <tr key={product.product_id} className="border-b last:border-none">
                        <td className="px-3 py-2 text-gray-900">{product.name}</td>
                        <td className="px-3 py-2 text-right text-blue-800 font-semibold">{product.sales_count}</td>
                        <td className="px-3 py-2 text-center">
                          <Link
                            to={`/admin/products/${product.product_id}`}
                            className="inline-block px-3 py-1 text-xs bg-blue-100 text-blue-800 rounded hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-400"
                            tabIndex={0}
                            aria-label={`Edit product: ${product.name}`}
                          >
                            Edit
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Notification Feed */}
          <section aria-labelledby="admin-activity-feed-heading">
            <div className="flex items-center mb-3">
              <h2 id="admin-activity-feed-heading" className="text-lg font-semibold text-gray-900">Recent Activity & Alerts</h2>
              {notifications.length > 0 && (
                <span aria-label={`${notifications.filter(n => !n.is_read).length} unread notifications`} className="ml-2 rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-800">{notifications.filter(n => !n.is_read).length} new</span>
              )}
            </div>
            {notifications.length === 0 ? (
              <div className="bg-gray-50 text-gray-500 p-4 rounded">
                <span>No recent notifications.</span>
              </div>
            ) : (
              <ul className="divide-y divide-gray-100">
                {notifications.map((notif) => (
                  <li key={notif.notification_id} className={`flex items-start space-x-3 px-3 py-3 ${notif.is_read ? '' : 'bg-blue-50'}`}>
                    <div className="flex-shrink-0 pt-1">
                      <svg
                        className={`h-6 w-6 ${
                          notif.type === 'order'
                            ? 'text-purple-500'
                            : notif.type === 'inventory'
                            ? 'text-yellow-700'
                            : notif.type === 'system'
                            ? 'text-gray-400'
                            : 'text-blue-600'
                        }`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="currentColor" className="opacity-10"/>
                        {/* Determine icon by notif type */}
                        {notif.type === 'order' && (
                          <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M9 17V9a3 3 0 016 0v8m-6 0a3 3 0 01-6 0M15 17a3 3 0 006 0" />
                        )}
                        {notif.type === 'inventory' && (
                          <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M6.938 17h10.124c1.054 0 1.702-1.128 1.122-2.05l-5.062-8.197c-.53-.86-1.708-.86-2.237 0l-5.062 8.197c-.58.922.068 2.05 1.122 2.05z" />
                        )}
                        {notif.type === 'system' && (
                          <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3" />
                        )}
                        {(notif.type !== 'order' && notif.type !== 'inventory' && notif.type !== 'system') && (
                          <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M15 17h5v-2a4 4 0 00-3-3.87M9 17H4v-2a4 4 0 013-3.87" />
                        )}
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-gray-900">
                        {notif.content}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">{formatDate(notif.created_at || '')}</div>
                    </div>
                    {/* Contextual navigation (if notification links to an entity) */}
                    {notif.related_entity_type && notif.related_entity_id && (
                      <div className="flex-shrink-0 ml-6">
                        <Link
                          to={
                            notif.related_entity_type === 'order'
                              ? `/admin/orders/${notif.related_entity_id}`
                              : notif.related_entity_type === 'product'
                              ? `/admin/products/${notif.related_entity_id}`
                              : notif.related_entity_type === 'user'
                              ? `/admin/users`
                              : '/admin/notifications'
                          }
                          className="text-blue-600 hover:text-blue-900 text-xs underline"
                          tabIndex={0}
                          aria-label={`Go to ${notif.related_entity_type} detail`}
                        >
                          View
                        </Link>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </main>
      </div>
    </>
  );
};

export default UV_AdminDashboard;