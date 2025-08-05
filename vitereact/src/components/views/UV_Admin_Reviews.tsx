import React, { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { useAppStore } from "@/store/main";
import { z } from "zod";
import { Link } from "react-router-dom";

// --- ZOD: Types ---
import {
  productReviewSchema,
  productReviewListResponseSchema,
  // ProductReview, // Not normally provided by the zod bundle, so:
} from "@schema";

// ---- Types ----
type ProductReview = z.infer<typeof productReviewSchema>;

interface ReviewTableFilters {
  is_hidden?: boolean;
  query?: string; // Used as "product_id" for search
  limit: number;
  offset: number;
  sort_by: "created_at" | "rating";
  sort_order: "asc" | "desc";
}

// --- For product/user name enrichment ---
interface ProductMeta {
  name: string;
}
interface UserMeta {
  name: string;
  email: string;
}

// --- Main Component ---
const UV_Admin_Reviews: React.FC = () => {
  // Zustand global store - CRITICAL use *individual* selectors!
  const authToken = useAppStore((state) => state.authentication_state.auth_token);

  // ---- State ----
  // Table filter state
  const [tableFilters, setTableFilters] = useState<ReviewTableFilters>({
    is_hidden: undefined,
    query: "",
    limit: 20,
    offset: 0,
    sort_by: "created_at",
    sort_order: "desc",
  });

  // Table/row state
  const [selectedReviewId, setSelectedReviewId] = useState<string | null>(null);
  const [moderationError, setModerationError] = useState<string | null>(null);

  // Caches for product/user names
  const [productNames, setProductNames] = useState<Record<string, string>>({});
  const [userNames, setUserNames] = useState<Record<string, UserMeta>>({});

  // --- Table Pagination Helpers
  const page = Math.floor(tableFilters.offset / tableFilters.limit) + 1;

  // Ref for scroll-to-top on fetch
  const tableRef = useRef<HTMLDivElement | null>(null);

  // --- QueryClient for react-query
  const queryClient = useQueryClient();

  // --- Helper: Is current "query" a possible product_id?
  function isLikelyProductId(query: string): boolean {
    // Assume product_id is string, may have a certain prefix, but permit any non-empty string (with optional "prod_", "p_" or similar).
    return typeof query === "string" && query.length >= 6;
  }

  // --- 1. FETCH PRODUCT REVIEWS (by product_id)
  // Query disables itself unless a "query" is present and looks like a product_id.
  const {
    data: reviewData,
    refetch: refetchReviews,
    isFetching,
    isError: isFetchError,
    error: fetchError,
  } = useQuery<{ product_reviews: ProductReview[]; total: number }, Error>({
    enabled: isLikelyProductId(tableFilters.query ? tableFilters.query.trim() : ""),
    queryKey: [
      "admin-reviews",
      tableFilters.query,
      tableFilters.is_hidden,
      tableFilters.offset,
      tableFilters.limit,
      tableFilters.sort_by,
      tableFilters.sort_order,
    ],
    queryFn: async () => {
      if (!tableFilters.query || !isLikelyProductId(tableFilters.query.trim())) {
        return { product_reviews: [], total: 0 };
      }
      const baseUrl =
        import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";
      let url = `${baseUrl}/products/${encodeURIComponent(
        tableFilters.query.trim()
      )}/reviews`;

      const params: Record<string, string | number | boolean> = {};
      if (typeof tableFilters.is_hidden !== "undefined") {
        params.is_hidden = tableFilters.is_hidden; // true/false
      }
      params.limit = tableFilters.limit;
      params.offset = tableFilters.offset;
      params.sort_by = tableFilters.sort_by;
      params.sort_order = tableFilters.sort_order;

      const res = await axios.get(url, {
        params,
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      // Validate using Zod
      const parsed = productReviewListResponseSchema.safeParse(res.data);
      if (!parsed.success) {
        throw new Error("Malformed server response.");
      }
      return parsed.data;
    },
    keepPreviousData: true,
    retry: 1,
  });

  // --- 2. HIDE/UNHIDE MUTATION
  const hideUnhideReviewMutation = useMutation<
    ProductReview,
    Error,
    { review_id: string; is_hidden: boolean }
  >({
    mutationFn: async ({ review_id, is_hidden }) => {
      const baseUrl =
        import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";
      const url = `${baseUrl}/reviews/${encodeURIComponent(review_id)}`;
      const res = await axios.patch(
        url,
        { is_hidden },
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        }
      );
      // Validate
      const parsed = productReviewSchema.safeParse(res.data);
      if (!parsed.success) {
        throw new Error("Malformed response from moderation endpoint.");
      }
      return parsed.data;
    },
    onSuccess: () => {
      setSelectedReviewId(null);
      setModerationError(null);
      queryClient.invalidateQueries({
        queryKey: [
          "admin-reviews",
          tableFilters.query,
          tableFilters.is_hidden,
          tableFilters.offset,
          tableFilters.limit,
          tableFilters.sort_by,
          tableFilters.sort_order,
        ],
      });
    },
    onError: (err: Error) => {
      setModerationError(err.message || "Moderation failed.");
      setSelectedReviewId(null);
    },
  });

  // --- 3. Enrich: Load product/user name for each review row, with caching
  useEffect(() => {
    // extract all product_ids/user_ids not already cached
    const newProds = new Set<string>();
    const newUsers = new Set<string>();
    if (reviewData && reviewData.product_reviews.length) {
      reviewData.product_reviews.forEach((r) => {
        if (!productNames[r.product_id]) newProds.add(r.product_id);
        if (!userNames[r.user_id]) newUsers.add(r.user_id);
      });
    }
    // Fetch products
    newProds.forEach((pid) => {
      const baseUrl =
        import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";
      axios
        .get(`${baseUrl}/products/${encodeURIComponent(pid)}`, {
          headers: { Authorization: `Bearer ${authToken}` },
        })
        .then((res) => {
          if (res.data && res.data.name) {
            setProductNames((prev) => ({ ...prev, [pid]: res.data.name }));
          }
        })
        .catch(() => {});
    });
    // Fetch users
    newUsers.forEach((uid) => {
      const baseUrl =
        import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";
      axios
        .get(`${baseUrl}/users/${encodeURIComponent(uid)}`, {
          headers: { Authorization: `Bearer ${authToken}` },
        })
        .then((res) => {
          if (res.data && res.data.name) {
            setUserNames((prev) => ({
              ...prev,
              [uid]: { name: res.data.name, email: res.data.email },
            }));
          }
        })
        .catch(() => {});
    });
    // eslint-disable-next-line
  }, [reviewData]);

  // --- 4. Real-time (Socket): Listen for product.review.submitted/hidden and refetch table
  const realtimeConnection = useAppStore(
    (state) => state.realtime_connection
  );
  const socket = useAppStore((state) => state.socket);
  useEffect(() => {
    if (!socket) return;
    const handleReviewUpdate = (review: ProductReview) => {
      if (
        tableFilters.query &&
        review.product_id === tableFilters.query
      ) {
        // If currently viewing this product's reviews, refetch
        refetchReviews();
      }
    };
    const handleReviewHidden = (payload: {
      review_id: string;
      product_id: string;
    }) => {
      if (
        tableFilters.query &&
        payload.product_id === tableFilters.query
      ) {
        refetchReviews();
      }
    };
    socket.on("product.review.submitted", handleReviewUpdate);
    socket.on("product.review.hidden", handleReviewHidden);
    return () => {
      socket.off("product.review.submitted", handleReviewUpdate);
      socket.off("product.review.hidden", handleReviewHidden);
    };
    // eslint-disable-next-line
  }, [socket, tableFilters.query]);

  // --- 5. Table Control Handlers ---
  // Filter: is_hidden, sort_by, sort_order, limit/page
  const handleFilterChange = (
    name: keyof ReviewTableFilters,
    value: string | boolean | number
  ) => {
    setTableFilters((prev) => {
      // Reset page to 0 if major filter
      if (
        ["is_hidden", "query", "sort_by", "sort_order", "limit"].includes(
          name
        )
      ) {
        return { ...prev, [name]: value, offset: 0 };
      }
      return { ...prev, [name]: value };
    });
  };
  // Pagination: next/prev/set page
  const handlePageChange = (pageNum: number) => {
    setTableFilters((prev) => ({
      ...prev,
      offset: (pageNum - 1) * prev.limit,
    }));
    // Scroll to table top
    setTimeout(() => {
      if (tableRef.current) tableRef.current.scrollIntoView({ behavior: "smooth" });
    }, 100);
  };

  // Table: SEARCH INPUT
  const [searchInput, setSearchInput] = useState("");
  // For error (missing endpoint) display
  const [showMissingEndpointAlert, setShowMissingEndpointAlert] = useState(false);

  // Handle search bar submit/filter
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setModerationError(null);
    setShowMissingEndpointAlert(false);
    if (!searchInput.trim()) {
      setTableFilters((prev) => ({ ...prev, query: "" }));
      return;
    }
    // We permit only product ID style search (enforced by backend/API reality)
    if (isLikelyProductId(searchInput.trim())) {
      setTableFilters((prev) => ({
        ...prev,
        query: searchInput.trim(),
        offset: 0,
      }));
    } else {
      setShowMissingEndpointAlert(true);
    }
  };

  // Reset search/filter
  const handleClearFilters = () => {
    setTableFilters({
      is_hidden: undefined,
      query: "",
      limit: 20,
      offset: 0,
      sort_by: "created_at",
      sort_order: "desc",
    });
    setSearchInput("");
    setShowMissingEndpointAlert(false);
    setModerationError(null);
  };

  // ------- Main Render -------
  return (
    <>
      <div className="max-w-7xl mx-auto py-10 px-4 min-h-screen">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">
            Admin: Review Moderation
          </h1>
          {/* Back to dashboard */}
          <Link
            to="/admin"
            className="inline-flex items-center px-3 py-1.5 rounded bg-gray-800 text-white hover:bg-gray-700 text-sm font-medium"
          >
            &larr; Dashboard
          </Link>
        </div>

        {/* Filters/Search controls */}
        <div className="bg-white border rounded-lg shadow p-5 mb-6">
          <form
            className="flex flex-wrap gap-4 items-center"
            onSubmit={handleSearchSubmit}
            autoComplete="off"
          >
            {/* Product ID search */}
            <div>
              <label htmlFor="review-product-id" className="block text-xs font-semibold text-gray-600 mb-1">
                Product ID
              </label>
              <input
                id="review-product-id"
                name="review-product-id"
                value={searchInput}
                onChange={(e) => {
                  setSearchInput(e.target.value);
                  setShowMissingEndpointAlert(false);
                  setModerationError(null);
                }}
                className="border px-3 py-2 rounded w-56 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                placeholder="Enter product id (e.g. prod_123abc)"
                autoComplete="off"
                aria-label="Search reviews by Product ID"
              />
            </div>
            {/* Visibility filter */}
            <div>
              <label htmlFor="review-visibility" className="block text-xs font-semibold text-gray-600 mb-1">
                Visibility
              </label>
              <select
                id="review-visibility"
                name="review-visibility"
                value={
                  typeof tableFilters.is_hidden === "undefined"
                    ? ""
                    : tableFilters.is_hidden
                    ? "hidden"
                    : "visible"
                }
                onChange={(e) => {
                  handleFilterChange(
                    "is_hidden",
                    e.target.value === "" ? undefined : e.target.value === "hidden"
                  );
                }}
                className="border px-2 py-2 rounded w-32 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                aria-label="Filter by visibility"
              >
                <option value="">All</option>
                <option value="visible">Visible</option>
                <option value="hidden">Hidden</option>
              </select>
            </div>
            {/* Sort By */}
            <div>
              <label htmlFor="review-sortby" className="block text-xs font-semibold text-gray-600 mb-1">
                Sort By
              </label>
              <select
                id="review-sortby"
                name="review-sortby"
                value={tableFilters.sort_by}
                onChange={(e) => handleFilterChange("sort_by", e.target.value as "created_at" | "rating")}
                className="border px-2 py-2 rounded w-32 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                aria-label="Sort by"
              >
                <option value="created_at">Created</option>
                <option value="rating">Rating</option>
              </select>
            </div>
            {/* Sort Order */}
            <div>
              <label htmlFor="review-sortorder" className="block text-xs font-semibold text-gray-600 mb-1">
                Order
              </label>
              <select
                id="review-sortorder"
                name="review-sortorder"
                value={tableFilters.sort_order}
                onChange={(e) => handleFilterChange("sort_order", e.target.value as "asc" | "desc")}
                className="border px-2 py-2 rounded w-32 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                aria-label="Sort order"
              >
                <option value="desc">Desc</option>
                <option value="asc">Asc</option>
              </select>
            </div>
            {/* Page Size */}
            <div>
              <label htmlFor="review-pagesize" className="block text-xs font-semibold text-gray-600 mb-1">
                Page Size
              </label>
              <select
                id="review-pagesize"
                name="review-pagesize"
                value={tableFilters.limit}
                onChange={(e) =>
                  handleFilterChange("limit", parseInt(e.target.value, 10))
                }
                className="border px-2 py-2 rounded w-24 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                aria-label="Page size"
              >
                {[10, 20, 30, 50].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
            {/* Search Button */}
            <button
              type="submit"
              className="bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600 text-sm font-medium self-end"
              aria-label="Search"
            >
              Search
            </button>
            {/* Clear Button */}
            <button
              type="button"
              className="ml-2 text-gray-700 py-2 px-4 rounded border border-gray-300 hover:bg-gray-100 text-sm font-medium self-end"
              onClick={handleClearFilters}
              aria-label="Clear filters"
            >
              Clear
            </button>
          </form>
          {/* Missing endpoint alert */}
          {showMissingEndpointAlert && (
            <div className="mt-4 p-2 bg-yellow-50 border-l-4 border-yellow-400 text-yellow-800 rounded" aria-live="polite">
              <span className="font-semibold">Cross-product/user review search is not supported in current API.</span>
              <span className="block mt-2 text-xs text-gray-500">
                You may only moderate reviews for a single product ID at a time.
              </span>
            </div>
          )}
        </div>

        {/* Error Handling */}
        {(moderationError || isFetchError) && (
          <div className="mb-4 px-4 py-2 border-l-4 border-red-600 bg-red-50 text-red-700 rounded" aria-live="polite">
            <p>
              {moderationError
                ? <>Moderation error: <span className="font-semibold">{moderationError}</span></>
                : fetchError
                ? <>Could not load reviews. Check Product ID and try again.</>
                : null}
            </p>
          </div>
        )}

        {/* Table */}
        <div ref={tableRef} className="overflow-x-auto">
          {!tableFilters.query || !isLikelyProductId(tableFilters.query) ? (
            <div className="py-10 flex flex-col items-center justify-center opacity-80">
              <span className="text-gray-500 text-lg">Enter a Product ID to view and moderate its reviews.</span>
            </div>
          ) : isFetching ? (
            <div className="py-16 w-full flex items-center justify-center">
              <svg className="animate-spin h-8 w-8 text-blue-600 mr-2" fill="none" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              <span>Loading reviews...</span>
            </div>
          ) : reviewData?.product_reviews?.length === 0 ? (
            <div className="py-10 flex flex-col items-center justify-center opacity-80">
              <span className="text-gray-500 text-lg">No reviews found for this product.</span>
            </div>
          ) : (
            <table className="w-full bg-white border border-gray-200 rounded-lg shadow text-sm">
              <thead>
                <tr className="bg-gray-50 border-b">
                  <th className="px-3 py-2 text-left font-semibold text-gray-700 min-w-[100px]">Product</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700 min-w-[110px]">Reviewer</th>
                  <th className="px-2 py-2 text-center font-semibold text-gray-700">Rating</th>
                  <th className="px-2 py-2 text-left font-semibold text-gray-700 min-w-[220px]">Review</th>
                  <th className="px-2 py-2 text-left font-semibold text-gray-700">Image</th>
                  <th className="px-2 py-2 text-left font-semibold text-gray-700">Date</th>
                  <th className="px-2 py-2 text-left font-semibold text-gray-700">Status</th>
                  <th className="px-2 py-2 text-center font-semibold text-gray-700">Action</th>
                </tr>
              </thead>
              <tbody>
                {reviewData?.product_reviews.map((review) => (
                  <tr
                    key={review.review_id}
                    className={`border-b hover:bg-blue-50 focus-within:bg-blue-50 ${
                      review.is_hidden
                        ? "opacity-70 bg-red-50"
                        : "bg-white"
                    }`}
                  >
                    {/* Product */}
                    <td className="px-3 py-2 max-w-xs truncate" title={productNames[review.product_id] || review.product_id}>
                      <Link
                        to={`/products/${encodeURIComponent(review.product_id)}`}
                        className="text-blue-600 hover:underline"
                        tabIndex={0}
                      >
                        {productNames[review.product_id] || (
                          <span className="text-gray-400">[ID: {review.product_id.slice(0, 8)}]</span>
                        )}
                      </Link>
                    </td>
                    {/* Reviewer */}
                    <td className="px-3 py-2 max-w-xs truncate" title={userNames[review.user_id]?.email || review.user_id}>
                      <span className="text-gray-800">
                        {userNames[review.user_id]?.name ||
                          <span className="text-gray-400">[User: {review.user_id.slice(0, 8)}]</span>}
                      </span>
                      <span className="block text-xs text-gray-500 truncate">
                        {userNames[review.user_id]?.email || ""}
                      </span>
                    </td>
                    {/* Rating */}
                    <td className="px-2 py-2 text-center">
                      <span className="inline-block">
                        {[...Array(5)].map((_, idx) => (
                          <svg
                            key={idx}
                            className={`h-4 w-4 inline ${idx < review.rating ? "text-yellow-400" : "text-gray-300"}`}
                            fill="currentColor"
                            viewBox="0 0 20 20"
                            aria-hidden="true"
                          >
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.518 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.974 2.89a1 1 0 00-.364 1.118l1.518 4.674c.3.921-.755 1.688-1.54 1.118l-3.974-2.89a1 1 0 00-1.176 0l-3.974 2.89c-.784.57-1.838-.197-1.539-1.118l1.518-4.674a1 1 0 00-.364-1.118L2.08 10.1c-.783-.57-.38-1.81.588-1.81h4.916a1 1 0 00.949-.69l1.516-4.674z" />
                          </svg>
                        ))}
                      </span>
                      <span className="sr-only">{review.rating} stars</span>
                    </td>
                    {/* Review Text */}
                    <td className="px-2 py-2 max-w-sm">
                      <span className="font-medium text-gray-700">
                        {review.review_text || <span className="italic text-gray-400">No text</span>}
                      </span>
                    </td>
                    {/* Review Image */}
                    <td className="px-2 py-2">
                      {review.review_image_url ? (
                        <a
                          href={review.review_image_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block"
                          tabIndex={0}
                        >
                          <img
                            src={review.review_image_url}
                            alt="Review image"
                            className="w-12 h-12 object-cover rounded border border-gray-200 shadow"
                          />
                        </a>
                      ) : (
                        <span className="text-gray-300 text-xs">—</span>
                      )}
                    </td>
                    {/* Date */}
                    <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-500">
                      {new Date(review.created_at).toLocaleDateString(undefined, {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                      <span className="block text-gray-400 text-[10px]">
                        {new Date(review.created_at).toLocaleTimeString()}
                      </span>
                    </td>
                    {/* Status */}
                    <td className="px-2 py-2 text-center">
                      {review.is_hidden ? (
                        <span className="inline-flex items-center px-2 py-1 bg-red-100 text-red-700 text-xs rounded font-semibold">
                          Hidden
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-1 bg-green-100 text-green-700 text-xs rounded font-semibold">
                          Visible
                        </span>
                      )}
                    </td>
                    {/* Action */}
                    <td className="px-2 py-2 text-center">
                      <button
                        type="button"
                        className={`inline-flex items-center px-2 py-1 rounded text-xs font-semibold border ${
                          review.is_hidden
                            ? "bg-green-600 border-green-700 text-white hover:bg-green-700"
                            : "bg-red-600 border-red-700 text-white hover:bg-red-700"
                        } transition disabled:opacity-50`}
                        disabled={
                          hideUnhideReviewMutation.isLoading &&
                          selectedReviewId === review.review_id
                        }
                        aria-label={review.is_hidden ? "Unhide review" : "Hide review"}
                        tabIndex={0}
                        onClick={() => {
                          setSelectedReviewId(review.review_id);
                          setModerationError(null);
                          hideUnhideReviewMutation.mutate({
                            review_id: review.review_id,
                            is_hidden: !review.is_hidden,
                          });
                        }}
                      >
                        {hideUnhideReviewMutation.isLoading &&
                        selectedReviewId === review.review_id ? (
                          <svg
                            className="animate-spin h-4 w-4 mr-1"
                            fill="none"
                            viewBox="0 0 24 24"
                          >
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                            ></circle>
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            ></path>
                          </svg>
                        ) : review.is_hidden ? (
                          <svg
                            className="h-4 w-4 mr-1"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={2}
                            viewBox="0 0 24 24"
                            aria-hidden="true"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M15 19l-7-7 7-7"
                            />
                          </svg>
                        ) : (
                          <svg
                            className="h-4 w-4 mr-1"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={2}
                            viewBox="0 0 24 24"
                            aria-hidden="true"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M19 12H5"
                            />
                          </svg>
                        )}
                        {review.is_hidden ? "Unhide" : "Hide"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination Controls */}
        {reviewData?.total && reviewData.total > tableFilters.limit && (
          <nav className="flex items-center gap-6 justify-between mt-7 mb-2">
            <div className="text-sm text-gray-700">
              Showing {tableFilters.offset + 1} –{" "}
              {Math.min(
                tableFilters.offset + tableFilters.limit,
                reviewData.total
              )}{" "}
              of {reviewData.total} reviews
            </div>
            <div className="flex gap-1">
              <button
                className="px-2 py-1 rounded border border-gray-300 text-gray-600 hover:bg-blue-50 disabled:opacity-50"
                onClick={() => handlePageChange(page - 1)}
                disabled={page <= 1}
                aria-label="Previous page"
              >
                &larr;
              </button>
              {/* Display up to 5 pages, centered on current */}
              {(() => {
                const totalPages = Math.ceil(reviewData.total / tableFilters.limit);
                let minPage = Math.max(page - 2, 1);
                let maxPage = Math.min(minPage + 4, totalPages);
                minPage = Math.max(maxPage - 4, 1);
                return Array.from(
                  { length: maxPage - minPage + 1 },
                  (_, i) => minPage + i
                ).map((pg) => (
                  <button
                    key={pg}
                    className={`px-2 py-1 rounded border ${
                      pg === page
                        ? "bg-blue-600 text-white border-blue-700"
                        : "border-gray-300 text-gray-600 hover:bg-blue-50"
                    }`}
                    onClick={() => handlePageChange(pg)}
                    disabled={pg === page}
                    aria-label={`Go to page ${pg}`}
                  >
                    {pg}
                  </button>
                ));
              })()}
              <button
                className="px-2 py-1 rounded border border-gray-300 text-gray-600 hover:bg-blue-50 disabled:opacity-50"
                onClick={() => handlePageChange(page + 1)}
                disabled={
                  page >= Math.ceil(reviewData.total / tableFilters.limit)
                }
                aria-label="Next page"
              >
                &rarr;
              </button>
            </div>
          </nav>
        )}
      </div>
    </>
  );
};

export default UV_Admin_Reviews;