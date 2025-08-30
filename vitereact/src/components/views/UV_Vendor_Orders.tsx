import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { Link, useSearchParams } from "react-router-dom";
import { z } from "zod";
import { useAppStore } from "@/store/main";

// --- Types from backend zod ---
// Order
export type OrderStatus =
  | "created"
  | "processing"
  | "completed"
  | "cancelled"
  | "shipped"
  | "delivered";

export interface Order {
  order_id: string;
  user_id: string;
  order_number: string;
  status: OrderStatus;
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

// --- API constants ---
const API_BASE = `${import.meta.env.VITE_API_BASE_URL || "http://localhost:3000"}`;
const PER_PAGE = 20;
const ORDER_STATUS_OPTIONS: { label: string; value: "" | OrderStatus }[] = [
  { label: "All Statuses", value: "" },
  { label: "Created", value: "created" },
  { label: "Processing", value: "processing" },
  { label: "Completed", value: "completed" },
  { label: "Cancelled", value: "cancelled" },
  { label: "Shipped", value: "shipped" },
  { label: "Delivered", value: "delivered" },
];

// --- Query function for vendor orders ---
interface VendorOrdersQueryParams {
  vendor_id: string;
  status: string; // can be "", for all
  order_number: string; // can be "", for all
  page: number; // 1-based
}

interface OrdersListResponse {
  orders: Order[];
  total: number;
}

const fetchVendorOrders = async (
  params: VendorOrdersQueryParams,
  token: string
): Promise<OrdersListResponse> => {
  // Compose query string. Only send non-empty params.
  const queryParams = new URLSearchParams();
  queryParams.set("vendor_id", params.vendor_id);
  if (params.status) queryParams.set("status", params.status);
  if (params.order_number) queryParams.set("order_number", params.order_number);
  queryParams.set("page", params.page.toString());
  queryParams.set("per_page", PER_PAGE.toString());

  const url = `${API_BASE}/orders?${queryParams.toString()}`;
  const { data } = await axios.get(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  // zod contract: validate with schema
  const OrderSchema = z.object({
    order_id: z.string(),
    user_id: z.string(),
    order_number: z.string(),
    status: z.enum([
      "created",
      "processing",
      "completed",
      "cancelled",
      "shipped",
      "delivered",
    ]),
    subtotal: z.number(),
    tax: z.number(),
    shipping: z.number(),
    total: z.number(),
    shipping_address: z.string(),
    billing_address: z.string(),
    phone: z.string(),
    email: z.string(),
    created_at: z.string(),
    updated_at: z.string(),
    cancelled_at: z.string().nullable(),
    cancelled_by_user_id: z.string().nullable(),
  });
  const ResponseSchema = z.object({
    orders: z.array(OrderSchema),
    total: z.number().int(),
  });

  return ResponseSchema.parse(data);
};

// --- Main Component ---
const UV_Vendor_Orders: React.FC = () => {
  // --- Global Auth State ---
  const currentUser = useAppStore((state) => state.authentication_state.current_user);
  const authToken = useAppStore((state) => state.authentication_state.auth_token);

  // --- URL Params ---
  const [searchParams, setSearchParams] = useSearchParams();

  // --- Local State for filters (sync with URL) ---
  const [selectedStatus, setSelectedStatus] = useState<string>(
    searchParams.get("status") || ""
  );
  const [query, setQuery] = useState<string>(searchParams.get("query") || "");
  const [page, setPage] = useState<number>(
    parseInt(searchParams.get("page") || "1", 10)
  );

  // --- Search input (for controlled input) ---
  const [searchInput, setSearchInput] = useState<string>(query);

  // Sync url <-> local state
  useEffect(() => {
    const params: Record<string, string> = {};
    if (selectedStatus) params.status = selectedStatus;
    if (query) params.query = query;
    if (page !== 1) params.page = page.toString();
    setSearchParams(params, { replace: true });
  }, [selectedStatus, query, page, setSearchParams]);

  // When the route changes (back/forward), sync state from URL
  useEffect(() => {
    setSelectedStatus(searchParams.get("status") || "");
    setQuery(searchParams.get("query") || "");
    setSearchInput(searchParams.get("query") || "");
    setPage(parseInt(searchParams.get("page") || "1", 10));
    // eslint-disable-next-line
  }, [searchParams.toString()]);

  // --- Query execution ---
  const {
    data,
    isLoading,
    isError,
    error,

    isFetching,
  } = useQuery<OrdersListResponse, Error>({
    queryKey: [
      "vendor_orders",
      currentUser?.user_id,
      selectedStatus,
      query,
      page,
    ],
    queryFn: () => {
      if (!currentUser || !authToken) throw new Error("Not authenticated");
      return fetchVendorOrders(
        {
          vendor_id: currentUser.user_id,
          status: selectedStatus,
          order_number: query,
          page,
        },
        authToken
      );
    },
    enabled: !!currentUser && !!authToken, // don't run if not authed
    placeholderData: (previousData) => previousData,
    staleTime: 30 * 1000,
  });

  // --- Handlers ---
  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedStatus(e.target.value);
    setPage(1);
  };

  const handleSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchInput(e.target.value);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setQuery(searchInput.trim());
    setPage(1);
  };

  const handleClearFilters = () => {
    setSelectedStatus("");
    setSearchInput("");
    setQuery("");
    setPage(1);
  };

  const handlePageChange = (newPage: number) => {
    if (newPage === page) return;
    setPage(newPage);
  };

  // --- Pagination helpers ---
  const total = data?.total || 0;
  const maxPage = Math.max(1, Math.ceil(total / PER_PAGE));

  // --- Accessibility ---
  const errorMessage =
    isError && error && typeof error.message === "string" ? error.message : "";

  return (
    <>
      <div className="flex flex-col min-h-screen bg-gray-50">
        {/* Header */}
        <div className="max-w-7xl mx-auto w-full pt-8 pb-4 px-4">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
            Vendor Order Management
          </h1>
          <p className="text-gray-600">
            View and manage orders containing your products. Use filters and search to find specific orders.
          </p>
        </div>
        {/* Filter/Search Controls */}
        <div className="max-w-7xl mx-auto w-full px-4 mb-4">
          <form className="flex flex-col md:flex-row items-stretch gap-3 md:gap-6" onSubmit={handleSearchSubmit} autoComplete="off">
            <div>
              <label htmlFor="status" className="sr-only">
                Filter by Status
              </label>
              <select
                id="status"
                name="status"
                value={selectedStatus}
                onChange={handleStatusChange}
                className="block w-full md:w-48 bg-white border border-gray-300 rounded-md shadow-sm px-3 py-2 focus:outline-none focus:ring-blue-600 focus:border-blue-600 text-sm"
                tabIndex={0}
                aria-label="Order Status Filter"
              >
                {ORDER_STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1 flex items-center gap-2">
              <label htmlFor="order-search" className="sr-only">
                Search Order Number
              </label>
              <input
                id="order-search"
                name="order-search"
                type="search"
                autoComplete="off"
                value={searchInput}
                onChange={handleSearchInputChange}
                className="w-full md:w-72 bg-white border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-600 focus:border-blue-600 text-sm"
                placeholder="Order # (e.g., ORD-20240612A)"
                tabIndex={0}
                aria-label="Order Number Search Input"
              />
              <button
                type="submit"
                className="px-3 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-md transition disabled:opacity-50"
                disabled={isLoading || isFetching}
                aria-label="Search Orders"
              >
                Search
              </button>
              <button
                type="button"
                onClick={handleClearFilters}
                className="px-3 py-2 text-sm bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-md transition disabled:opacity-50"
                disabled={isLoading || isFetching || (!selectedStatus && !query)}
                aria-label="Clear Filters"
              >
                Clear
              </button>
            </div>
          </form>
        </div>
        {/* Error/Loading/No Results */}
        <div className="max-w-7xl mx-auto w-full px-4">
          {isError && (
            <div className="mb-4">
              <div
                role="alert"
                aria-live="polite"
                className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md"
              >
                <span className="font-medium">Error: </span>
                {errorMessage || "Failed to load orders. Please try again."}
              </div>
            </div>
          )}
          {(isLoading || isFetching) && (
            <div className="my-10 flex justify-center" role="status" aria-live="polite">
              <svg className="animate-spin h-8 w-8 text-blue-600" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            </div>
          )}
          {!isLoading && !isFetching && data && data.orders.length === 0 && (
            <div className="my-14 text-center text-gray-400" aria-live="polite">
              <svg
                className="mx-auto mb-2 h-16 w-16 text-gray-200"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 8v4l3 3m6-2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <div className="text-lg font-medium">No orders found</div>
              <div className="text-sm">Try adjusting your filters or search.</div>
            </div>
          )}
        </div>
        {/* Orders Table */}
        <div className="max-w-7xl mx-auto w-full px-4 pb-8">
          {data && data.orders.length > 0 && (
            <div className="overflow-x-auto bg-white rounded-lg shadow ring-1 ring-gray-200">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="font-semibold text-left px-4 py-3 text-gray-900">Order #</th>
                    <th className="font-semibold text-left px-4 py-3 text-gray-900">Status</th>
                    <th className="font-semibold text-left px-4 py-3 text-gray-900">Customer Email</th>
                    <th className="font-semibold text-left px-4 py-3 text-gray-900">Created</th>
                    <th className="font-semibold text-left px-4 py-3 text-gray-900">Updated</th>
                    <th className="font-semibold text-right px-4 py-3 text-gray-900">Total</th>
                    <th className="font-semibold text-center px-4 py-3 text-gray-900">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.orders.map((order) => (
                    <tr key={order.order_id}>
                      <td className="px-4 py-3 whitespace-nowrap font-mono text-blue-700">
                        {order.order_number}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block px-2 py-1 text-xs rounded font-semibold capitalize
                          ${
                            order.status === "completed"
                              ? "bg-green-100 text-green-800"
                              : order.status === "processing"
                              ? "bg-yellow-100 text-yellow-900"
                              : order.status === "cancelled"
                              ? "bg-red-100 text-red-700"
                              : order.status === "shipped"
                              ? "bg-indigo-100 text-indigo-700"
                              : order.status === "delivered"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {order.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-gray-700">
                        {order.email}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <time dateTime={order.created_at}>
                          {new Date(order.created_at).toLocaleString()}
                        </time>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <time dateTime={order.updated_at}>
                          {new Date(order.updated_at).toLocaleString()}
                        </time>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right font-medium text-gray-900">
                        ${order.total.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-center">
                        <Link
                          to={`/vendor/orders/${order.order_id}`}
                          className="inline-flex items-center px-3 py-1.5 rounded bg-blue-100 hover:bg-blue-200 text-blue-800 text-xs font-semibold transition"
                          aria-label={`View details for order ${order.order_number}`}
                        >
                          Details
                          <svg
                            className="ml-1 w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            viewBox="0 0 24 24"
                            aria-hidden="true"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M9 5l7 7-7 7"
                            />
                          </svg>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {/* Pagination Controls */}
              <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-t border-gray-200">
                <div className="text-sm text-gray-500">
                  Showing{" "}
                  <span className="font-semibold">
                    {(page - 1) * PER_PAGE + 1}
                  </span>
                  {" "}
                  to{" "}
                  <span className="font-semibold">
                    {Math.min(page * PER_PAGE, total)}
                  </span>
                  {" "}of{" "}
                  <span className="font-semibold">{total}</span> orders
                </div>
                <nav
                  className="flex items-center gap-1"
                  role="navigation"
                  aria-label="Pagination"
                >
                  <button
                    onClick={() => handlePageChange(page - 1)}
                    className="px-2 py-1 rounded-l bg-white border border-gray-300 text-gray-600 hover:bg-gray-100 disabled:opacity-50"
                    disabled={page === 1 || isLoading || isFetching}
                    aria-label="Previous Page"
                    tabIndex={0}
                  >
                    &larr;
                  </button>
                  {[...Array(maxPage)].map((_, i) => {
                    const p = i + 1;
                    // Only show first, last, and current +/- 2
                    if (
                      p === 1 ||
                      p === maxPage ||
                      Math.abs(p - page) <= 2
                    ) {
                      return (
                        <button
                          key={p}
                          onClick={() => handlePageChange(p)}
                          className={`px-3 py-1 border border-gray-300 ${
                            p === page
                              ? "bg-blue-600 text-white font-bold"
                              : "bg-white text-gray-700 hover:bg-gray-100"
                          }`}
                          disabled={p === page || isLoading || isFetching}
                          aria-current={p === page ? "page" : undefined}
                          aria-label={`Page ${p}`}
                          tabIndex={0}
                        >
                          {p}
                        </button>
                      );
                    }
                    // Ellipsis if needed
                    else if (
                      (p === 2 && page > 4) ||
                      (p === maxPage - 1 && page < maxPage - 3)
                    ) {
                      return (
                        <span
                          key={`ellipsis-${p}`}
                          className="px-2 py-1 text-gray-400 select-none"
                          aria-hidden="true"
                        >
                          ...
                        </span>
                      );
                    }
                    return null;
                  })}
                  <button
                    onClick={() => handlePageChange(page + 1)}
                    className="px-2 py-1 rounded-r bg-white border border-gray-300 text-gray-600 hover:bg-gray-100 disabled:opacity-50"
                    disabled={page === maxPage || isLoading || isFetching}
                    aria-label="Next Page"
                    tabIndex={0}
                  >
                    &rarr;
                  </button>
                </nav>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default UV_Vendor_Orders;