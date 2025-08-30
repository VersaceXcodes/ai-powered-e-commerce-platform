import React, { useEffect, useRef } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { z } from "zod";
import { orderSchema } from "@schema"; // Type-only import; see below for local TS type
import { useAppStore } from "@/store/main";

// --- Type (for local validation and typesafety) ---
type Order = z.infer<typeof orderSchema>;

// --- API Fetch Function ---
const fetchOrderById = async ({
  orderId,
  token,
}: {
  orderId: string;
  token: string;
}): Promise<Order> => {
  const apiBase = `${import.meta.env.VITE_API_BASE_URL || "http://localhost:3000"}`;
  const res = await axios.get(`${apiBase}/orders/${encodeURIComponent(orderId)}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  // API returns the order directly
  return res.data;
};

// --- Simulated Invoice Download (PDF) ---
function simulateInvoiceDownload(order: Order) {
  // Simulate by generating a PDF via browser (for now, just a text file)
  // TODO: Replace with actual PDF generation (library) if endpoint provided
  const content = [
    `AIOCart - Invoice for Order #${order.order_number}`,
    `Placed: ${new Date(order.created_at).toLocaleString()}\n`,
    `Order ID: ${order.order_id}`,
    `Order Status: ${order.status}\n`,
    `---`,
    `Billing Address: ${order.billing_address}`,
    `Shipping Address: ${order.shipping_address}`,
    `Contact: ${order.email}, ${order.phone}`,
    `---`,
    `Subtotal: $${order.subtotal.toFixed(2)}`,
    `Tax: $${order.tax.toFixed(2)}`,
    `Shipping: $${order.shipping.toFixed(2)}`,
    `Total Paid: $${order.total.toFixed(2)}\n`,
    `Thank you for shopping with us!`
  ].join("\n");
  const blob = new Blob([content], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `AIOCart_Invoice_${order.order_number || order.order_id}.txt`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 150);
}

const UV_OrderConfirmation: React.FC = () => {
  // --- Route Params ---
  const { orderId } = useParams<{ orderId: string }>();

  // --- Zustand Selectors (single selectors!) ---
  const token = useAppStore((state) => state.authentication_state.auth_token);
  const user = useAppStore((state) => state.authentication_state.current_user);
  const clearCartState = useAppStore((state) => state.clear_cart_state);

  // --- Router Navigation ---


  // --- Side Effect: Cart is cleared after order placed
  useEffect(() => {
    clearCartState();
    // Only once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Fetch Order Data (React Query) ---
  const {
    data: order,
    isLoading,
    isError,
    error,
  } = useQuery<Order, Error>({
    queryKey: ["order", orderId, token],
    queryFn: async () => {
      if (!orderId || !token) throw new Error("Missing orderId or token");
      // zod validation on fetch
      const orderData = await fetchOrderById({ orderId, token });
      orderSchema.parse(orderData); // throws if invalid
      return orderData;
    },
    enabled: !!orderId && !!token,
    retry: 1,
    }
  );

  // --- Accessibility: focus banner/error on state change ---
  const bannerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!isLoading && !isError && bannerRef.current) {
      bannerRef.current.focus();
    }
  }, [isLoading, isError, order]);

  // --- Error Handling ---
  let errorMessage: string | null = null;
  if (isError) {
    // Check for 404 vs generic error
    if (
      (error as any)?.response?.status === 404
    ) {
      errorMessage =
        "Sorry, we couldn't find your order. Double-check your order link, or visit your order history for details.";
    } else {
      errorMessage =
        (error as any)?.response?.data?.message ||
        error.message ||
        "Something went wrong loading your order.";
    }
  }
  if (!token && !isLoading) {
    errorMessage = "You must be signed in to view this order.";
  }

  return (
    <>
      <div className="min-h-[80vh] w-full flex flex-col items-center justify-center px-2 py-10 bg-gray-50">
        {/* --- Error State --- */}
        {errorMessage && (
          <div
            ref={bannerRef}
            tabIndex={-1}
            aria-live="polite"
            className="w-full max-w-xl bg-red-50 border border-red-300 rounded-md px-4 py-4 mb-8 shadow"
          >
            <div className="flex items-center space-x-2">
              <svg
                className="w-5 h-5 text-red-500"
                fill="none"
                viewBox="0 0 24 24"
                aria-hidden="true"
                focusable={false}
              >
                <path
                  stroke="currentColor"
                  strokeWidth="2"
                  d="M12 9v2m0 4h.01m5.658-9.658A8 8 0 104.342 19.658 8 8 0 0017.657 4.343z"
                />
              </svg>
              <span className="text-red-700 font-medium text-base">Order Error</span>
            </div>
            <div className="mt-2">
              <span className="text-red-600">{errorMessage}</span>
            </div>
            <div className="mt-4 flex flex-col gap-2 md:flex-row md:gap-4">
              <Link
                to="/orders"
                className="inline-flex items-center px-4 py-2 bg-blue-50 text-blue-700 rounded hover:bg-blue-100 font-medium text-sm border border-blue-200"
              >
                Go to My Orders
              </Link>
              <Link
                to="/"
                className="inline-flex items-center px-4 py-2 bg-gray-100 text-gray-800 rounded hover:bg-gray-200 font-medium text-sm border"
              >
                Return to Home
              </Link>
            </div>
          </div>
        )}

        {/* --- Loading State --- */}
        {isLoading && (
          <div className="w-full max-w-xl flex flex-col items-center justify-center py-12">
            <div className="flex flex-col items-center space-y-4">
              {/* Success spinner animation */}
              <span className="inline-block w-14 h-14 border-4 border-blue-400 border-t-transparent rounded-full animate-spin" aria-label="Loading" />
              <span className="text-blue-800 font-bold text-lg mt-4">Loading your order...</span>
            </div>
          </div>
        )}

        {/* --- Success State --- */}
        {!isLoading && !isError && order && (
          <div
            ref={bannerRef}
            tabIndex={-1}
            aria-live="polite"
            className="w-full max-w-xl bg-white rounded-lg shadow-md px-4 py-8 flex flex-col items-center"
          >
            {/* Order Placed Banner */}
            <div className="w-full flex flex-col items-center mb-4">
              {/* Success checkmark animation */}
              <div
                className="rounded-full bg-green-100 p-3 mb-2 flex items-center justify-center animate-bounce"
                style={{ animationIterationCount: 1 }}
              >
                <svg
                  className="w-9 h-9 text-green-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  focusable={false}
                  aria-label="Order placed"
                >
                  <circle
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="2"
                    fill="none"
                    className="text-green-200"
                  />
                  <path
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 12l2 2.5L16 9"
                    className="text-green-600"
                  />
                </svg>
              </div>
              <h1 className="text-2xl sm:text-3xl font-semibold text-green-700 text-center mb-1">
                Order placed!
              </h1>
              <span className="text-green-700 text-base">
                Thank you for your purchase{user && user.name ? `, ${user.name}` : ""}!
              </span>
            </div>

            {/* Order Reference + Summary */}
            <div className="w-full flex flex-col items-center mb-6">
              <span className="text-gray-700 font-medium text-lg">
                Order&nbsp;
                <span className="text-blue-700">#{order.order_number || order.order_id}</span>
              </span>
              <span className="text-sm text-gray-500 mt-1">
                Placed&nbsp;
                {order.created_at
                  ? new Date(order.created_at).toLocaleString(undefined, {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : ""}
              </span>
              <span
                className={`inline-block mt-2 px-3 py-1 rounded-full font-semibold text-xs ${
                  order.status === "delivered"
                    ? "bg-green-200 text-green-900"
                    : order.status === "shipped"
                    ? "bg-blue-200 text-blue-900"
                    : order.status === "cancelled"
                    ? "bg-red-200 text-red-700"
                    : "bg-yellow-100 text-yellow-900"
                }`}
              >
                Status: {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
              </span>
            </div>

            {/* Order Details */}
            <div className="w-full">
              <table className="w-full text-sm mb-3">
                <tbody>
                  <tr>
                    <td className="text-gray-500 py-1 pr-3">Subtotal:</td>
                    <td className="font-medium text-gray-700 py-1 text-right">${order.subtotal.toFixed(2)}</td>
                  </tr>
                  <tr>
                    <td className="text-gray-500 py-1 pr-3">Tax:</td>
                    <td className="font-medium text-gray-700 py-1 text-right">${order.tax.toFixed(2)}</td>
                  </tr>
                  <tr>
                    <td className="text-gray-500 py-1 pr-3">Shipping:</td>
                    <td className="font-medium text-gray-700 py-1 text-right">${order.shipping.toFixed(2)}</td>
                  </tr>
                  <tr>
                    <td className="text-gray-700 py-2 font-semibold pr-3">Total Paid:</td>
                    <td className="font-bold text-blue-700 py-2 text-right text-lg">${order.total.toFixed(2)}</td>
                  </tr>
                </tbody>
              </table>
              <div className="mb-2 text-xs text-gray-500">
                <span>
                  * All prices are shown in USD. <br />
                  An email confirmation has been sent to <span className="font-medium text-gray-700">{order.email.replace(/(.{2})[^@]*(@.*)/, "$1****$2")}</span>.
                </span>
              </div>
            </div>

            {/* Delivery & Addresses */}
            <div className="w-full mt-4 rounded bg-gray-50 border border-gray-200 p-4 mb-3">
              <div className="flex flex-col sm:flex-row sm:space-x-6">
                <div className="flex-1">
                  <div className="text-gray-700 font-semibold">Shipping Address</div>
                  <div className="text-gray-800">{order.shipping_address}</div>
                  <div className="text-gray-500 text-xs mt-1">Phone: {order.phone.replace(/.(?=.{4,}$)/g, "*")}</div>
                </div>
                <div className="flex-1 mt-4 sm:mt-0">
                  <div className="text-gray-700 font-semibold">Billing Address</div>
                  <div className="text-gray-800">{order.billing_address}</div>
                </div>
              </div>
              <div className="mt-3 text-blue-900 font-medium text-sm">
                Estimated delivery:{" "}
                <span className="font-bold">
                  {/* Estimate delivery as +5 days from created_at */}
                  {order.created_at
                    ? new Date(Date.parse(order.created_at) + 5 * 24 * 60 * 60 * 1000).toLocaleDateString(undefined, {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                      })
                    : "-"}
                </span>
              </div>
              <div className="text-gray-600 text-xs mt-1 italic">
                You’ll receive updates as soon as your order status changes.
              </div>
            </div>
            
            {/* Download Invoice & CTAs */}
            <div className="flex flex-col sm:flex-row w-full mt-6 gap-3">
              <button
                type="button"
                onClick={() => simulateInvoiceDownload(order)}
                className="w-full sm:w-auto px-5 py-2 bg-white border border-blue-400 rounded text-blue-700 font-semibold shadow hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-400"
                aria-label="Download Invoice"
              >
                Download Invoice
              </button>
              <Link
                to="/orders"
                className="w-full sm:w-auto flex items-center justify-center px-5 py-2 bg-blue-700 text-white rounded font-semibold shadow hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                View My Orders
              </Link>
              <Link
                to="/"
                className="w-full sm:w-auto flex items-center justify-center px-5 py-2 bg-gray-200 text-gray-800 border rounded font-medium hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-300"
              >
                Return to Store
              </Link>
            </div>
            <div className="mt-12 text-center text-gray-400 text-xs">
              Need help? Contact&nbsp;
              <a
                href="mailto:support@aiocart.com"
                className="underline hover:text-blue-500"
              >
                support@aiocart.com
              </a>
            </div>
          </div>
        )}

        {/* --- Developer: Invoice Download API Endpoint TODO (UX Spec) --- */}
        {/* No endpoint currently for invoice PDF. See analysis */}
      </div>
    </>
  );
};

export default UV_OrderConfirmation;