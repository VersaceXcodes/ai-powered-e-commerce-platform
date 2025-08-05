import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '@/store/main';
import { z } from 'zod';

// ==== Zod schema imports for types ====
import {
  orderSchema,
  orderItemSchema,
  orderStatusHistorySchema,
  updateOrderInputSchema,
} from '@schema'; // Replace with actual schema import path

type Order = z.infer<typeof orderSchema>;
type OrderItem = z.infer<typeof orderItemSchema>;
type OrderStatusHistory = z.infer<typeof orderStatusHistorySchema>;

const API_BASE = `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}`;

const ORDER_STATUS_LABEL: Record<string, string> = {
  created: 'Created',
  processing: 'Processing',
  shipped: 'Shipped',
  delivered: 'Delivered',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const ORDER_STATUS_BADGE_COLOR: Record<string, string> = {
  created: 'bg-gray-200 text-gray-900',
  processing: 'bg-blue-100 text-blue-700',
  shipped: 'bg-yellow-100 text-yellow-700',
  delivered: 'bg-green-100 text-green-700',
  completed: 'bg-green-200 text-green-900',
  cancelled: 'bg-red-100 text-red-700',
};

const AVAILABLE_VENDOR_STATUS = ['shipped', 'delivered'];

const UV_Vendor_OrderDetail: React.FC = () => {
  // --- Global App State (Zustand) ---
  const currentUser = useAppStore(state => state.authentication_state.current_user);
  const authToken = useAppStore(state => state.authentication_state.auth_token);

  // --- URL Param (order_id) ---
  const { orderId } = useParams<{ orderId: string }>();
  const sanitizedOrderId = typeof orderId === 'string' ? orderId.trim() : '';

  // --- Local state for feedback/UI ---
  const [statusUpdate, setStatusUpdate] = useState('');
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [updateSuccess, setUpdateSuccess] = useState<string | null>(null);

  // --- React Query Client ---
  const queryClient = useQueryClient();

  // --- Fetch Order (GET /orders/{order_id}) ---
  const {
    data: orderData,
    isLoading: orderLoading,
    isError: orderIsError,
    error: orderError,
    refetch: refetchOrder,
  } = useQuery<Order, Error>({
    queryKey: ['vendor-order-detail', sanitizedOrderId],
    queryFn: async () => {
      if (!sanitizedOrderId || !authToken) throw new Error('Missing order ID or auth');
      const resp = await axios.get(`${API_BASE}/orders/${encodeURIComponent(sanitizedOrderId)}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      // Validate/coerce
      const validated = orderSchema.safeParse(resp.data.order ?? resp.data);
      if (!validated.success) throw new Error('Invalid order payload from server');
      return validated.data;
    },
    enabled: !!sanitizedOrderId && !!authToken,
    staleTime: 60 * 1000,
  });

  // --- Fetch Order Items (GET /orders/{order_id}/items) ---
  const {
    data: vendorOrderItems,
    isLoading: itemsLoading,
    isError: itemsIsError,
    error: itemsError,
    refetch: refetchOrderItems,
  } = useQuery<OrderItem[], Error>({
    queryKey: ['vendor-order-items', sanitizedOrderId, currentUser?.user_id],
    queryFn: async () => {
      if (!sanitizedOrderId || !authToken || !currentUser) throw new Error('Missing order ID or auth');
      const resp = await axios.get(`${API_BASE}/orders/${encodeURIComponent(sanitizedOrderId)}/items`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const itemsRaw = (resp.data.order_items ?? resp.data) as OrderItem[];
      // Validate with Zod
      const validArray = z.array(orderItemSchema).safeParse(itemsRaw);
      if (!validArray.success) throw new Error('Invalid order_items payload from server');
      // Filter: only items for this vendor
      return validArray.data.filter(item => item.vendor_id === currentUser.user_id);
    },
    enabled: !!sanitizedOrderId && !!authToken && !!currentUser,
    staleTime: 60 * 1000,
  });

  // --- Fetch Order Status History (GET /orders/{order_id}/status-history) ---
  const {
    data: orderStatusHistory,
    isLoading: historyLoading,
    isError: historyIsError,
    error: historyError,
    refetch: refetchStatusHistory,
  } = useQuery<OrderStatusHistory[], Error>({
    queryKey: ['vendor-order-status-history', sanitizedOrderId],
    queryFn: async () => {
      if (!sanitizedOrderId || !authToken) throw new Error('Missing order ID or auth');
      const resp = await axios.get(`${API_BASE}/orders/${encodeURIComponent(sanitizedOrderId)}/status-history`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const rawList = resp.data.order_status_histories ?? resp.data;
      const validArray = z.array(orderStatusHistorySchema).safeParse(rawList);
      if (!validArray.success) throw new Error('Invalid order_status_histories payload from server');
      // Sort by updated_at DESC for timeline
      return validArray.data.slice().sort((a, b) => (b.updated_at > a.updated_at ? 1 : -1));
    },
    enabled: !!sanitizedOrderId && !!authToken,
    staleTime: 60 * 1000,
  });

  // --- Update Order Status (PATCH /orders/{order_id}) ---
  const {
    mutate: updateOrderStatus,
    isPending: isStatusUpdating,
  } = useMutation<Order, Error, { status: string }>({
    mutationFn: async ({ status }) => {
      if (!sanitizedOrderId || !authToken) throw new Error('Missing order ID or auth');
      // Validate status using Zod
      const parsed = updateOrderInputSchema.safeParse({ order_id: sanitizedOrderId, status });
      if (!parsed.success) throw new Error('Invalid status input');
      const resp = await axios.patch(
        `${API_BASE}/orders/${encodeURIComponent(sanitizedOrderId)}`,
        { order_id: sanitizedOrderId, status },
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
      const validated = orderSchema.safeParse((resp.data.order ?? resp.data));
      if (!validated.success) throw new Error('Invalid response on update');
      return validated.data;
    },
    onError: error => {
      setUpdateError(error.message);
      setUpdateSuccess(null);
    },
    onSuccess: data => {
      setUpdateSuccess('Status updated successfully.');
      setUpdateError(null);
      setStatusUpdate('');
      // Refetch all related data
      refetchOrder();
      refetchOrderItems();
      refetchStatusHistory();
    },
  });

  // --- Invoice Download (Client-side PDF only) ---
  const handleDownloadInvoice = () => {
    // TODO: Proper PDF generation - for now just a simple print
    window.print();
    // You can integrate jsPDF or similar in a real implementation.
  };

  // --- Build Customer Contact from Order ---
  const customerContact = useMemo(() => {
    if (!orderData) return { name: '', email: '', phone: '' };
    return {
      name: orderData.user_id ? `Customer ID: ${orderData.user_id}` : '',
      email: orderData.email || '',
      phone: orderData.phone || '',
    };
  }, [orderData]);

  // --- Set statusUpdate to current value on order load ---
  useEffect(() => {
    if (orderData && orderData.status) {
      setStatusUpdate(orderData.status);
    }
  }, [orderData]);

  // --- UI loading and error state aggregation ---
  const isGlobalLoading = orderLoading || itemsLoading || historyLoading;
  const globalError =
    (orderIsError && orderError?.message) ||
    (itemsIsError && itemsError?.message) ||
    (historyIsError && historyError?.message);

  // --- Only allow status updates if not cancelled/completed/delivered ---
  const statusCanBeUpdated =
    orderData &&
    AVAILABLE_VENDOR_STATUS.includes(statusUpdate) &&
    ['created', 'processing', 'shipped'].includes(orderData.status);

  // --- Invoice download aria label ---
  const invoiceDownloadAria = "Download Invoice (opens print dialog / PDF)";

  return (
    <>
      <div className="max-w-5xl mx-auto py-8 px-2 sm:px-6 lg:px-8">
        {/* --- Heading + Breadcrumb --- */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Order <span className="text-blue-600">{orderData?.order_number || sanitizedOrderId?.slice(0,8)}</span>
            </h1>
            <div className="mt-1 text-gray-600 text-sm flex items-center">
              <span>
                Placed: {orderData ? new Date(orderData.created_at).toLocaleString() : '--'}
              </span>
              {orderData && (
                <>
                  <span className="mx-3 h-5 w-px bg-gray-300 rounded block" />
                  <span className={`inline-block px-2 py-0.5 rounded ${ORDER_STATUS_BADGE_COLOR[orderData.status] || 'bg-gray-100 text-gray-900'}`}>
                    {ORDER_STATUS_LABEL[orderData.status] || orderData.status}
                  </span>
                </>
              )}
            </div>
          </div>
          <Link to="/vendor/orders" className="text-sm text-blue-600 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-300 rounded px-2 py-1">
            &larr; Back to Orders
          </Link>
        </div>

        {/* --- Global Loading/Error --- */}
        {isGlobalLoading && (
          <div className="flex items-center justify-center py-10">
            <span className="h-8 w-8 border-b-2 border-blue-600 rounded-full animate-spin inline-block align-middle" aria-label="Loading..."></span>
          </div>
        )}

        {globalError && (
          <div
            role="alert"
            aria-live="polite"
            className="mb-4 bg-red-50 border border-red-300 text-red-800 rounded p-4"
          >
            <div className="font-medium">An error occurred:</div>
            <div className="text-sm mt-1">{globalError}</div>
          </div>
        )}

        {/* --- Main Content --- */}
        {!isGlobalLoading && !globalError && (
          <div>
            {/* Customer + Addresses */}
            <section className="mb-6 grid md:grid-cols-2 gap-6">
              <div className="bg-white border rounded-md p-4">
                <h2 className="font-semibold text-lg text-gray-800 mb-2">Customer Contact</h2>
                <div className="flex items-center gap-2 mb-1 text-gray-700">
                  <svg viewBox="0 0 20 20" className="w-5 h-5" fill="currentColor" aria-hidden="true">
                    <path d="M10 2a6 6 0 016 6c0 2.21-1.473 4.07-3.5 4.723V15a1 1 0 01-2 0v-2.277C5.473 12.07 4 10.21 4 8a6 6 0 016-6zm0 2a4 4 0 00-4 4c0 1.252.623 2.422 1.74 3.104a.5.5 0 01.26.448V15a.5.5 0 001 0v-2.726a.75.75 0 01.75-.75h1a.75.75 0 01.75.75V15a.5.5 0 001 0v-6.448a.5.5 0 01.26-.448A4.001 4.001 0 0010 4z" />
                  </svg>
                  <span>{customerContact.name || 'N/A'}</span>
                </div>
                <div className="flex items-center gap-2 mb-1 text-gray-700">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14v7m-1-7h2" />
                  </svg>
                  <span>{customerContact.email ? <a href={`mailto:${customerContact.email}`} className="text-blue-700 underline">{customerContact.email}</a> : 'N/A'}</span>
                </div>
                <div className="flex items-center gap-2 text-gray-700">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5l2.992 2.992a15.36 15.36 0 0014.016 0L21 5m-9 8.5a3.5 3.5 0 100-7 3.5 3.5 0 000 7z" />
                  </svg>
                  <span>{customerContact.phone ? <a href={`tel:${customerContact.phone}`} className="text-blue-700 underline">{customerContact.phone}</a> : 'N/A'}</span>
                </div>
              </div>
              {/* Addresses */}
              <div className="bg-white border rounded-md p-4">
                <h2 className="font-semibold text-lg text-gray-800 mb-2">Shipping &amp; Billing</h2>
                <div className="mb-2">
                  <span className="font-medium">Shipping Address:</span>
                  <div className="text-gray-700 text-sm">{orderData?.shipping_address || 'N/A'}</div>
                </div>
                <div>
                  <span className="font-medium">Billing Address:</span>
                  <div className="text-gray-700 text-sm">{orderData?.billing_address || 'N/A'}</div>
                </div>
              </div>
            </section>

            {/* Items Table (Vendor only) */}
            <section className="mb-6">
              <h2 className="font-semibold text-lg text-gray-800 mb-2">Your Order Items</h2>
              {(vendorOrderItems && vendorOrderItems.length > 0) ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 border rounded-lg">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Product</th>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Qty</th>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Unit Price</th>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Total</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-100">
                      {vendorOrderItems.map(item => (
                        <tr key={item.order_item_id}>
                          <td className="px-4 py-2 whitespace-nowrap flex items-center gap-2">
                            <img
                              src={item.image_url || `https://picsum.photos/seed/${item.product_id}/40/40`}
                              alt={item.name}
                              className="w-10 h-10 rounded object-cover bg-gray-100 border"
                              onError={e => {
                                (e.target as HTMLImageElement).src = 'https://picsum.photos/seed/default/40/40';
                              }}
                            />
                            <span className="ml-2 font-medium text-gray-900">{item.name}</span>
                          </td>
                          <td className="px-4 py-2">{item.quantity}</td>
                          <td className="px-4 py-2">$
                            {item.price.toFixed(2)}
                          </td>
                          <td className="px-4 py-2">$
                            {(item.price * item.quantity).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="bg-yellow-50 rounded border border-yellow-100 p-3 mt-3 text-yellow-900 text-sm" aria-live="polite">
                  <span>You do not have any items in this order. This may be because the order only contains items from other vendors.</span>
                </div>
              )}
            </section>

            {/* Order Financial Summary */}
            <section className="mb-6">
              <div className="flex flex-wrap gap-6 items-start">
                <div className="bg-white border rounded-md flex-1 p-4 min-w-[220px]">
                  <h2 className="font-semibold text-lg text-gray-800 mb-2">Order Totals</h2>
                  <dl className="divide-y divide-gray-100 text-sm">
                    <div className="flex justify-between py-1">
                      <dt>Subtotal</dt>
                      <dd>${orderData?.subtotal?.toFixed(2) ?? '--'}</dd>
                    </div>
                    <div className="flex justify-between py-1">
                      <dt>Tax</dt>
                      <dd>${orderData?.tax?.toFixed(2) ?? '--'}</dd>
                    </div>
                    <div className="flex justify-between py-1">
                      <dt>Shipping</dt>
                      <dd>${orderData?.shipping?.toFixed(2) ?? '--'}</dd>
                    </div>
                    <div className="flex justify-between py-2 text-base font-semibold">
                      <dt>Total</dt>
                      <dd>${orderData?.total?.toFixed(2) ?? '--'}</dd>
                    </div>
                  </dl>
                </div>
                {/* Invoice download */}
                <div className="flex flex-col items-start ml-4">
                  <button
                    onClick={handleDownloadInvoice}
                    className="inline-flex items-center bg-indigo-600 text-white px-5 py-2 rounded shadow hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    aria-label={invoiceDownloadAria}
                  >
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Download Invoice (PDF)
                  </button>
                  <div className="text-gray-500 text-xs mt-2" aria-live="polite">
                    If your browser asks, use "Print as PDF" to save.
                  </div>
                  <div className="text-red-600 text-xs mt-1" aria-live="polite">
                    {/* TODO: MISSING ENDPOINT note */}
                    Server-side PDF not available yet.
                  </div>
                </div>
              </div>
            </section>

            {/* Order Status Timeline */}
            <section className="mb-6">
              <h2 className="font-semibold text-lg text-gray-800 mb-2">Order Timeline</h2>
              {orderStatusHistory && orderStatusHistory.length > 0 ? (
                <ol className="relative border-l border-gray-300 pl-3">
                  {orderStatusHistory.map(entry => (
                    <li className="mb-6 ml-2" key={entry.order_status_history_id}>
                      <div className="absolute w-3 h-3 bg-blue-500 rounded-full mt-1.5 -left-1.5 border border-white" />
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <span className={`px-2 py-0.5 rounded ${ORDER_STATUS_BADGE_COLOR[entry.status] || 'bg-gray-100 text-gray-900'}`}>
                            {ORDER_STATUS_LABEL[entry.status] || entry.status}
                          </span>
                        </div>
                        <time className="mt-1 sm:mt-0 text-xs text-gray-500">
                          {new Date(entry.updated_at).toLocaleString()}
                        </time>
                      </div>
                      <div className="text-xs text-gray-700 mt-1 ml-1">
                        Updated by user: {entry.updated_by_user_id}
                      </div>
                    </li>
                  ))}
                </ol>
              ) : (
                <div className="text-gray-600 text-sm mt-2">
                  No status history available for this order.
                </div>
              )}
            </section>

            {/* --- Status Update --- */}
            <section className="mb-8">
              <h2 className="font-semibold text-lg text-gray-800 mb-2">Update Status</h2>
              <div className="flex flex-col gap-2 max-w-xs">
                <label htmlFor="status" className="block text-sm font-medium text-gray-700">
                  Change status of your items:
                </label>
                <select
                  id="status"
                  value={statusUpdate}
                  onChange={e => {
                    setStatusUpdate(e.target.value);
                    setUpdateError(null);
                    setUpdateSuccess(null);
                  }}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 bg-white text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  disabled={isStatusUpdating || !statusCanBeUpdated}
                  aria-disabled={isStatusUpdating || !statusCanBeUpdated}
                  tabIndex={0}
                  aria-label="Update fulfillment status"
                >
                  {Object.entries(ORDER_STATUS_LABEL).map(([value, label]) => (
                    <option
                      key={value}
                      value={value}
                      disabled={!AVAILABLE_VENDOR_STATUS.includes(value)}
                    >
                      {label}
                    </option>
                  ))}
                </select>
                <button
                  className="bg-blue-600 hover:bg-blue-700 text-white rounded-md px-4 py-2 text-sm font-medium mt-2 focus:outline-none focus:ring-2 focus:ring-blue-400 flex items-center justify-center disabled:opacity-60 disabled:cursor-not-allowed"
                  onClick={() => {
                    setUpdateError(null);
                    setUpdateSuccess(null);
                    updateOrderStatus({ status: statusUpdate });
                  }}
                  disabled={
                    isStatusUpdating ||
                    !statusCanBeUpdated ||
                    !statusUpdate ||
                    !AVAILABLE_VENDOR_STATUS.includes(statusUpdate) ||
                    statusUpdate === orderData?.status
                  }
                  aria-label="Submit updated status"
                  tabIndex={0}
                >
                  {isStatusUpdating ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Updating...
                    </>
                  ) : (
                    <>
                      <span>Update Status</span>
                    </>
                  )}
                </button>
                {(updateError || updateSuccess) && (
                  <div
                    className={`rounded p-2 text-sm mt-2 ${updateError ? 'bg-red-50 border border-red-200 text-red-700' : 'bg-green-50 border border-green-200 text-green-700'}`}
                    aria-live="polite"
                    tabIndex={0}
                  >
                    {updateError || updateSuccess}
                  </div>
                )}
              </div>
              <div className="text-xs text-gray-500 mt-1" aria-live="polite">
                Only available statuses for vendors: Shipped, Delivered. If order is completed, delivered, or cancelled, status is locked.
              </div>
            </section>
          </div>
        )}
      </div>
    </>
  );
};

export default UV_Vendor_OrderDetail;