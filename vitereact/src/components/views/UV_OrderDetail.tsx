import React, { useEffect, useState, useRef } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useAppStore } from "@/store/main";
import axios from "axios";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
// -- Zod types: import via @schema
import type { Order, OrderItem, OrderStatusHistory } from "@schema";

// --- API BASE ---
const API_BASE = `${import.meta.env.VITE_API_BASE_URL || "http://localhost:3000"}`;

// --- STATUS LABELS + COLORS ---
const STATUS_LABELS: Record<string, string> = {
  created: "Created",
  processing: "Processing",
  shipped: "Shipped",
  delivered: "Delivered",
  completed: "Completed",
  cancelled: "Cancelled",
};
const STATUS_COLORS: Record<string, string> = {
  created: "bg-blue-100 text-blue-800",
  processing: "bg-yellow-100 text-yellow-800",
  shipped: "bg-cyan-100 text-cyan-800",
  delivered: "bg-green-100 text-green-800",
  completed: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-700",
};

const UV_OrderDetail: React.FC = () => {
  // --- Route Param: orderId ---
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();

  // --- Global Auth State (Zustand, selectors only, never object destructure) ---
  const currentUser = useAppStore((state) => state.authentication_state.current_user);
  const authToken = useAppStore((state) => state.authentication_state.auth_token);
  const socket = useAppStore((state) => state.socket);

  // ---- React Query Client
  const queryClient = useQueryClient();

  // --- Local state for cancel confirmation modal management ---
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const cancelButtonRef = useRef<HTMLButtonElement | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);

  // --- Data Fetchers ---
  // 1. Order Details
  const fetchOrder = async (id: string): Promise<Order> => {
    const { data } = await axios.get(`${API_BASE}/orders/${encodeURIComponent(id)}`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    return data as Order;
  };

  // 2. Order Items
  const fetchOrderItems = async (id: string): Promise<OrderItem[]> => {
    const { data } = await axios.get(`${API_BASE}/orders/${encodeURIComponent(id)}/items`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    if ("order_items" in data) return data.order_items as OrderItem[];
    // Defensive: fallback in case backend returns array directly
    return Array.isArray(data) ? data : [];
  };

  // 3. Order Status Timeline
  const fetchOrderStatusHistory = async (id: string): Promise<OrderStatusHistory[]> => {
    const { data } = await axios.get(`${API_BASE}/orders/${encodeURIComponent(id)}/status-history`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    if ("order_status_histories" in data) return data.order_status_histories as OrderStatusHistory[];
    return Array.isArray(data) ? data : [];
  };

  // ----------- Data Queries (React Query) -----------
  const {
    data: order,
    isLoading: isOrderLoading,
    isError: isOrderError,
    error: orderError,
    refetch: refetchOrder,
  } = useQuery<Order, Error>({
    queryKey: ["order", orderId],
    queryFn: () => fetchOrder(orderId ?? ""),
    enabled: !!orderId && !!authToken,
    retry: 1,
  });

  const {
    data: orderItems,
    isLoading: isItemsLoading,
    isError: isItemsError,
    error: itemsError,
    refetch: refetchOrderItems,
  } = useQuery<OrderItem[], Error>({
    queryKey: ["orderItems", orderId],
    queryFn: () => fetchOrderItems(orderId ?? ""),
    enabled: !!orderId && !!authToken,
    retry: 1,
  });

  const {
    data: statusHistory,
    isLoading: isStatusLoading,
    isError: isStatusError,
    error: statusError,
    refetch: refetchStatusHistory,
  } = useQuery<OrderStatusHistory[], Error>({
    queryKey: ["orderStatusHistory", orderId],
    queryFn: () => fetchOrderStatusHistory(orderId ?? ""),
    enabled: !!orderId && !!authToken,
    retry: 1,
  });

  // --- Derived state: can the user cancel? ---
  const canCancel =
    order &&
    order.status === "created" &&
    currentUser &&
    order.user_id === currentUser.user_id;

  // --- Cancel Order Mutation ---
  const cancelOrderMutation = useMutation<Order, Error, void>({
    mutationFn: async () => {
      setCancelError(null);
      if (!order || !currentUser) throw new Error("Invalid state");
      const nowIso = new Date().toISOString();
      const payload = {
        order_id: order.order_id,
        status: "cancelled",
        cancelled_at: nowIso,
        cancelled_by_user_id: currentUser.user_id,
      };
      const { data } = await axios.patch(
        `${API_BASE}/orders/${encodeURIComponent(order.order_id)}`,
        payload,
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
      return data as Order;
    },
    onSuccess: () => {
      setShowConfirmModal(false);
      queryClient.invalidateQueries({ queryKey: ["order", orderId] });
      queryClient.invalidateQueries({ queryKey: ["orderStatusHistory", orderId] });
    },
    onError: (error) => {
      setCancelError(error.message || "Unable to cancel order");
    },
  });

  // --- Real-time: listen to order.status.changed for this order, then refetch all queries ---
  useEffect(() => {
    if (!socket || !orderId) return;
    const handler = (payload: any) => {
      if (payload?.order?.order_id === orderId) {
        queryClient.invalidateQueries({ queryKey: ["order", orderId] });
        queryClient.invalidateQueries({ queryKey: ["orderItems", orderId] });
        queryClient.invalidateQueries({ queryKey: ["orderStatusHistory", orderId] });
      }
    };
    socket.on("order.status.changed", handler);
    return () => {
      socket.off("order.status.changed", handler);
    };
    // eslint-disable-next-line
  }, [socket, orderId]);

  // --- UI handlers ---
  const handleCancelClick = () => {
    setShowConfirmModal(true);
  };

  const handleConfirmCancel = () => {
    cancelOrderMutation.mutate();
  };

  const handleCloseModal = () => {
    setShowConfirmModal(false);
    setCancelError(null);
    // restore focus
    cancelButtonRef.current?.focus();
  };

  const handleBackToOrders = () => {
    navigate("/orders", { replace: true });
  };

  // --- UX: Focus trap for modal ---
  useEffect(() => {
    if (showConfirmModal) {
      const focusable = document.querySelectorAll(
        '[tabindex="0"], button, [href], input, select, textarea'
      );
      (focusable[0] as HTMLElement | undefined)?.focus();
    }
  }, [showConfirmModal]);

  // --- Loading State
  if (isOrderLoading || isItemsLoading || isStatusLoading) {
    return (
      <>
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="flex flex-col items-center" aria-busy="true">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
            <div className="text-gray-700">Loading order details...</div>
          </div>
        </div>
      </>
    );
  }

  // --- Error State
  if (isOrderError || isItemsError || isStatusError || !order) {
    const errMsg =
      orderError?.message ||
      itemsError?.message ||
      statusError?.message ||
      "Unable to load order details";
    return (
      <>
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
          <div className="max-w-lg w-full bg-white rounded-lg shadow p-6 text-center border border-gray-200">
            <h2 className="text-2xl font-semibold text-red-600 mb-4">Order not found</h2>
            <p className="text-gray-700 mb-6" aria-live="polite">
              {errMsg}
            </p>
            <Link
              to="/orders"
              className="text-blue-600 hover:text-blue-800 font-medium text-sm underline"
            >
              &larr; Back to My Orders
            </Link>
          </div>
        </div>
      </>
    );
  }

  // --- Timeline: sort by updated_at asc ---
  const timeline = (statusHistory || []).slice().sort((a, b) =>
    new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime()
  );

  // --- Totals row ---
  const subtotal = order.subtotal ?? 0;
  const tax = order.tax ?? 0;
  const shipping = order.shipping ?? 0;
  const total = order.total ?? 0;

  // --- Render Main View ---
  return (
    <>
      <div className="max-w-3xl mx-auto px-2 sm:px-6 lg:px-8 py-8 min-h-screen">
        {/* HEADER + STATUS */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight mb-2">
              Order <span className="text-gray-600">#{order.order_number}</span>
            </h1>
            <p className="text-gray-500 text-sm">
              Placed on {new Date(order.created_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
            </p>
          </div>
          <div className="mt-3 sm:mt-0 flex items-center gap-2">
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[order.status] || "bg-gray-200 text-gray-500"}`}
              aria-label={`Order status: ${order.status}`}
            >
              {STATUS_LABELS[order.status] || order.status}
            </span>
            {order.cancelled_at ? (
              <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700 border border-red-200">
                Cancelled {order.cancelled_at && (
                  <>on {new Date(order.cancelled_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</>
                )}
              </span>
            ) : order.status === "delivered" ? (
              <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">
                Delivered
              </span>
            ) : null}
          </div>
        </div>

        {/* MAIN ORDER BLOCK */}
        <div className={`border rounded-lg p-4 bg-white shadow-sm mb-6 ${order.status === "cancelled" ? "opacity-70" : ""}`}>
          {/* Contact + Address */}
          <section className="grid sm:grid-cols-2 gap-4 mb-6">
            <div>
              <h2 className="text-md font-semibold text-gray-800 mb-1">Contact Info</h2>
              <p className="text-sm text-gray-700"><span className="font-medium">Name:</span> {order.email}</p>
              <p className="text-sm text-gray-700"><span className="font-medium">Email:</span> {order.email}</p>
              <p className="text-sm text-gray-700"><span className="font-medium">Phone:</span> {order.phone}</p>
            </div>
            <div>
              <h2 className="text-md font-semibold text-gray-800 mb-1">Shipping & Billing Address</h2>
              <p className="text-sm text-gray-700 break-words">
                <span className="font-medium">Ship:</span> {order.shipping_address}
              </p>
              <p className="text-sm text-gray-700 break-words">
                <span className="font-medium">Bill:</span> {order.billing_address}
              </p>
            </div>
          </section>

          {/* Timeline */}
          <section aria-label="Order Status Timeline" className="mb-8">
            <h2 className="text-md font-semibold text-gray-800 mb-2">
              Status Timeline
            </h2>
            <ol className="relative border-l border-gray-200 pl-4">
              {timeline.length === 0 ? (
                <li className="text-gray-500 text-sm">No history available.</li>
              ) : (
                timeline.map((hist, idx) => (
                  <li key={hist.order_status_history_id} className="mb-4 ml-2">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-blue-500"></span>
                      <span className="font-medium text-sm text-gray-800">
                        {STATUS_LABELS[hist.status] || hist.status}
                      </span>
                      <span className="text-xs text-gray-400 ml-2">
                        {new Date(hist.updated_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                      </span>
                    </div>
                  </li>
                ))
              )}
            </ol>
          </section>

          {/* CANCELLED "overlay" message */}
          {order.status === "cancelled" && (
            <div className="bg-red-50 border border-red-200 rounded p-3 my-3 text-sm text-red-700 font-medium text-center">
              This order was cancelled.
            </div>
          )}

          {/* Line Items */}
          <section aria-label="Order Items" className="mb-4">
            <h2 className="text-md font-semibold text-gray-800 mb-2">
              Items ({orderItems?.length ?? 0})
            </h2>
            {!orderItems || orderItems.length === 0 ? (
              <div className="text-gray-500 text-sm py-2">No order items found.</div>
            ) : (
              <div className="divide-y divide-gray-100">
                {orderItems.map((item) => (
                  <div className="flex flex-col sm:flex-row items-center py-3 gap-4" key={item.order_item_id}>
                    <Link
                      to={`/products/${item.product_id}`}
                      tabIndex={0}
                      className="flex-shrink-0"
                      aria-label={`View details for ${item.name}`}
                    >
                      <img
                        src={item.image_url || `https://picsum.photos/seed/${item.product_id}/80/80`}
                        alt={item.name}
                        className="w-20 h-20 object-cover rounded shadow border"
                        loading="lazy"
                      />
                    </Link>
                    <div className="flex-grow w-full">
                      <Link
                        to={`/products/${item.product_id}`}
                        className="text-base font-medium text-blue-600 underline focus:outline-none"
                        tabIndex={0}
                        aria-label={`View product ${item.name}`}
                      >
                        {item.name}
                      </Link>
                      <div className="text-sm text-gray-700 mt-0.5">
                        Price: ${item.price.toFixed(2)} &middot; Quantity: {item.quantity}
                      </div>
                      {order.status === "delivered" && (
                        <Link
                          to={`/products/${item.product_id}`}
                          className="inline-block mt-2 px-3 py-1 rounded bg-blue-100 text-blue-700 border border-blue-200 hover:bg-blue-200 transition text-xs font-medium focus:outline focus:ring-2 focus:ring-blue-500"
                          aria-label={`Leave review for ${item.name}`}
                        >
                          Leave Review
                        </Link>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Order Totals */}
          <section aria-label="Totals" className="border-t pt-4 mt-4">
            <div className="flex flex-col gap-1 text-sm text-gray-700">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>${subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Tax</span>
                <span>${tax.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Shipping</span>
                <span>${shipping.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-semibold text-base pt-2">
                <span>Total</span>
                <span>${total.toFixed(2)}</span>
              </div>
            </div>
          </section>
        </div>

        {/* ACTION BAR */}
        <div className="flex flex-col sm:flex-row gap-3 justify-between">
          <div>
            <Link
              to="/orders"
              className="inline-flex items-center px-4 py-2 text-sm font-medium rounded border border-gray-200 text-gray-700 bg-gray-50 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              &larr; Back to Orders
            </Link>
          </div>
          {canCancel && (
            <button
              className="inline-flex items-center px-4 py-2 text-sm font-medium rounded border border-red-700 bg-red-600 text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-400"
              type="button"
              tabIndex={0}
              aria-label="Cancel Order"
              onClick={handleCancelClick}
              ref={cancelButtonRef}
              disabled={cancelOrderMutation.isLoading}
            >
              {cancelOrderMutation.isLoading ? (
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                  fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10"
                    stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                <svg className="h-5 w-5 mr-2 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
              Cancel Order
            </button>
          )}
        </div>

        {/* Cancel Confirmation Modal */}
        {showConfirmModal && (
          <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-50 bg-black bg-opacity-30 flex items-center justify-center"
            tabIndex={-1}
          >
            <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6 focus:outline-none relative" tabIndex={0}>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Cancel this order?</h3>
              <p className="text-sm text-gray-600 mb-4">
                Are you sure you want to cancel this order? This action is <span className="font-semibold text-red-600">not reversible</span>.
              </p>
              {cancelError && (
                <div className="bg-red-50 border border-red-200 rounded p-2 mb-2 text-red-700" aria-live="polite">
                  {cancelError}
                </div>
              )}
              <div className="flex justify-end space-x-2 mt-4">
                <button
                  className="px-4 py-2 text-sm rounded border border-gray-300 text-gray-700 bg-white hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  onClick={handleCloseModal}
                  type="button"
                  tabIndex={0}
                  aria-label="Cancel, do not proceed"
                >
                  Go Back
                </button>
                <button
                  className="px-4 py-2 text-sm font-medium rounded border border-red-700 bg-red-600 text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-400"
                  onClick={handleConfirmCancel}
                  aria-label="Confirm cancel order"
                  disabled={cancelOrderMutation.isLoading}
                  tabIndex={0}
                >
                  {cancelOrderMutation.isLoading ? "Cancelling..." : "Confirm Cancel"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default UV_OrderDetail;