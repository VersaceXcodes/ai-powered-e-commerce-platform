import React, { useState, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '@/store/main';
import { z } from 'zod';

// Zod schema types (from DB:zodschemas:ts)
import {
  orderSchema,
  orderItemSchema,
  orderStatusHistorySchema,
  userSchema
} from '@schema';

// Types
type Order = z.infer<typeof orderSchema>;
type OrderItem = z.infer<typeof orderItemSchema>;
type OrderStatusHistory = z.infer<typeof orderStatusHistorySchema>;
type User = z.infer<typeof userSchema>;

// API base URL
const API_BASE = `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}`;

// --- Utility: status labels, choices, color mapping ---
const ORDER_STATUS_LABEL: Record<string, string> = {
  created: 'Created',
  processing: 'Processing',
  completed: 'Completed',
  cancelled: 'Cancelled',
  shipped: 'Shipped',
  delivered: 'Delivered'
};
const ORDER_STATUS_COLOR: Record<string, string> = {
  created: 'bg-gray-200 text-gray-800',
  processing: 'bg-blue-100 text-blue-700',
  shipped: 'bg-yellow-100 text-yellow-700',
  delivered: 'bg-green-100 text-green-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700'
};
const ORDER_STATUS_TRANSITIONS: Record<string, string[]> = {
  created: ['processing', 'cancelled'],
  processing: ['shipped', 'cancelled'],
  shipped: ['delivered', 'cancelled'],
  delivered: ['completed'],
  completed: [],
  cancelled: [],
};

// --- React Query fetchers ---
const fetchOrderDetail = async ({ queryKey }: { queryKey: any[] }): Promise<Order> => {
  const [_key, order_id, token] = queryKey;
  const { data } = await axios.get<Order>(
    `${API_BASE}/orders/${encodeURIComponent(order_id)}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return data;
};
const fetchOrderItems = async ({ queryKey }: { queryKey: any[] }): Promise<OrderItem[]> => {
  const [_key, order_id, token] = queryKey;
  const { data } = await axios.get<{ order_items: OrderItem[] }>(
    `${API_BASE}/orders/${encodeURIComponent(order_id)}/items`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return data.order_items;
};
const fetchOrderStatusHistory = async ({ queryKey }: { queryKey: any[] }): Promise<OrderStatusHistory[]> => {
  const [_key, order_id, token] = queryKey;
  const { data } = await axios.get<{ order_status_histories: OrderStatusHistory[] }>(
    `${API_BASE}/orders/${encodeURIComponent(order_id)}/status-history`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return data.order_status_histories;
};
const fetchUser = async ({ queryKey }: { queryKey: any[] }): Promise<User> => {
  const [_key, user_id, token] = queryKey;
  const { data } = await axios.get<User>(
    `${API_BASE}/users/${encodeURIComponent(user_id)}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return data;
};


// ----- Main Component -----
const UV_Admin_OrderDetail: React.FC = () => {
  // Slug param
  const { orderId } = useParams<{ orderId: string }>();
  const order_id = (orderId || '').trim();
  const navigate = useNavigate();

  // Auth selectors (MUST use atomic access)
  const authToken = useAppStore(state => state.authentication_state.auth_token);
  const currentUser = useAppStore(state => state.authentication_state.current_user);
  const setError = useAppStore(state => state.set_error);
  const clearError = useAppStore(state => state.clear_error);

  // Local UI state for mutations
  const [changeStatus, setChangeStatus] = useState<string>('');
  const [noteInput, setNoteInput] = useState<string>('');
  const [showStatusDialog, setShowStatusDialog] = useState<boolean>(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<boolean>(false);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [noteMutationLoading, setNoteMutationLoading] = useState<boolean>(false);

  // React Query Client
  const queryClient = useQueryClient();

  // ----------- Queries -----------
  // 1. Main order object
  const {
    data: order,
    isLoading: orderLoading,
    isError: orderError,
    error: orderErrorObj,
    refetch: refetchOrder
  } = useQuery<Order, Error>({
    queryKey: ['order', order_id, authToken],
    queryFn: fetchOrderDetail,
    enabled: !!order_id && !!authToken
  });

  // 2. Order items
  const {
    data: orderItems,
    isLoading: orderItemsLoading,
    isError: orderItemsError,
    error: orderItemsErrorObj,
    refetch: refetchOrderItems
  } = useQuery<OrderItem[], Error>({
    queryKey: ['order_items', order_id, authToken],
    queryFn: fetchOrderItems,
    enabled: !!order_id && !!authToken
  });

  // 3. Order status/timeline
  const {
    data: orderStatusHistory,
    isLoading: orderStatusLoading,
    isError: orderStatusError,
    error: orderStatusErrorObj,
    refetch: refetchOrderStatus
  } = useQuery<OrderStatusHistory[], Error>({
    queryKey: ['order_status_history', order_id, authToken],
    queryFn: fetchOrderStatusHistory,
    enabled: !!order_id && !!authToken
  });

  // 4. Customer user (for sidebar/contact)
  const user_id_on_order = order?.user_id || '';
  const {
    data: customerUser,
    isLoading: userLoading,
    isError: userError,
    error: userErrorObj
  } = useQuery<User, Error>({
    queryKey: ['user', user_id_on_order, authToken],
    queryFn: fetchUser,
    enabled: !!user_id_on_order && !!authToken
  });

  // Memo: allowed status transitions for current order status
  const allowedStatus = useMemo(() => {
    if (!order) return [];
    return ORDER_STATUS_TRANSITIONS[order.status] || [];
  }, [order]);

  // Derived: order date display
  const orderCreated = order ? (new Date(order.created_at)).toLocaleString() : '';
  const orderUpdated = order ? (new Date(order.updated_at)).toLocaleString() : '';
  const orderCancelled = order?.cancelled_at ? (new Date(order.cancelled_at)).toLocaleString() : null;

  // Mutations: Update status
  const updateOrderStatusMutation = useMutation({
    mutationFn: async (status: string) => {
      if (!order || !authToken) throw new Error("No order or not authenticated");
      let payload: any = { order_id: order.order_id };
      let nowISOString = new Date().toISOString();
      if (status === 'cancelled') {
        payload = {
          ...payload,
          status,
          cancelled_at: nowISOString,
          cancelled_by_user_id: currentUser?.user_id
        };
      } else {
        payload = { ...payload, status };
      }
      const { data } = await axios.patch<Order>(
        `${API_BASE}/orders/${encodeURIComponent(order.order_id)}`,
        payload,
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
      return data;
    },
    onSuccess: (ret) => {
      queryClient.invalidateQueries(['order', order_id, authToken]);
      queryClient.invalidateQueries(['order_status_history', order_id, authToken]);
      setShowStatusDialog(false);
      setChangeStatus('');
      setMutationError(null);
    },
    onError: (err: any) => {
      let msg = err.response?.data?.message || err.message || 'Order status update failed';
      setMutationError(msg);
      setError(msg, 'update_status');
    },
  });

  // Mutate: Add to status history log (note entry)
  const addOrderStatusHistoryMutation = useMutation({
    mutationFn: async (status: string) => {
      if (!order || !authToken || !currentUser) throw new Error("No order or not authenticated");
      setNoteMutationLoading(true);
      const payload = {
        order_id: order.order_id,
        status,
        updated_by_user_id: currentUser.user_id
      };
      await axios.post(
        `${API_BASE}/orders/${encodeURIComponent(order.order_id)}/status-history`,
        payload,
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['order_status_history', order_id, authToken]);
      setNoteInput('');
      setMutationError(null);
      setNoteMutationLoading(false);
    },
    onError: (err: any) => {
      let msg = err.response?.data?.message || err.message || 'Failed to add note';
      setMutationError(msg);
      setError(msg, 'add_status_note');
      setNoteMutationLoading(false);
    }
  });

  // Delete mutation
  const deleteOrderMutation = useMutation({
    mutationFn: async () => {
      if (!order || !authToken) throw new Error("No order or not authenticated");
      await axios.delete(`${API_BASE}/orders/${encodeURIComponent(order.order_id)}`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
    },
    onSuccess: () => {
      // After delete, go back to admin orders listing
      setShowDeleteConfirm(false);
      setMutationError(null);
      navigate('/admin/orders');
    },
    onError: (err: any) => {
      let msg = err.response?.data?.message || err.message || 'Order deletion failed';
      setMutationError(msg);
      setError(msg, 'delete_order');
    },
  });

  // Print/export handler
  const handlePrint = () => {
    window.print();
  };

  // --- Render ---
  return (
    <>
      <div className="max-w-7xl mx-auto w-full min-h-screen py-10 px-4 md:px-6 bg-gray-50">
        {/* Top Bar */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Admin: Order Details
              {order && (
                <span className={`ml-3 inline-block px-3 py-1 rounded-lg text-xs font-semibold ${ORDER_STATUS_COLOR[order.status] || 'bg-gray-200 text-gray-800'}`}>
                  {ORDER_STATUS_LABEL[order.status] || order.status}
                </span>
              )}
            </h1>
            {order && <p className="text-gray-500 text-sm mt-1">Order #{order.order_number} — Placed {orderCreated}</p>}
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={handlePrint}
              type="button"
              className="inline-flex items-center rounded-md px-3 py-2 bg-white border border-gray-200 text-gray-700 shadow-sm hover:bg-gray-100 transition"
              aria-label="Print/Export Order"
              tabIndex={0}
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 20 20"><path d="M6 11V7a4 4 0 118 0v4"/></svg>
              Print/Export
            </button>
            <Link
              to="/admin/orders"
              className="inline-flex items-center px-3 py-2 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
            >
              Back to Orders
            </Link>
          </div>
        </div>

        {/* Error notification */}
        {(orderError || orderItemsError || orderStatusError || mutationError) && (
          <div className="mb-6" aria-live="polite">
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
              <p className="text-sm font-semibold">{
                orderErrorObj?.message ||
                orderItemsErrorObj?.message ||
                orderStatusErrorObj?.message ||
                mutationError ||
                "An error occurred loading this order."
              }</p>
            </div>
          </div>
        )}

        {/* Main split grid */}
        <div className="flex flex-col md:flex-row gap-8 print:block">
          {/* Left: Customer/Order summary */}
          <aside className="w-full md:w-1/4 flex-shrink-0 bg-white rounded-lg shadow-md p-6 print:bg-white print:shadow-none print:p-0 mb-8 md:mb-0">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Customer / Contact</h2>
            {userLoading ? (
              <div className="text-gray-500 text-sm">Loading customer...</div>
            ) : userError ? (
              <div className="text-red-600 text-sm">{userErrorObj?.message || "Could not load user"}</div>
            ) : customerUser ? (
              <>
                <div className="flex items-center gap-2">
                  {customerUser.profile_image_url ? (
                    <img
                      src={customerUser.profile_image_url}
                      alt={`Avatar of ${customerUser.name}`}
                      className="h-10 w-10 rounded-full object-cover"
                    />
                  ) : (
                    <span className="inline-flex items-center justify-center h-10 w-10 rounded-full bg-blue-100 text-blue-700 font-bold">
                      {customerUser.name.slice(0, 1).toUpperCase()}
                    </span>
                  )}
                  <span className="ml-2 text-gray-900 font-medium">{customerUser.name}</span>
                </div>
                <div className="mt-4 flex flex-col gap-2">
                  <div className="text-gray-700 flex items-center gap-2">
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 20 20"><path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z"/><path d="M18 8.118l-8 4-8-4M18 8v6a2 2 0 01-2 2H4a2 2 0 01-2-2V8"/></svg>
                    <span className="text-xs">{customerUser.email}</span>
                  </div>
                  <div className="text-gray-700 flex items-center gap-2">
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 20 20"><path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z"/><path d="M18 8.118l-8 4-8-4M18 8v6a2 2 0 01-2 2H4a2 2 0 01-2-2V8"/></svg>
                    <span className="text-xs">{order?.phone}</span>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-xs text-gray-400">No customer details</div>
            )}
            <hr className="my-5" />
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Shipping/Billing</h2>
            <div className="text-xs text-gray-700">
              <span className="font-semibold">Shipping: </span>
              <span className="whitespace-pre-line">{order?.shipping_address}</span>
            </div>
            <div className="text-xs text-gray-700">
              <span className="font-semibold">Billing: </span>
              <span className="whitespace-pre-line">{order?.billing_address}</span>
            </div>
            <div className="mt-5 text-xs text-gray-400">
              <span className="font-semibold text-gray-500">Order created:</span> {orderCreated}
            </div>
            <div className="text-xs text-gray-400">
              <span className="font-semibold text-gray-500">Last updated:</span> {orderUpdated}
            </div>
            {orderCancelled && (
              <div className="text-xs text-red-500">
                <span className="font-semibold">Cancelled:</span> {orderCancelled}
              </div>
            )}
          </aside>

          {/* Right: Details */}
          <section className="flex-1 w-full print:w-full">
            {/* Order summary */}
            <div className="bg-white rounded-lg shadow-md p-6 mb-8 print:shadow-none print:bg-white print:p-0">
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Order Summary</h2>
              
              {/* Totals Table */}
              <div className="overflow-x-auto">
                <table className="min-w-full border-separate border-spacing-y-1">
                  <tbody>
                    <tr>
                      <td className="py-1 text-gray-500 font-medium">Order Number</td>
                      <td className="py-1 text-gray-900">{order?.order_number}</td>
                    </tr>
                    <tr>
                      <td className="py-1 text-gray-500 font-medium">Status</td>
                      <td className="py-1">
                        {order && (
                          <span className={`inline-block px-2 py-1 rounded-lg text-xs font-semibold ${ORDER_STATUS_COLOR[order.status] || 'bg-gray-200 text-gray-800'}`}>
                            {ORDER_STATUS_LABEL[order.status] || order.status}
                          </span>
                        )}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-1 text-gray-500 font-medium">Subtotal</td>
                      <td className="py-1">${order?.subtotal.toFixed(2)}</td>
                    </tr>
                    <tr>
                      <td className="py-1 text-gray-500 font-medium">Tax</td>
                      <td className="py-1">${order?.tax.toFixed(2)}</td>
                    </tr>
                    <tr>
                      <td className="py-1 text-gray-500 font-medium">Shipping</td>
                      <td className="py-1">${order?.shipping.toFixed(2)}</td>
                    </tr>
                    <tr>
                      <td className="py-1 text-gray-800 font-bold">Total</td>
                      <td className="py-1 text-green-700 font-bold">${order?.total.toFixed(2)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Order Items Table */}
            <div className="bg-white rounded-lg shadow-md p-6 mb-8 print:shadow-none print:bg-white print:p-0">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Line Items</h2>
              {orderItemsLoading ? (
                <div className="text-gray-400">Loading items...</div>
              ) : orderItemsError ? (
                <div className="text-red-600">{orderItemsErrorObj?.message || "Could not load order items"}</div>
              ) : orderItems && orderItems.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm border-collapse mt-2">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="px-3 py-2 font-semibold text-gray-600">Product</th>
                        <th className="px-3 py-2 font-semibold text-gray-600">Quantity</th>
                        <th className="px-3 py-2 font-semibold text-gray-600">Unit Price</th>
                        <th className="px-3 py-2 font-semibold text-gray-600">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orderItems.map(item => (
                        <tr key={item.order_item_id} className="border-b hover:bg-gray-50">
                          <td className="flex items-center px-3 py-2">
                            <img
                              src={item.image_url || `https://picsum.photos/seed/${item.product_id}/48/48`}
                              alt={item.name}
                              className="w-10 h-10 rounded object-cover mr-3 border border-gray-200"
                            />
                            <Link
                              to={`/products/${item.product_id}`}
                              className="text-blue-700 hover:underline text-sm"
                              tabIndex={0}
                            >
                              {item.name}
                            </Link>
                          </td>
                          <td className="px-3 py-2 text-center">{item.quantity}</td>
                          <td className="px-3 py-2">${item.price.toFixed(2)}</td>
                          <td className="px-3 py-2">${(item.price * item.quantity).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-xs text-gray-500">No items in this order.</div>
              )}
            </div>

            {/* Status Timeline & Controls */}
            <div className="bg-white rounded-lg shadow-md p-6 mb-8 print:shadow-none print:bg-white print:p-0">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Status Timeline</h2>
                {/* Status change action */}
                {order && allowedStatus.length > 0 && (
                  <>
                    <button
                      type="button"
                      onClick={() => setShowStatusDialog(!showStatusDialog)}
                      className="inline-flex items-center px-3 py-2 rounded-md bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 focus:outline-none"
                      disabled={updateOrderStatusMutation.isLoading}
                      aria-label="Change order status"
                      tabIndex={0}
                    >
                      {updateOrderStatusMutation.isLoading && (
                        <svg className="animate-spin w-4 h-4 mr-1 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      )}
                      Update Status
                    </button>
                  </>
                )}
              </div>
              {/* Status change dialog */}
              {showStatusDialog && order && allowedStatus.length > 0 && (
                <div className="my-4 p-4 border border-gray-200 rounded-md bg-gray-50">
                  <form
                    onSubmit={e => {
                      e.preventDefault();
                      if (!changeStatus) return;
                      updateOrderStatusMutation.mutate(changeStatus);
                    }}
                  >
                    <label htmlFor="new_status" className="block font-semibold text-sm mb-1">Select new status:</label>
                    <select
                      id="new_status"
                      name="new_status"
                      required
                      value={changeStatus}
                      onChange={e => {
                        setChangeStatus(e.target.value);
                        setMutationError(null);
                        clearError();
                      }}
                      className="w-full mt-1 px-3 py-2 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500 text-sm"
                    >
                      <option value="">Choose…</option>
                      {allowedStatus.map(status =>
                        <option key={status} value={status}>
                          {ORDER_STATUS_LABEL[status] || status}
                        </option>
                      )}
                    </select>
                    <div className="mt-4 flex gap-3">
                      <button
                        type="submit"
                        className="px-4 py-2 bg-indigo-700 text-white rounded hover:bg-indigo-800 text-sm"
                        disabled={!changeStatus || updateOrderStatusMutation.isLoading}
                      >
                        {updateOrderStatusMutation.isLoading ? "Saving..." : "Update"}
                      </button>
                      <button
                        type="button"
                        className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 text-sm"
                        onClick={() => {
                          setShowStatusDialog(false);
                          setChangeStatus('');
                          setMutationError(null);
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                  {mutationError && (
                    <div className="text-red-600 mt-3 text-xs" aria-live="polite">{mutationError}</div>
                  )}
                </div>
              )}

              {/* Timeline table */}
              {orderStatusLoading ? (
                <div className="text-gray-400 mt-2">Loading status history...</div>
              ) : orderStatusError ? (
                <div className="text-red-600 mt-2">{orderStatusErrorObj?.message || "Could not load history"}</div>
              ) : orderStatusHistory && orderStatusHistory.length > 0 ? (
                <div>
                  <ol className="relative border-l border-gray-300 ml-2">
                    {orderStatusHistory.slice().sort((a, b) =>
                      new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime()
                    ).map((h, idx) => (
                      <li key={h.order_status_history_id} className="mb-6 ml-4">
                        <div className="absolute w-3 h-3 bg-gray-200 rounded-full mt-1.5 -left-1.5 border border-gray-400"></div>
                        <div>
                          <span className="font-semibold">{ORDER_STATUS_LABEL[h.status] || h.status}</span>{" "}
                          <span className="text-xs text-gray-400 ml-2">{(new Date(h.updated_at)).toLocaleString()}</span>
                        </div>
                        <div className="text-xs text-gray-600">
                          By: <span className="font-semibold">{h.updated_by_user_id === customerUser?.user_id ? 'Customer' : h.updated_by_user_id === currentUser?.user_id ? 'Admin (You)' : h.updated_by_user_id}</span>
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>
              ) : (
                <div className="text-xs text-gray-500 mt-2">No status history yet.</div>
              )}

              {/* Add note to timeline */}
              <form
                className="mt-6 flex flex-col sm:flex-row gap-3 print:hidden"
                onSubmit={e => {
                  e.preventDefault();
                  if (!noteInput.trim()) return;
                  addOrderStatusHistoryMutation.mutate(noteInput.trim());
                }}
              >
                <input
                  type="text"
                  value={noteInput}
                  onChange={e => {
                    setMutationError(null);
                    clearError();
                    setNoteInput(e.target.value);
                  }}
                  className="border border-gray-300 rounded px-3 py-2 w-full focus:border-blue-500 focus:ring-blue-500 text-sm"
                  placeholder="Add an order note or log a manual entry..."
                  disabled={noteMutationLoading}
                  aria-label="Add order note"
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                  disabled={noteMutationLoading || !noteInput.trim()}
                >
                  {noteMutationLoading ? "Adding..." : "Add Note"}
                </button>
              </form>
            </div>

            {/* Danger Zone */}
            <div className="bg-white rounded-lg shadow-md p-6 print:hidden">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold text-red-700">Danger Zone</h2>
                <button
                  type="button"
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded text-sm"
                  onClick={() => setShowDeleteConfirm(true)}
                  aria-label="Delete/void order"
                >
                  Delete/Cancel Order
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-2">
                This action <span className="font-semibold text-red-600">cannot be undone</span>. Only delete orders that have been voided/cancelled per company policy.
              </p>
            </div>

            {/* Confirm delete dialog */}
            {showDeleteConfirm && (
              <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50" aria-modal="true" role="dialog">
                <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full">
                  <h2 className="text-lg font-semibold text-red-600">Confirm Delete Order</h2>
                  <p className="mt-2 text-gray-700">
                    Are you sure you want to permanently delete this order? <br />
                    This action cannot be undone.
                  </p>
                  <div className="mt-6 flex space-x-3">
                    <button
                      className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
                      onClick={() => deleteOrderMutation.mutate()}
                      disabled={deleteOrderMutation.isLoading}
                    >
                      {deleteOrderMutation.isLoading ? "Deleting..." : "Delete Order"}
                    </button>
                    <button
                      className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 text-sm"
                      onClick={() => setShowDeleteConfirm(false)}
                    >
                      Cancel
                    </button>
                  </div>
                  {mutationError && (
                    <div className="mt-3 text-red-600 text-xs" aria-live="polite">{mutationError}</div>
                  )}
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </>
  );
};

export default UV_Admin_OrderDetail;