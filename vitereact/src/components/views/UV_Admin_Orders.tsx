import React, { useEffect, useRef, useState, useCallback } from "react";
import { useLocation, useNavigate, Link, createSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { z } from "zod";
import { orderSchema, orderListResponseSchema } from "@schema";
import { useAppStore } from "@/store/main";

// Helper: Parse query strings to urlParams object and vice versa
function parseQuery(qs: string): Record<string, string> {
  const params = new URLSearchParams(qs.startsWith("?") ? qs : "?" + qs);
  const out: Record<string, string> = {};
  params.forEach((v, k) => {
    out[k] = v;
  });
  return out;
}
// Only include valid param keys (avoid letting users inject arbitrary keys)
const VALID_QUERY_KEYS = ["status", "user_id", "vendor_id", "date_range", "query", "page"];

// Constants
const ORDER_STATUS_OPTIONS = [
  { value: "", label: "All" },
  { value: "created", label: "Created" },
  { value: "processing", label: "Processing" },
  { value: "shipped", label: "Shipped" },
  { value: "delivered", label: "Delivered" },

  { value: "cancelled", label: "Cancelled" },
];

// Type safety - strict match zod schema
type Order = z.infer<typeof orderSchema>;

// Table page size
const PAGE_SIZE = 20;

const API_BASE = `${import.meta.env.VITE_API_BASE_URL || "http://localhost:3000"}`;

const CSV_HEADERS = [
  "Order ID",
  "Order Number",
  "User ID",
  "Email",
  "Status",
  "Subtotal",
  "Tax",
  "Shipping",
  "Total",
  "Shipping Address",
  "Billing Address",
  "Phone",
  "Created At",
  "Updated At",
  "Cancelled At",
  "Cancelled By User ID",
];

// The main view
const UV_Admin_Orders: React.FC = () => {
  // Global state: auth
  const authToken = useAppStore((state) => state.authentication_state.auth_token);
  const socket = useAppStore((state) => state.socket);
  const setError = useAppStore((state) => state.set_error);
  const queryClient = useQueryClient();

  // Routing
  const location = useLocation();
  const navigate = useNavigate();

  // Filters: get from URL, or set defaults
  const initialUrlParams = { ...Object.fromEntries(VALID_QUERY_KEYS.map(k => [k, ""])), ...parseQuery(location.search) };
  const [filters, setFilters] = useState<Record<string, string>>(initialUrlParams);

  // For controlled UI
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [isExporting, setIsExporting] = useState(false);

  // Error/message UI
  const [formError, setFormError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // For date picker (YYYY-MM-DD)
  const [dateRange, setDateRange] = useState<{ from: string; to: string }>({
    from: filters["date_range"]?.split(":")[0] || "",
    to: filters["date_range"]?.split(":")[1] || "",
  });

  // For live websocket refetch
  const wsRef = useRef(socket);

  // Keep filters in sync with URL
  useEffect(() => {
    const params: Record<string, string> = {};
    for (const k of VALID_QUERY_KEYS)
      if (filters[k]) params[k] = filters[k];
    if (Object.keys(params).length) {
      navigate({
        pathname: "/admin/orders",
        search: `?${createSearchParams(params)}`,
      }, { replace: true });
    } else {
      navigate("/admin/orders", { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  // React Query: Fetch orders
  const {
    data: ordersData,
    refetch,
    isLoading,
    isFetching,
    isError,
    error,
  } = useQuery({
    queryKey: [
      "admin-orders",
      filters.status,
      filters.user_id,
      filters.vendor_id,
      filters.query,
      filters.page,
      filters.date_range,
    ],
    queryFn: async () => {
      // Translate filters to backend params
      const params: any = {};
      if (filters.status) params.status = filters.status;
      if (filters.user_id) params.user_id = filters.user_id;
      if (filters.vendor_id) params.vendor_id = filters.vendor_id;
      if (filters.query) params.query = filters.query;
      if (filters.page && !isNaN(Number(filters.page))) {
        params.limit = PAGE_SIZE;
        params.offset = (Math.max(1, Number(filters.page)) - 1) * PAGE_SIZE;
      } else {
        params.limit = PAGE_SIZE;
        params.offset = 0;
      }
      // Note: backend does not support date_range natively, we will filter after fetch
      const res = await axios.get(
        `${API_BASE}/orders`,
        {
          params,
          headers: { Authorization: `Bearer ${authToken}` },
        }
      );
      // Strict validation
      const parsed = orderListResponseSchema.safeParse(res.data);
      if (!parsed.success) {
        throw new Error("Bad API response: " + parsed.error.message);
      }
      return parsed.data;
    },
    enabled: !!authToken,
    placeholderData: (previousData) => previousData,
    staleTime: 30000,
  });

  // Mutations
  const updateOrderStatusMutation = useMutation({
    mutationFn: async ({
      orderId,
      newStatus,
    }: {
      orderId: string;
      newStatus: Order["status"];
    }) => {
      const res = await axios.patch(
        `${API_BASE}/orders/${orderId}`,
        { order_id: orderId, status: newStatus },
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
      return orderSchema.parse(res.data);
    },
    onSuccess: () => {
      refetch();
      setSuccessMsg("Order status updated.");
    },
    onError: (err: any) => {
      setFormError(err?.response?.data?.message || err.message || "Failed to update order status");
    },
  });

  const deleteOrderMutation = useMutation({
    mutationFn: async (orderId: string) => {
      await axios.delete(
        `${API_BASE}/orders/${orderId}`,
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
      return orderId;
    },
    onSuccess: () => {
      refetch();
      setSuccessMsg("Order deleted.");
    },
    onError: (err: any) => {
      setFormError(err?.response?.data?.message || err.message || "Failed to delete order");
    },
  });

  // WebSocket/live events for reloading on backend order updates
  useEffect(() => {
    wsRef.current = socket;
    if (!socket) return;
    const handleOrderEvent = () => {
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
    };
    socket.on("order.status.changed", handleOrderEvent);
    socket.on("order.created", handleOrderEvent);
    socket.on("order.cancelled", handleOrderEvent);
    return () => {
      socket.off("order.status.changed", handleOrderEvent);
      socket.off("order.created", handleOrderEvent);
      socket.off("order.cancelled", handleOrderEvent);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, queryClient]);

  // --- Date filtering is client-side only! ---
  const getFilteredOrders = useCallback((): Order[] => {
    if (!ordersData) return [];
    let rows = ordersData.orders;
    if (dateRange.from || dateRange.to) {
      rows = rows.filter((order) => {
        const created = new Date(order.created_at);
        if (dateRange.from && created < new Date(dateRange.from)) return false;
        if (dateRange.to && created > new Date(dateRange.to + "T23:59:59.999Z")) return false;
        return true;
      });
    }
    return rows;
  }, [ordersData, dateRange.from, dateRange.to]);

  // --- Pagination ---
  const page = Number(filters.page) > 0 ? Number(filters.page) : 1;
  const totalOrders = ordersData?.total || 0;
  const lastPage = Math.max(1, Math.ceil(totalOrders / PAGE_SIZE));

  // --- Filter Form Handlers ---
  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFilters((prev) => ({
      ...prev,
      [name]: value,
      page: "1", // Reset to first page on filter change
    }));
    setFormError(null);
    setSuccessMsg(null);
  };
  // Date range changes
  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setDateRange((prev) => ({
      ...prev,
      [name]: value,
    }));
    setFormError(null);
    setSuccessMsg(null);
    // Set to url param
    const from = name === "from" ? value : dateRange.from;
    const to = name === "to" ? value : dateRange.to;
    setFilters((prev) => ({
      ...prev,
      date_range: from || to ? `${from || ""}:${to || ""}` : "",
      page: "1",
    }));
  };

  // Search input handles "Enter" key too
  const filterFormRef = useRef<HTMLFormElement>(null);

  // --- Bulk selection ---
  const allOnPageIds = getFilteredOrders().map((o) => o.order_id);
  const isAllSelected = selectedOrders.length === allOnPageIds.length && allOnPageIds.length > 0;

  const handleSelectOrder = (orderId: string, checked: boolean) => {
    setSelectedOrders((prev) =>
      checked ? [...prev, orderId] : prev.filter((id) => id !== orderId)
    );
  };
  const handleSelectAll = (checked: boolean) => {
    setSelectedOrders(checked ? allOnPageIds : []);
  };

  // --- Order row actions ---
  const handleUpdateStatus = (orderId: string, nextStatus: Order["status"]) => {
    setFormError(null);
    setSuccessMsg(null);
    updateOrderStatusMutation.mutate({ orderId, newStatus: nextStatus });
  };
  const handleDeleteOrder = (orderId: string) => {
    setFormError(null);
    setSuccessMsg(null);
    if (!window.confirm("Are you sure you want to delete this order? This cannot be undone.")) return;
    deleteOrderMutation.mutate(orderId);
  };

  // --- CSV Export ---
  const handleExportCsv = async () => {
    setIsExporting(true);
    try {
      const rows = getFilteredOrders();
      const lines = [
        CSV_HEADERS.join(","),
        ...rows.map((o) =>
          [
            o.order_id,
            `"${o.order_number}"`,
            o.user_id,
            o.email,
            o.status,
            o.subtotal.toFixed(2),
            o.tax.toFixed(2),
            o.shipping.toFixed(2),
            o.total.toFixed(2),
            `"${(o.shipping_address || "").replace(/"/g, '""')}"`,
            `"${(o.billing_address || "").replace(/"/g, '""')}"`,
            `"${o.phone || ""}"`,
            `"${o.created_at}"`,
            `"${o.updated_at}"`,
            `"${o.cancelled_at || ""}"`,
            `"${o.cancelled_by_user_id || ""}"`,
          ].join(",")
        ),
      ];
      const blob = new Blob([lines.join("\n")], { type: "text/csv" });

      // Download immediately
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `orders_export_${new Date().toISOString().replace(/[:.]/g, "-")}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setError(e.message || "Export failed", "exportOrderData");
    }
    setIsExporting(false);
  };

  // --- Clear notices on unmount
  useEffect(() => {
    return () => {
      setFormError(null);
      setSuccessMsg(null);
    };
  }, []);

  // --- Render
  return (
    <>
      <div className="max-w-7xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Order Management</h1>
        <p className="mb-4 text-gray-600">
          Search, filter, and manage all customer orders. Export as CSV or update status inline.
        </p>
        {/* Filters */}
        <form
          ref={filterFormRef}
          className="mb-4 grid grid-cols-1 md:grid-cols-4 lg:grid-cols-6 gap-3 items-end"
          onSubmit={e => { e.preventDefault(); }}
        >
          <div>
            <label htmlFor="query" className="block text-xs font-medium text-gray-700">Search</label>
            <input
              id="query"
              name="query"
              value={filters.query}
              onChange={handleFilterChange}
              type="text"
              placeholder="Order # or Email"
              autoComplete="off"
              className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1 focus:ring-blue-500 focus:border-blue-500 text-sm"
            />
          </div>
          <div>
            <label htmlFor="status" className="block text-xs font-medium text-gray-700">Status</label>
            <select
              id="status"
              name="status"
              value={filters.status}
              onChange={handleFilterChange}
              className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
            >
              {ORDER_STATUS_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="user_id" className="block text-xs font-medium text-gray-700">Customer ID</label>
            <input
              id="user_id"
              name="user_id"
              value={filters.user_id}
              onChange={handleFilterChange}
              type="text"
              placeholder="user_xxx"
              className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
            />
          </div>
          <div>
            <label htmlFor="vendor_id" className="block text-xs font-medium text-gray-700">Vendor ID</label>
            <input
              id="vendor_id"
              name="vendor_id"
              value={filters.vendor_id}
              onChange={handleFilterChange}
              type="text"
              placeholder="vendor_xxx"
              className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
            />
          </div>
          <div>
            <label htmlFor="date_from" className="block text-xs font-medium text-gray-700">From</label>
            <input
              id="date_from"
              name="from"
              type="date"
              value={dateRange.from}
              onChange={handleDateChange}
              className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
            />
          </div>
          <div>
            <label htmlFor="date_to" className="block text-xs font-medium text-gray-700">To</label>
            <input
              id="date_to"
              name="to"
              type="date"
              value={dateRange.to}
              onChange={handleDateChange}
              className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
            />
          </div>
        </form>
        <div className="mb-3 flex flex-wrap items-center gap-2 justify-between">
          <button
            className="bg-blue-600 text-white rounded px-3 py-1 text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50"
            disabled={isExporting || !getFilteredOrders().length}
            onClick={() => handleExportCsv()}
            aria-label="Export filtered orders as CSV"
          >
            {isExporting ? "Exporting..." : "Export CSV"}
          </button>
          <div className="flex items-center gap-2">
            {selectedOrders.length > 0 && (
              <span className="text-sm text-gray-900">{selectedOrders.length} selected</span>
            )}
          </div>
        </div>
        {(formError || isError || error) && (
          <div
            className="mb-3 bg-red-50 border border-red-200 text-red-800 px-3 py-2 rounded"
            aria-live="polite"
          >
            {formError || (error as any)?.message || "There was an error loading orders."}
          </div>
        )}
        {successMsg && (
          <div className="mb-3 bg-green-50 border border-green-200 text-green-900 px-3 py-2 rounded" aria-live="polite">
            {successMsg}
          </div>
        )}
        <div className="overflow-x-auto rounded border bg-white mb-6">
          <table className="min-w-full divide-y divide-gray-200 text-xs">
            <thead>
              <tr className="bg-gray-100">
                <th className="pr-2 pl-4 py-2 text-left">
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    onChange={e => handleSelectAll(e.target.checked)}
                    aria-label="Select all orders on this page"
                  />
                </th>
                <th className="py-2 text-left font-semibold">Order #</th>
                <th className="py-2 text-left font-semibold">Customer</th>
                <th className="py-2 text-left font-semibold">Email</th>
                <th className="py-2 text-left font-semibold">Status</th>
                <th className="py-2 text-left font-semibold">Total</th>
                <th className="py-2 text-left font-semibold">Date</th>
                <th className="py-2 text-left font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading || isFetching ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-gray-500">
                    <svg className="animate-spin mx-auto h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                  </td>
                </tr>
              ) : (
                getFilteredOrders().length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-6 text-gray-500">
                      No orders found.
                    </td>
                  </tr>
                ) : (
                  getFilteredOrders().map((order) => (
                    <tr
                      key={order.order_id}
                      className={`hover:bg-blue-50 transition cursor-pointer border-b`}
                      tabIndex={0}
                      onClick={e => {
                        // Only row click (ignore checkbox/button)
                        if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'BUTTON') return;
                        navigate(`/admin/orders/${order.order_id}`);
                      }}
                    >
                      <td className="pr-2 pl-4">
                        <input
                          type="checkbox"
                          checked={selectedOrders.includes(order.order_id)}
                          onChange={e => handleSelectOrder(order.order_id, e.target.checked)}
                          onClick={e => e.stopPropagation()}
                          aria-label={`Select order ${order.order_number}`}
                        />
                      </td>
                      <td className="py-1 font-medium text-blue-600">
                        <Link
                          to={`/admin/orders/${order.order_id}`}
                          className="hover:underline"
                          tabIndex={0}
                          onClick={e => e.stopPropagation()}
                        >
                          {order.order_number}
                        </Link>
                      </td>
                      <td className="py-1">
                        {order.user_id}
                      </td>
                      <td className="py-1">{order.email}</td>
                      <td className="py-1">
                        <span className={`inline-block rounded px-2 py-0.5 text-xs font-semibold ${
                          order.status === 'delivered'
                            ? 'bg-green-100 text-green-800'
                            : order.status === 'processing'
                            ? 'bg-yellow-100 text-yellow-800'
                            : order.status === 'cancelled'
                            ? 'bg-gray-200 text-gray-700'
                            : order.status === 'shipped'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {order.status}
                        </span>
                      </td>
                      <td className="py-1 text-right font-semibold">${order.total.toFixed(2)}</td>
                      <td className="py-1">
                        {order.created_at
                          ? new Date(order.created_at).toLocaleDateString()
                          : "--"}
                      </td>
                      <td className="py-1">
                        <div className="flex gap-1 items-center">
                          <Link
                            to={`/admin/orders/${order.order_id}`}
                            className="text-blue-600 hover:text-blue-800 px-1"
                            aria-label="View order details"
                            tabIndex={0}
                            title="View details"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="inline h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12H9m6 0a3 3 0 11-6 0 3 3 0 016 0zm-6 4v2a2 2 0 002 2h4a2 2 0 002-2v-2"/></svg>
                          </Link>
                          {order.status !== "delivered" && order.status !== "cancelled" && (
                            <button
                              className="text-green-700 hover:text-green-900 px-1"
                              aria-label="Advance status"
                              tabIndex={0}
                              type="button"
                              title="Advance status"
                              onClick={e => {
                                e.stopPropagation();
                                let nextStatus: Order["status"] = "processing";
                                if (order.status === "created") nextStatus = "processing";
                                else if (order.status === "processing") nextStatus = "shipped";
                                else if (order.status === "shipped") nextStatus = "delivered";
                                // delivered is the final status, no next status
                                handleUpdateStatus(order.order_id, nextStatus);
                              }}
                              disabled={updateOrderStatusMutation.isPending}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="inline h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                            </button>
                          )}
                          {order.status !== "cancelled" && (
                            <button
                              className="text-gray-700 hover:text-gray-900 px-1"
                              aria-label="Cancel order"
                              tabIndex={0}
                              type="button"
                              title="Cancel order"
                              onClick={e => {
                                e.stopPropagation();
                                handleUpdateStatus(order.order_id, "cancelled");
                              }}
                              disabled={updateOrderStatusMutation.isPending}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="inline h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                          )}
                          <button
                            className="text-red-600 hover:text-red-800 px-1"
                            aria-label="Delete order"
                            tabIndex={0}
                            type="button"
                            title="Delete order"
                            onClick={e => {
                              e.stopPropagation();
                              handleDeleteOrder(order.order_id);
                            }}
                            disabled={deleteOrderMutation.isPending}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="inline h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-1 12a2 2 0 01-2 2H8a2 2 0 01-2-2L5 7m5-4h4a2 2 0 012 2v2H7V5a2 2 0 012-2zm0 0V3a1 1 0 011-1h2a1 1 0 011 1v2" /></svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )
              )}
            </tbody>
          </table>
        </div>
        {/* Pagination */}
        <div className="flex flex-wrap gap-2 items-center justify-center">
          <button
            onClick={() => setFilters((prev) => ({ ...prev, page: String(page - 1) }))}
            disabled={page <= 1}
            className="px-2 py-1 bg-gray-100 rounded hover:bg-gray-200 disabled:opacity-60"
            aria-label="Previous page"
          >
            Prev
          </button>
          <span className="text-sm text-gray-900">
            Page {page} of {lastPage}
          </span>
          <button
            onClick={() => setFilters((prev) => ({ ...prev, page: String(page + 1) }))}
            disabled={page >= lastPage}
            className="px-2 py-1 bg-gray-100 rounded hover:bg-gray-200 disabled:opacity-60"
            aria-label="Next page"
          >
            Next
          </button>
        </div>
      </div>
    </>
  );
};

export default UV_Admin_Orders;