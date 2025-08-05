import React, { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { useAppStore } from "@/store/main";
import { Link } from "react-router-dom";

// --- Types from Zod/Backend schemas ---
interface AdminDashboardState {
  revenue_total: number;
  avg_order_value: number;
  total_orders: number;
  inventory_low_count: number;
  top_products: { product_id: string; name: string; sales_count: number }[];
  user_registration_count: number;
  last_updated: string;
}
interface Product {
  product_id: string;
  name: string;
  description: string;
  price: number;
  inventory_count: number;
  status: string;
  vendor_id: string | null;
  average_rating: number;
  total_ratings: number;
  created_at: string;
  updated_at: string;
}
interface Order {
  order_id: string;
  user_id: string;
  order_number: string;
  status: string;
  subtotal: number;
  tax: number;
  shipping: number;
  total: number;
  shipping_address: string;
  billing_address: string;
  phone: string;
  email: string;
  created_at: string;
  updated_at: string;
  cancelled_at: string | null;
  cancelled_by_user_id: string | null;
}

// Helpers
const API_BASE = `${import.meta.env.VITE_API_BASE_URL || "http://localhost:3000"}`;
const LOW_INVENTORY_THRESHOLD = 5;

// --- Fetch Functions ---
const fetchVendorAnalytics = async (vendor_id: string, token: string): Promise<AdminDashboardState> => {
  const { data } = await axios.get(`${API_BASE}/admin/analytics`, {
    params: { vendor_id, limit: 1 },
    headers: { Authorization: `Bearer ${token}` },
  });
  const snap = (data.analytics_snapshots && data.analytics_snapshots.length > 0)
    ? data.analytics_snapshots[0]
    : {};
  // Map backend fields defensively
  return {
    revenue_total: snap.revenue_total || 0,
    avg_order_value: snap.avg_order_value || 0,
    total_orders: snap.total_orders || 0,
    inventory_low_count: snap.inventory_low_count || 0,
    top_products: snap.top_products ? snap.top_products : [],
    user_registration_count: snap.user_registration_count || 0,
    last_updated: snap.created_at || "",
  };
};

const fetchVendorProducts = async (vendor_id: string, token: string): Promise<Product[]> => {
  const { data } = await axios.get(`${API_BASE}/products`, {
    params: { vendor_id },
    headers: { Authorization: `Bearer ${token}` },
  });
  return data.products || [];
};

const fetchVendorOrders = async (vendor_id: string, token: string): Promise<Order[]> => {
  const { data } = await axios.get(`${API_BASE}/orders`, {
    params: { vendor_id },
    headers: { Authorization: `Bearer ${token}` },
  });
  return data.orders || [];
};

// --- Spinner for loading ---
const Spinner: React.FC = () => (
  <div className="w-full flex justify-center items-center py-16">
    <svg
      className="animate-spin h-8 w-8 text-blue-600"
      viewBox="0 0 24 24"
      aria-label="Loading"
      fill="none"
    >
      <circle
        className="opacity-20"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-80"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  </div>
);

// --- Main Component ---
const UV_VendorDashboard: React.FC = () => {
  // Zustand selectors: Use INDIVIDUAL selectors only!
  const currentUser = useAppStore((state) => state.authentication_state.current_user);
  const authToken = useAppStore((state) => state.authentication_state.auth_token);

  // Defensive: If not vendor or not authed, show error; though route protection should handle this.
  if (!currentUser || currentUser.role !== "vendor" || !authToken) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="max-w-md p-8 rounded-lg bg-white shadow">
          <h2 className="text-2xl font-semibold text-red-600 mb-2">Vendor Access Only</h2>
          <p>You must be signed in as a vendor to access this dashboard.</p>
        </div>
      </div>
    );
  }

  // --- Queries ---
  // All keys include user_id for cache separation if context switch occurs.
  const vendor_id = currentUser.user_id;

  const {
    data: dashboard_metrics,
    isLoading: isLoadingMetrics,
    isError: isErrorMetrics,
    error: errorMetrics,
    refetch: refetchMetrics,
  } = useQuery<AdminDashboardState, Error>({
    queryKey: ["vendor_dashboard_metrics", vendor_id],
    queryFn: () => fetchVendorAnalytics(vendor_id, authToken),
    refetchOnWindowFocus: true,
  });

  const {
    data: vendor_products,
    isLoading: isLoadingProducts,
    isError: isErrorProducts,
    error: errorProducts,
    refetch: refetchProducts,
  } = useQuery<Product[], Error>({
    queryKey: ["vendor_products", vendor_id],
    queryFn: () => fetchVendorProducts(vendor_id, authToken),
    refetchOnWindowFocus: true,
  });

  const {
    data: vendor_orders,
    isLoading: isLoadingOrders,
    isError: isErrorOrders,
    error: errorOrders,
    refetch: refetchOrders,
  } = useQuery<Order[], Error>({
    queryKey: ["vendor_orders", vendor_id],
    queryFn: () => fetchVendorOrders(vendor_id, authToken),
    refetchOnWindowFocus: true,
  });

  // --- Compute low inventory products ---
  const low_inventory_products: { product_id: string; name: string; inventory_count: number }[] = useMemo(() => {
    if (!vendor_products) return [];
    return vendor_products
      .filter((p) => typeof p.inventory_count === "number" && p.inventory_count <= LOW_INVENTORY_THRESHOLD)
      .map((p) => ({
        product_id: p.product_id,
        name: p.name,
        inventory_count: p.inventory_count,
      }));
  }, [vendor_products]);

  // --- Loading and Error State ---
  const isAnyLoading = isLoadingMetrics || isLoadingProducts || isLoadingOrders;
  const isAnyError = isErrorMetrics || isErrorProducts || isErrorOrders;
  const errorMessage =
    (errorMetrics && errorMetrics.message) ||
    (errorProducts && errorProducts.message) ||
    (errorOrders && errorOrders.message) ||
    undefined;

  // --- Retry Handler ---
  const handleRetry = () => {
    refetchMetrics();
    refetchProducts();
    refetchOrders();
  };

  // --- UI Render ---
  // All in one render block (requirement)
  return (
    <>
      <div className="min-h-screen bg-gray-50">
        {/* Dashboard header + quick nav */}
        <div className="bg-white shadow">
          <div className="max-w-7xl mx-auto px-4 py-6 flex flex-col sm:flex-row items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-blue-600 text-white font-bold text-2xl mr-2">
                <svg aria-hidden="true" className="h-7 w-7" fill="none" viewBox="0 0 24 24">
                  <path stroke="currentColor" strokeWidth="1.5" d="M6 21V7c0-1.657 1.343-3 3-3h6c1.657 0 3 1.343 3 3v14" />
                  <circle cx="9" cy="10" r="1" fill="currentColor"/>
                  <circle cx="15" cy="10" r="1" fill="currentColor"/>
                </svg>
              </span>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 mb-1" tabIndex={0}>
                  Vendor Dashboard
                </h1>
                <p className="text-gray-500 text-sm">{currentUser.name} ({currentUser.email})</p>
              </div>
            </div>
            <div className="mt-4 sm:mt-0 flex gap-2">
              <Link to="/vendor/products" className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium text-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition" aria-label="Manage Products">
                Manage Products
              </Link>
              <Link to="/vendor/orders" className="inline-flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md font-medium text-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition" aria-label="Manage Orders">
                Manage Orders
              </Link>
            </div>
          </div>
        </div>
        {/* Progress / status */}
        {isAnyLoading && <Spinner />}

        {/* Error state */}
        {isAnyError && (
          <section className="max-w-3xl mx-auto mt-6 mb-4">
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md" aria-live="polite">
              <div className="flex items-center gap-2">
                <span className="font-semibold">Error:</span>
                <span>{errorMessage || "Failed to fetch dashboard data."}</span>
                <button
                  onClick={handleRetry}
                  className="ml-auto px-3 py-1 bg-red-200 hover:bg-red-300 rounded text-xs font-semibold text-red-800"
                  aria-label="Retry"
                >
                  Retry
                </button>
              </div>
            </div>
          </section>
        )}

        {/* Main dashboard grid */}
        {!isAnyLoading && !isAnyError && dashboard_metrics && (
          <main className="max-w-7xl mx-auto p-4 sm:p-8">
            {/* Dashboard metrics cards */}
            <section className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8" aria-label="Vendor Metrics">
              <div className="bg-white rounded-lg shadow p-6 flex flex-col" tabIndex={0} aria-label="Total Revenue">
                <div className="flex items-center mb-2">
                  <span className="text-xl font-semibold text-gray-700 mr-2">Revenue</span>
                  <svg className="h-5 w-5 text-green-500" fill="none" viewBox="0 0 24 24">
                    <path stroke="currentColor" strokeWidth="2" d="M12 3v18m6-9H6" />
                  </svg>
                </div>
                <div className="text-2xl font-bold text-green-600">
                  ${dashboard_metrics.revenue_total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <p className="text-xs text-gray-400 mt-auto">Total sales revenue</p>
              </div>
              <div className="bg-white rounded-lg shadow p-6 flex flex-col" tabIndex={0} aria-label="Average Order Value">
                <div className="flex items-center mb-2">
                  <span className="text-xl font-semibold text-gray-700 mr-2">Avg. Order Value</span>
                  <svg className="h-5 w-5 text-blue-500" fill="none" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                  </svg>
                </div>
                <div className="text-2xl font-bold text-blue-600">
                  ${dashboard_metrics.avg_order_value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <p className="text-xs text-gray-400 mt-auto">Average per order</p>
              </div>
              <div className="bg-white rounded-lg shadow p-6 flex flex-col" tabIndex={0} aria-label="Total Orders">
                <div className="flex items-center mb-2">
                  <span className="text-xl font-semibold text-gray-700 mr-2">Orders</span>
                  <svg className="h-5 w-5 text-purple-500" fill="none" viewBox="0 0 24 24">
                    <rect x="4" y="6" width="16" height="12" rx="3" stroke="currentColor" strokeWidth="2" />
                  </svg>
                </div>
                <div className="text-2xl font-bold text-purple-600">
                  {dashboard_metrics.total_orders}
                </div>
                <p className="text-xs text-gray-400 mt-auto">Total orders placed</p>
              </div>
            </section>

            {/* Low inventory alert (visible if at least one low stock product) */}
            {low_inventory_products.length > 0 && (
              <section className="mb-8">
                <div className="bg-yellow-100 border-l-4 border-yellow-400 text-yellow-800 p-4 rounded flex flex-col sm:flex-row items-center">
                  <div className="flex items-center">
                    <span className="mr-2 font-bold" aria-label="Low inventory alert">
                      <svg className="h-6 w-6 text-yellow-600 mr-1" fill="none" viewBox="0 0 24 24">
                        <path stroke="currentColor" strokeWidth="2" d="M12 10v4m0 4h.01M4.93 19.07a10 10 0 1114.14 0A10 10 0 014.93 19.07z"/>
                      </svg>
                      Low inventory:
                    </span>
                  </div>
                  <div>
                    <ul className="ml-3 list-disc text-sm" aria-live="polite">
                      {low_inventory_products.slice(0, 5).map((p) => (
                        <li key={p.product_id}>
                          <Link 
                            to={`/vendor/products/${encodeURIComponent(p.product_id)}`} 
                            className="underline hover:text-blue-700 transition-colors" 
                            tabIndex={0}
                          >
                            {p.name}
                          </Link> ({p.inventory_count} remaining)
                        </li>
                      ))}
                      {low_inventory_products.length > 5 && (
                        <li className="italic text-xs text-yellow-700 mt-1">
                          ...and {low_inventory_products.length - 5} more products low on stock.
                        </li>
                      )}
                    </ul>
                  </div>
                </div>
              </section>
            )}

            {/* Top Products Table */}
            <section className="mb-8">
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Top Products</h2>
              {dashboard_metrics.top_products && dashboard_metrics.top_products.length > 0 ? (
                <div className="rounded-lg shadow bg-white overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-100">
                      <tr>
                        <th scope="col" className="px-4 py-3 text-left font-semibold">Product</th>
                        <th scope="col" className="px-4 py-3 text-left">Sales</th>
                        <th scope="col" className="px-4 py-3 text-left">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dashboard_metrics.top_products.slice(0, 5).map((product) => (
                        <tr key={product.product_id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium">
                            <Link to={`/vendor/products/${encodeURIComponent(product.product_id)}`} className="text-blue-700 hover:underline" tabIndex={0}>
                              {product.name}
                            </Link>
                          </td>
                          <td className="px-4 py-3">{product.sales_count}</td>
                          <td className="px-4 py-3">
                            <Link to={`/vendor/products/${encodeURIComponent(product.product_id)}`} aria-label={`Edit ${product.name}`}>
                              <button className="text-xs px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded" aria-label="Edit Product">Edit</button>
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-gray-600 text-sm bg-white rounded p-4 border border-dashed border-gray-200">No top products found yet.</div>
              )}
            </section>

            {/* Recent Orders Table */}
            <section className="mb-8">
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Recent Orders</h2>
              {vendor_orders && vendor_orders.length > 0 ? (
                <div className="rounded-lg shadow bg-white overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-100">
                      <tr>
                        <th scope="col" className="px-4 py-3 text-left font-semibold">Order #</th>
                        <th scope="col" className="px-4 py-3 text-left">Status</th>
                        <th scope="col" className="px-4 py-3 text-left">Total</th>
                        <th scope="col" className="px-4 py-3 text-left">Placed</th>
                        <th scope="col" className="px-4 py-3 text-left">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {vendor_orders
                        .slice()
                        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                        .slice(0, 5)
                        .map((order) => (
                          <tr key={order.order_id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 font-medium">
                              <Link to={`/vendor/orders/${encodeURIComponent(order.order_id)}`} className="text-blue-700 hover:underline" tabIndex={0}>
                                {order.order_number}
                              </Link>
                            </td>
                            <td className="px-4 py-3 capitalize">
                              <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${order.status === 'completed' || order.status === 'delivered'
                                ? 'bg-green-200 text-green-900'
                                : order.status === 'cancelled'
                                  ? 'bg-red-100 text-red-700'
                                  : order.status === 'processing' ? 'bg-yellow-100 text-yellow-700'
                                  : 'bg-gray-100 text-gray-700'
                                }`}>
                                {order.status}
                              </span>
                            </td>
                            <td className="px-4 py-3">${order.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                            <td className="px-4 py-3">{new Date(order.created_at).toLocaleDateString()}</td>
                            <td className="px-4 py-3">
                              <Link to={`/vendor/orders/${encodeURIComponent(order.order_id)}`} aria-label={`View Order ${order.order_number}`}>
                                <button className="text-xs px-3 py-1 bg-blue-200 hover:bg-blue-300 rounded" aria-label="View Order">View</button>
                              </Link>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-gray-600 text-sm bg-white rounded p-4 border border-dashed border-gray-200">No orders found yet.</div>
              )}
            </section>

            {/* Footer - last updated */}
            <footer className="w-full text-xs text-right text-gray-400 mt-8">
              Last updated:{" "}
              {dashboard_metrics.last_updated
                ? new Date(dashboard_metrics.last_updated).toLocaleString()
                : "Never"}
            </footer>
          </main>
        )}
      </div>
    </>
  );
};

export default UV_VendorDashboard;