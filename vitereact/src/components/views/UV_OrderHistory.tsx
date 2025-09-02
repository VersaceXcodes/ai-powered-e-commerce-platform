import React, { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';
import { useAppStore } from '@/store/main';

// --- Types from Zod schemas ---
import { orderSchema, Order, SearchOrderInput } from '@schema';

// --- Order Status Labels ---
const ORDER_STATUSES: { value: string; label: string; color: string }[] = [
  { value: '', label: 'All Statuses', color: '' },
  { value: 'created', label: 'Created', color: 'bg-gray-300 text-gray-800' },
  { value: 'processing', label: 'Processing', color: 'bg-blue-200 text-blue-800' },
  { value: 'shipped', label: 'Shipped', color: 'bg-indigo-200 text-indigo-800' },
  { value: 'delivered', label: 'Delivered', color: 'bg-green-200 text-green-800' },
  { value: 'completed', label: 'Completed', color: 'bg-green-300 text-green-900' },
  { value: 'cancelled', label: 'Cancelled', color: 'bg-red-200 text-red-800' },
];

// --- Filter Defaults ---
const DEFAULT_LIMIT = 20;
const SORT_OPTIONS = [
  { value: 'created_at', label: 'Order Date' },
  { value: 'updated_at', label: 'Last Updated' },
  { value: 'order_number', label: 'Order Number' },
];
const SORT_ORDER_OPTIONS = [
  { value: 'desc', label: 'Descending' },
  { value: 'asc', label: 'Ascending' },
];

// --- Query Key ---
function getOrderHistoryQueryKey(filters: SearchOrderInput) {
  return [
    'orders',
    {
      user_id: filters.user_id,
      status: filters.status,
      limit: filters.limit,
      offset: filters.offset,
      sort_by: filters.sort_by,
      sort_order: filters.sort_order,
    },
  ];
}

// --- Fetch Orders ---
const fetchOrders = async (
  filters: SearchOrderInput,
  token: string | null
): Promise<{ orders: Order[]; total: number }> => {
  if (!token) throw new Error('No auth token');
  if (!filters.user_id) throw new Error('Invalid user');
  const queryParams = new URLSearchParams();
  queryParams.set('user_id', filters.user_id);
  if (filters.status) queryParams.set('status', filters.status);
  if (typeof filters.limit === 'number') queryParams.set('limit', String(filters.limit));
  if (typeof filters.offset === 'number') queryParams.set('offset', String(filters.offset));
  if (filters.sort_by) queryParams.set('sort_by', filters.sort_by);
  if (filters.sort_order) queryParams.set('sort_order', filters.sort_order);

  const resp = await axios.get(
    `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/orders?${queryParams.toString()}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  // Validate structure
  if (!resp.data || !Array.isArray(resp.data.orders)) throw new Error('Malformed server response');
  return {
    orders: resp.data.orders.map((o: any) => orderSchema.parse(o)),
    total: resp.data.total,
  };
};

const UV_OrderHistory: React.FC = () => {
  // Zustand selectors (ALWAYS individually)
  const currentUser = useAppStore(state => state.authentication_state.current_user);
  const authToken = useAppStore(state => state.authentication_state.auth_token);
  const socket = useAppStore(state => state.socket);

  const [filters, setFilters] = useState<SearchOrderInput>(() => ({
    user_id: currentUser?.user_id || '',
    status: undefined,
    limit: DEFAULT_LIMIT,
    offset: 0,
    sort_by: 'created_at',
    sort_order: 'desc',
  }));

  // For accessibility: error messages
  const [localError, setLocalError] = useState<string | null>(null);


  const navigate = useNavigate();

  // Update user_id in filters if user changes
  useEffect(() => {
    setFilters(prev => ({
      ...prev,
      user_id: currentUser?.user_id || '',
    }));
  }, [currentUser?.user_id]);

  // --- Query: Fetch Orders ---
  const {
    data,
    isFetching,
    refetch,
  } = useQuery<{ orders: Order[]; total: number }, Error>({
    queryKey: getOrderHistoryQueryKey(filters),
    queryFn: () => fetchOrders(filters, authToken || ''),
    enabled: !!filters.user_id && !!authToken,
  });

  // --- Handle Real-time Order Events (Refresh Orders) ---
  const lastEventRef = useRef<number>(Date.now());
  useEffect(() => {
    if (!socket) return;
    // On specific order events, refetch
    function handleOrderEvent(_payload: any) {
      // Prevent rapid refetches (e.g. rapid status changes)
      const now = Date.now();
      if (now - lastEventRef.current > 400) {
        refetch();
        lastEventRef.current = now;
      }
    }
    socket.on('order.status.changed', handleOrderEvent);
    socket.on('order.created', handleOrderEvent);
    socket.on('order.cancelled', handleOrderEvent);
    return () => {
      socket.off('order.status.changed', handleOrderEvent);
      socket.off('order.created', handleOrderEvent);
      socket.off('order.cancelled', handleOrderEvent);
    };
    // eslint-disable-next-line
  }, [socket, refetch]);

  // --- Handlers ---

  // Status filter
  const handleStatusFilter = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setFilters(prev => ({
      ...prev,
      status: val ? (val as "created" | "processing" | "shipped" | "delivered" | "cancelled") : undefined,
      offset: 0,
    }));
    setLocalError(null);
  };

  // Sorting
  const handleSortBy = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setFilters(prev => ({
      ...prev,
      sort_by: e.target.value as SearchOrderInput['sort_by'],
      offset: 0,
    }));
    setLocalError(null);
  };
  const handleSortOrder = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setFilters(prev => ({
      ...prev,
      sort_order: e.target.value as SearchOrderInput['sort_order'],
      offset: 0,
    }));
    setLocalError(null);
  };

  // Pagination
  const currentPage = Math.floor((filters.offset || 0) / (filters.limit || DEFAULT_LIMIT)) + 1;
  const totalPages = data ? Math.ceil(data.total / (filters.limit || DEFAULT_LIMIT)) : 1;

  const handlePrevPage = () => {
    setFilters(prev => ({
      ...prev,
      offset: Math.max(0, (prev.offset || 0) - (prev.limit || DEFAULT_LIMIT)),
    }));
    setLocalError(null);
  };
  const handleNextPage = () => {
    if (!data) return;
    setFilters(prev => ({
      ...prev,
      offset: Math.min(prev.offset + (prev.limit || DEFAULT_LIMIT), Math.max(0, data.total - (prev.limit || DEFAULT_LIMIT))),
    }));
    setLocalError(null);
  };

  // Manual refresh
  const handleManualRefresh = () => {
    setLocalError(null);
    refetch();
  };

  // Navigate to detail
  const handleOrderRowClick = (order_id: string) => {
    // sanitize input
    if (typeof order_id === 'string' && order_id.match(/^[a-zA-Z0-9\-_]+$/)) {
      navigate(`/orders/${order_id}`);
    }
  };

  // Loading spinner
  const isBusy = isFetching;

  // --- Render ---
  return (
    <>
      <div className="max-w-5xl mx-auto w-full p-4 sm:p-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center sm:justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 tracking-tight">My Orders</h1>
            <p className="text-gray-500 text-sm mt-1">Track, review and inspect your purchase history.</p>
          </div>
          <div className="flex items-center gap-2 mt-3 sm:mt-0">
            <button
              type="button"
              onClick={handleManualRefresh}
              className="inline-flex items-center px-3 py-1.5 border border-blue-500 text-blue-500 bg-white rounded hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-100 transition"
              aria-label="Refresh Orders"
              tabIndex={0}
              disabled={isBusy}
            >
              <svg className={`w-4 h-4 mr-1 ${isBusy ? "animate-spin" : ""}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M4 4v5h.582m15.418-2A9 9 0 116.582 7" />
              </svg>
              Refresh
            </button>
            <Link
              to="/products"
              className="inline-flex items-center px-3 py-1.5 border border-gray-200 text-gray-600 bg-white rounded hover:bg-gray-50 ml-2 focus:outline-none focus:ring-2 focus:ring-blue-100 transition"
              tabIndex={0}
            >
              <svg className="mr-1 w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
              Browse Products
            </Link>
          </div>
        </div>

        <div className="mb-2 flex flex-wrap gap-4 items-center">
          {/* Status Filter */}
          <div>
            <label htmlFor="status" className="block text-xs font-medium text-gray-600 mb-1">Status</label>
            <select
              id="status"
              value={filters.status || ''}
              onChange={handleStatusFilter}
              className="block border-gray-200 rounded px-2 py-1 pr-6 text-sm focus:ring-blue-500 focus:border-blue-500"
            >
              {ORDER_STATUSES.map(s => (
                <option key={s.value || 'all'} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
          {/* Sort By */}
          <div>
            <label htmlFor="sort_by" className="block text-xs font-medium text-gray-600 mb-1">Sort</label>
            <select
              id="sort_by"
              value={filters.sort_by}
              onChange={handleSortBy}
              className="block border-gray-200 rounded px-2 py-1 pr-6 text-sm focus:ring-blue-500 focus:border-blue-500"
            >
              {SORT_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          {/* Sort Order */}
          <div>
            <label htmlFor="sort_order" className="block text-xs font-medium text-gray-600 mb-1">Order</label>
            <select
              id="sort_order"
              value={filters.sort_order}
              onChange={handleSortOrder}
              className="block border-gray-200 rounded px-2 py-1 pr-6 text-sm focus:ring-blue-500 focus:border-blue-500"
            >
              {SORT_ORDER_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Error + Loading + Orders Table/Card */}
        {localError && (
          <div className="my-3 px-4 py-2 bg-red-50 border border-red-200 text-red-800 rounded text-sm" aria-live="polite">{localError}</div>
        )}
        {isBusy && (
          <div className="my-6 flex flex-col items-center justify-center min-h-24">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2"></div>
            <span className="text-blue-600 text-sm">Loading your orders...</span>
          </div>
        )}
        {(!isBusy && (!data || !data.orders.length)) && (
          <div className="flex flex-col items-center justify-center min-h-40 py-8 text-center">
            <img
              src={`https://picsum.photos/seed/orders-empty${currentUser?.user_id || ''}/240/120`}
              alt="No orders illustration"
              className="mx-auto mb-3 rounded shadow"
              width={240}
              height={120}
              loading="lazy"
              aria-hidden="true"
            />
            <h2 className="text-lg font-semibold text-gray-700 mb-2">No orders yet</h2>
            <p className="text-gray-500 text-sm mb-3">When you place an order, it will appear here for tracking, reviewing, and support.</p>
            <Link
              to="/products"
              className="inline-block px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition "
              tabIndex={0}
            >
              Browse Products &rarr;
            </Link>
          </div>
        )}
        {/* Orders Table */}
        {!isBusy && data && data.orders.length > 0 && (
          <div className="overflow-auto rounded shadow border border-gray-100 my-4">
            <table className="min-w-full table-auto text-sm border-collapse select-none">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th scope="col" className="px-4 py-2 text-left font-semibold text-gray-700 text-xs tracking-wide">Date</th>
                  <th scope="col" className="px-4 py-2 text-left font-semibold text-gray-700 text-xs tracking-wide">Order #</th>
                  <th scope="col" className="px-4 py-2 text-left font-semibold text-gray-700 text-xs tracking-wide">Status</th>
                  <th scope="col" className="px-4 py-2 text-right font-semibold text-gray-700 text-xs tracking-wide">Total</th>
                  <th scope="col" className="px-4 py-2 text-center font-semibold text-gray-700 text-xs tracking-wide" aria-label="Order Details"></th>
                </tr>
              </thead>
              <tbody>
                {data.orders.map(order => {
                  const statusConf = ORDER_STATUSES.find(s => s.value === order.status);
                  return (
                    <tr
                      key={order.order_id}
                      tabIndex={0}
                      className="hover:bg-blue-50 transition cursor-pointer"
                      onClick={() => handleOrderRowClick(order.order_id)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleOrderRowClick(order.order_id);
                        }
                      }}
                      aria-label={`Order ${order.order_number}, status ${order.status}, total ${order.total} dollars`}
                    >
                      <td className="px-4 py-2 text-gray-700 whitespace-nowrap">{new Date(order.created_at).toLocaleDateString()}</td>
                      <td className="px-4 py-2 text-blue-600 underline underline-offset-2 whitespace-nowrap">{order.order_number}</td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        <span className={`inline-block rounded px-2 py-1 text-xs font-semibold ${statusConf?.color || 'bg-gray-200 text-gray-700'}`}>
                          {statusConf?.label || order.status}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right whitespace-nowrap font-semibold text-gray-800">${order.total.toFixed(2)}</td>
                      <td className="px-4 py-2 text-center w-10">
                        <Link to={`/orders/${order.order_id}`} title="View Details" className="inline-flex items-center justify-center text-blue-600 hover:underline hover:text-blue-800 focus:outline-none focus:ring-2 rounded focus:ring-blue-200" aria-label="View order details" tabIndex={0}>
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12H9m12 0A9 9 0 11 3 12a9 9 0 0118 0z" />
                          </svg>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {/* Pagination controls */}
            <div className="flex flex-wrap items-center justify-between gap-2 p-3 border-t border-gray-100 bg-gray-50 text-xs">
              <div className="text-gray-600 ml-1">
                Showing {Math.min(data.orders.length, filters.limit || DEFAULT_LIMIT)} of {data.total} order{data.total !== 1 && 's'}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrevPage}
                  disabled={filters.offset === 0 || isBusy}
                  className={`px-2 py-1 rounded border text-gray-500 bg-white hover:bg-gray-100 disabled:opacity-50`}
                  tabIndex={0}
                  aria-label="Previous Page"
                >
                  &larr; Prev
                </button>
                <span className="text-gray-600">{currentPage} / {totalPages || 1}</span>
                <button
                  onClick={handleNextPage}
                  disabled={filters.offset + (filters.limit || DEFAULT_LIMIT) >= data.total || isBusy}
                  className="px-2 py-1 rounded border text-gray-500 bg-white hover:bg-gray-100 disabled:opacity-50"
                  tabIndex={0}
                  aria-label="Next Page"
                >
                  Next &rarr;
                </button>
              </div>
            </div>
          </div>
        )}
        {/* Spacer */}
        <div className="h-10"></div>
      </div>
    </>
  );
};

export default UV_OrderHistory;