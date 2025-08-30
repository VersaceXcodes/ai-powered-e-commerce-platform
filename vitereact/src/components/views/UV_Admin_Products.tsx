import React, { useState, useMemo, useRef } from "react";
import axios from "axios";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAppStore } from "@/store/main";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
// Types from zod schemas
import type {
  Product,
  Category,
  Vendor,
  BulkProductImport,
} from "@schema";

// --- API helpers ---
const API_BASE = `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}`;

// Mappings for sort UI to API param
const SORT_OPTIONS = [
  { label: "Name", value: "name" },
  { label: "Price (Low → High)", value: "price_asc" },
  { label: "Price (High → Low)", value: "price_desc" },
  { label: "Inventory", value: "inventory_count" },
  { label: "Created (Newest)", value: "created_at" }
];

// --- Admin Product List View ---
const UV_Admin_Products: React.FC = () => {
  // --- Auth ---
  const currentUser = useAppStore((s) => s.authentication_state.current_user);
  const authToken = useAppStore((s) => s.authentication_state.auth_token);

  // --- URL query state (sync to keep as canonical for filters/page) ---
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  // --- UI & state for filters/sort/search ---
  const [query, setQuery] = useState(searchParams.get("query") || "");
  const [status, setStatus] = useState(searchParams.get("status") || "");
  const [categoryId, setCategoryId] = useState(searchParams.get("category_id") || "");
  const [vendorId, setVendorId] = useState(searchParams.get("vendor_id") || "");
  const [sortBy, setSortBy] = useState<typeof SORT_OPTIONS[number]["value"]>(searchParams.get("sort_by") || "created_at");
  const [sortOrder, setSortOrder] = useState(searchParams.get("sort_order") || "desc");
  const [page, setPage] = useState<number>(parseInt(searchParams.get("page") || "1"));
  const [perPage] = useState(24);

  // --- Bulk selection ---
  const [selected, setSelected] = useState<string[]>([]);
  const selectAllRef = useRef<HTMLInputElement | null>(null);

  // --- File upload for bulk import ---
  const [fileUploading, setFileUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Feedback state ---
  const [confirmDeleteIds, setConfirmDeleteIds] = useState<string[]>([]);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);

  // ==================== Data Fetching ====================

  // --- Categories ---
  const { data: categoriesData } = useQuery<{ categories: Category[] }, Error>({
    queryKey: ["admin-categories"],
    queryFn: async () => {
      const res = await axios.get(`${API_BASE}/categories`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      return res.data;
    },
    enabled: !!authToken,
    staleTime: 5 * 60 * 1000,
  });
  const categories = categoriesData?.categories || [];

  // --- Vendors ---
  const { data: vendorsData } = useQuery<{ vendors: Vendor[] }, Error>({
    queryKey: ["admin-vendors"],
    queryFn: async () => {
      const res = await axios.get(`${API_BASE}/vendors?limit=1000`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      return res.data;
    },
    enabled: !!authToken,
    staleTime: 5 * 60 * 1000,
  });
  const vendors = vendorsData?.vendors || [];

  // --- Product List ---
  // Compose API params
  const apiParams = useMemo(() => {
    const params: Record<string, any> = {
      page,
      per_page: perPage,
      sort_by: sortBy,
      sort_order: sortOrder,
      ...(query && { query }),
      ...(status && { status }),
      ...(categoryId && { category_ids: categoryId }), // API expects category_ids (CSV)
      ...(vendorId && { vendor_id: vendorId }),
    };
    return params;
  }, [page, perPage, sortBy, sortOrder, query, status, categoryId, vendorId]);

  // Sync URL on any filter/search/pagination change
  React.useEffect(() => {
    const params = new URLSearchParams();
    if (query) params.set("query", query);
    if (status) params.set("status", status);
    if (categoryId) params.set("category_id", categoryId);
    if (vendorId) params.set("vendor_id", vendorId);
    if (sortBy) params.set("sort_by", sortBy);
    if (sortOrder) params.set("sort_order", sortOrder);
    if (page > 1) params.set("page", String(page));
    setSearchParams(params);
  }, [query, status, categoryId, vendorId, sortBy, sortOrder, page, setSearchParams]);

  // Fetch products
  const {
    data: productsData,
    isLoading: loadingProducts,
    isError: productsError,

  } = useQuery<{ products: Product[]; total: number }, Error>({
    queryKey: ["admin-products", { ...apiParams }],
    queryFn: async () => {
      const res = await axios.get(`${API_BASE}/products`, {
        headers: { Authorization: `Bearer ${authToken}` },
        params: apiParams,
      });
      return res.data;
    },
    enabled: !!authToken,
    placeholderData: (previousData) => previousData,
  });
  const products: Product[] = productsData?.products || [];
  const total = productsData?.total || 0;

  // --- Bulk Import Status ---
  const {
    data: importStatusData,
    isLoading: loadingImportStatus,
    refetch: refetchImportStatus,
  } = useQuery<{ bulk_product_imports: BulkProductImport[] }, Error>({
    queryKey: ["admin-bulk-import-status", currentUser?.user_id],
    queryFn: async () => {
      if (!currentUser) throw new Error("Not logged in");
      const res = await axios.get(`${API_BASE}/admin/bulk-import`, {
        headers: { Authorization: `Bearer ${authToken}` },
        params: { user_id: currentUser.user_id, limit: 3 },
      });
      return res.data;
    },
    enabled: !!authToken && !!currentUser,
  });

  const importJobs: BulkProductImport[] = importStatusData?.bulk_product_imports || [];

  // ==================== Mutations ====================

  // --- Delete Single Product ---
  const queryClient = useQueryClient();
  const deleteProductMutation = useMutation({
    mutationFn: async (product_id: string) => {
      await axios.delete(`${API_BASE}/products/${encodeURIComponent(product_id)}`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      return product_id;
    },
    onSuccess: () => {
      setActionSuccess("Product deleted.");
      queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      setSelected((prev) => prev.filter((id) => !confirmDeleteIds.includes(id)));
      setConfirmDeleteIds([]);
    },
    onError: (error: any) => {
      setActionError(error.response?.data?.message || error.message || "Delete failed");
    }
  });

  // --- Bulk Delete Products (NO BULK ENDPOINT: calls delete N times) ---
  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      for (const product_id of ids) {
        // eslint-disable-next-line no-await-in-loop
        await axios.delete(`${API_BASE}/products/${encodeURIComponent(product_id)}`, {
          headers: { Authorization: `Bearer ${authToken}` }
        });
      }
      return ids;
    },
    onSuccess: () => {
      setActionSuccess("Products deleted.");
      queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      setSelected([]);
    },
    onError: (error: any) => {
      setActionError(error.response?.data?.message || error.message || "Bulk delete failed");
    }
  });

  // --- Update Product Status ---
  const updateProductStatusMutation = useMutation({
    mutationFn: async ({ product_id, status }: { product_id: string; status: string }) => {
      await axios.put(
        `${API_BASE}/products/${encodeURIComponent(product_id)}`,
        { product_id, status },
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
      return { product_id, status };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-products"] });
    },
    onError: (error: any) => {
      setActionError(error.response?.data?.message || error.message || "Status update failed");
    }
  });

  // --- Start Bulk Import ---
  const startBulkImportMutation = useMutation({
    mutationFn: async ({ file_url }: { file_url: string }) => {
      if (!currentUser) throw new Error("Not logged in");
      // For MVP, we just simulate by using any valid "file_url" (ObjectURL, S3, etc)
      const res = await axios.post(
        `${API_BASE}/admin/bulk-import`,
        { user_id: currentUser.user_id, status: 'created', file_url },
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
      return res.data;
    },
    onSuccess: () => {
      refetchImportStatus();
      setImportDialogOpen(false);
      setActionSuccess("Bulk import started!");
    },
    onError: (error: any) => {
      setActionError(error.response?.data?.message || error.message || "Bulk import failed");
    }
  });

  // ---- Download as CSV ---
  const handleExportCSV = () => {
    // Only products loaded on current page (per API)
    if (!products.length) return;
    const rows = [
      [
        "Product ID",
        "Name",
        "Description",
        "Price",
        "Inventory",
        "Status",
        "Vendor ID",
        "Avg. Rating",
        "Ratings",
        "Created",
        "Updated"
      ],
      ...products.map((prod) => [
        prod.product_id,
        `"${prod.name.replace(/"/g, '""')}"`, // sanitized
        `"${(prod.description || "").replace(/"/g, '""')}"`,
        prod.price,
        prod.inventory_count,
        prod.status,
        prod.vendor_id || "",
        prod.average_rating,
        prod.total_ratings,
        prod.created_at,
        prod.updated_at
      ])
    ];
    const blob = new Blob([rows.map((r) => r.join(",")).join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const tmp = document.createElement("a");
    tmp.href = url;
    tmp.download = "products_export.csv";
    document.body.appendChild(tmp);
    tmp.click();
    setTimeout(() => {
      document.body.removeChild(tmp);
      URL.revokeObjectURL(url);
    }, 200);
  };

  // ---- Handle import file chosen ----
  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    setActionError(null);
    if (e.target.files && e.target.files[0]) {
      setFileUploading(true);
      // In real, upload to storage & get the URL. For MVP, simulate with ObjectURL:
      const f = e.target.files[0];
      const fileUrl = URL.createObjectURL(f);
      try {
        await startBulkImportMutation.mutateAsync({ file_url: fileUrl });
      } finally {
        // Clean up object URL after short delay
        setTimeout(() => URL.revokeObjectURL(fileUrl), 3500);
        setFileUploading(false);
      }
    }
  }

  // ---- Pagination calculations ---
  const totalPages = Math.ceil(total / perPage);

  // --- Table selection helpers ----
  const allSelected = products.length > 0 && selected.length === products.length;
  const isIndeterminate = !allSelected && selected.length > 0;

  React.useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = isIndeterminate;
    }
  }, [isIndeterminate, allSelected]);

  // --- Row click to edit ---
  const handleRowClick = (id: string) => {
    navigate(`/admin/products/${encodeURIComponent(id)}`);
  };

  // --- RESET feedback after X seconds
  React.useEffect(() => {
    if (actionSuccess || actionError) {
      const timeout = setTimeout(() => {
        setActionSuccess(null);
        setActionError(null);
      }, 4200);
      return () => clearTimeout(timeout);
    }
  }, [actionSuccess, actionError]);

  // --- Accessibility: focus on error message when shown
  const errorRef = React.useRef<HTMLDivElement | null>(null);
  React.useEffect(() => {
    if (actionError && errorRef.current) {
      errorRef.current.focus();
    }
  }, [actionError]);

  return (
    <>
      {/* Bulk Import Modal */}
      {importDialogOpen && (
        <div
          className="fixed inset-0 flex items-center justify-center z-40 bg-black bg-opacity-40"
          aria-modal="true"
          role="dialog"
        >
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-8 flex flex-col items-center relative">
            <h3 className="text-lg font-semibold mb-2">Bulk Import Products</h3>
            <p className="mb-4 text-gray-600 text-sm">
              Upload a CSV or XLSX file to start bulk import. For demo/MVP, file is not uploaded to cloud storage.
            </p>
            <input
              type="file"
              accept=".csv,.xlsx"
              disabled={fileUploading}
              ref={fileInputRef}
              className="border border-gray-300 rounded px-2 py-1 w-full mb-4"
              onChange={handleFileSelected}
              aria-label="Upload CSV or XLSX file"
            />
            {fileUploading && (
              <div className="flex flex-row items-center gap-2 text-blue-600">
                <svg className="animate-spin h-5 w-5 mr-1" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
                  <path d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" fill="currentColor" className="opacity-75" />
                </svg>
                <span>Processing import...</span>
              </div>
            )}
            {startBulkImportMutation.isError && (
              <div className="text-red-600 text-sm" aria-live="polite">
                {startBulkImportMutation.error instanceof Error
                  ? startBulkImportMutation.error.message
                  : "Bulk import failed"}
              </div>
            )}
            <button
              onClick={() => setImportDialogOpen(false)}
              className="absolute top-3 right-3 text-gray-400 hover:text-gray-700 focus:outline-none"
              aria-label="Close bulk import dialog"
              tabIndex={0}
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Feedback Alerts */}
      <div aria-live="polite" className="max-w-7xl mx-auto px-4 mt-4">
        {actionSuccess && (
          <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-2 rounded mb-2 transition-all duration-200 text-sm">
            {actionSuccess}
          </div>
        )}
        {actionError && (
          <div
            className="bg-red-50 border border-red-200 text-red-800 px-4 py-2 rounded mb-2 transition-all duration-200 text-sm outline-none"
            tabIndex={-1}
            ref={errorRef}
          >
            {actionError}
          </div>
        )}
      </div>

      {/* Page Title and Actions */}
      <div className="max-w-7xl mx-auto px-4 py-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Product Catalog (Admin)</h1>
        <div className="flex flex-row gap-2">
          <Link
            to="/admin/products/new"
            className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-semibold shadow hover:bg-blue-700 focus:ring-2 focus:ring-blue-400"
            tabIndex={0}
          >
            + Add Product
          </Link>
          <button
            type="button"
            onClick={() => setImportDialogOpen(true)}
            className="bg-orange-600 hover:bg-orange-700 text-white px-3 py-2 rounded text-sm font-semibold focus:ring-2 focus:ring-orange-400"
            aria-label="Bulk import CSV/XLSX"
            tabIndex={0}
          >
            Import
          </button>
          <button
            type="button"
            onClick={handleExportCSV}
            className="bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-2 rounded text-sm font-semibold focus:ring-2 focus:ring-emerald-400"
            aria-label="Export products as CSV"
            tabIndex={0}
          >
            Export
          </button>
        </div>
      </div>

      {/* Bulk Import Jobs Status */}
      <div className="max-w-7xl mx-auto px-4 mb-6">
        {loadingImportStatus ? (
          <div className="text-sm text-gray-500">Loading import jobs...</div>
        ) : (
          importJobs.length > 0 && (
            <div className="mb-3">
              <h2 className="font-semibold text-gray-800 text-sm mb-1">Bulk Import Jobs (last 3)</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full bg-white border rounded">
                  <thead>
                    <tr className="bg-gray-50 text-xs text-gray-700">
                      <th className="px-2 py-1">Status</th>
                      <th className="px-2 py-1">File</th>
                      <th className="px-2 py-1">Created</th>
                      <th className="px-2 py-1">Completed</th>
                      <th className="px-2 py-1">Errors</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importJobs.map((job) => (
                      <tr key={job.import_id} className="text-xs text-gray-700 border-b last:border-none">
                        <td className="px-2 py-1 font-mono">
                          <span className={`inline-block px-2 py-0.5 rounded text-white text-xs ${job.status === "completed" ? "bg-emerald-500" : job.status === "failed" ? "bg-red-500" : "bg-gray-500"}`}>
                            {job.status}
                          </span>
                        </td>
                        <td className="px-2 py-1 max-w-xs truncate">
                          <a href={job.file_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                            Download
                          </a>
                        </td>
                        <td className="px-2 py-1 font-mono">{new Date(job.created_at).toLocaleString()}</td>
                        <td className="px-2 py-1 font-mono">
                          {job.completed_at ? new Date(job.completed_at).toLocaleString() : "--"}
                        </td>
                        <td className="px-2 py-1">
                          {job.error_log ? (
                            <span className="text-red-700 italic">{job.error_log}</span>
                          ) : (
                            <span className="text-gray-400">None</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )
        )}
      </div>

      {/* FILTERS/SORT/SUMMARY */}
      <div className="max-w-7xl mx-auto px-4 mb-4">
        <div className="flex flex-col md:flex-row md:items-center gap-3 mb-3">
          {/* SEARCH */}
          <div className="flex-[2]">
            <input
              type="text"
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500"
              placeholder="Search by name, description..."
              value={query}
              onChange={(e) => {
                setQuery(e.target.value.trimStart());
                setPage(1);
              }}
              aria-label="Search products"
            />
          </div>
          {/* CATEGORY */}
          <div>
            <select
              className="border border-gray-300 rounded px-2 py-2 text-sm"
              value={categoryId}
              onChange={(e) => {
                setCategoryId(e.target.value);
                setPage(1);
              }}
              aria-label="Filter by category"
            >
              <option value="">All Categories</option>
              {categories.map((cat) => (
                <option key={cat.category_id} value={cat.category_id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>
          {/* VENDOR */}
          <div>
            <select
              className="border border-gray-300 rounded px-2 py-2 text-sm"
              value={vendorId}
              onChange={(e) => {
                setVendorId(e.target.value);
                setPage(1);
              }}
              aria-label="Filter by vendor"
            >
              <option value="">All Vendors</option>
              {vendors.map((v) => (
                <option key={v.vendor_id} value={v.vendor_id}>
                  {v.display_name}
                </option>
              ))}
            </select>
          </div>
          {/* STATUS */}
          <div>
            <select
              className="border border-gray-300 rounded px-2 py-2 text-sm"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
              aria-label="Filter by product status"
            >
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="archived">Archived</option>
            </select>
          </div>
          {/* SORT */}
          <div>
            <select
              className="border border-gray-300 rounded px-2 py-2 text-sm"
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value as typeof sortBy);
                setPage(1);
              }}
              aria-label="Sort by"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          {/* SORT ORDER */}
          <div>
            <select
              className="border border-gray-300 rounded px-2 py-2 text-sm"
              value={sortOrder}
              onChange={(e) => {
                setSortOrder(e.target.value as typeof sortOrder);
                setPage(1);
              }}
              aria-label="Sort order"
            >
              <option value="asc">Asc</option>
              <option value="desc">Desc</option>
            </select>
          </div>
        </div>
        <p className="text-xs text-gray-500">
          Showing <b>{products.length}</b> of <b>{total}</b> products — page <b>{page}</b> / <b>{totalPages || 1}</b>
        </p>
      </div>

      {/* BULK ACTIONS */}
      {selected.length > 0 && (
        <div
          role="region"
          aria-label="Bulk actions"
          className="max-w-7xl mx-auto px-4 mb-3 flex items-center gap-3 py-2 bg-yellow-50 border border-yellow-200 rounded-lg"
        >
          <span className="text-gray-700 text-sm">{selected.length} selected</span>
          <button
            type="button"
            className="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded text-xs font-semibold focus:ring-2 focus:ring-red-400"
            disabled={bulkDeleteMutation.isPending}
            aria-label="Bulk delete"
            onClick={() => {
              setActionError(null);
              if (confirm("Are you sure you want to permanently delete these products?")) {
                // TODO: MISSING ENDPOINT for atomic bulk-delete; calling individual deletes
                bulkDeleteMutation.mutate(selected);
              }
            }}
          >
            {bulkDeleteMutation.isPending ? "Deleting..." : "Delete Selected"}
          </button>
          <button
            type="button"
            className="ml-2 text-blue-600 hover:underline text-xs"
            aria-label="Clear selection"
            onClick={() => setSelected([])}
          >
            Clear
          </button>
        </div>
      )}

      {/* PRODUCT TABLE */}
      <div className="max-w-7xl mx-auto px-4 overflow-x-auto">
        <div className="rounded-lg shadow overflow-x-auto border border-gray-200">
          {loadingProducts ? (
            <div className="flex items-center justify-center h-72">
              <svg className="animate-spin h-10 w-10 text-blue-600" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
          ) : productsError ? (
            <div className="p-8 text-center text-red-700" aria-live="polite">Error loading products.</div>
          ) : products.length === 0 ? (
            <div className="p-8 text-center text-gray-400" aria-live="polite">No products found.</div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr className="bg-gray-50 text-xs text-left text-gray-700">
                  <th className="pl-3 pr-2 py-2">
                    <input
                      ref={selectAllRef}
                      type="checkbox"
                      checked={allSelected}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelected(products.map((p) => p.product_id));
                        } else {
                          setSelected([]);
                        }
                      }}
                      aria-label="Select all products"
                      tabIndex={0}
                    />
                  </th>
                  <th className="px-2 py-2">Image</th>
                  <th className="px-2 py-2">Name</th>
                  <th className="px-2 py-2">Status</th>
                  <th className="px-2 py-2">Inventory</th>
                  <th className="px-2 py-2">Price</th>
                  <th className="px-2 py-2">Vendor</th>
                  <th className="px-2 py-2">Rating</th>
                  <th className="px-2 py-2">Created</th>
                  <th className="px-2 py-2">Updated</th>
                  <th className="px-2 py-2">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {products.map((product) => (
                  <tr
                    key={product.product_id}
                    className={`hover:bg-blue-50 transition cursor-pointer text-sm`}
                    tabIndex={0}
                    onClick={(e) => {
                      // Only navigate on row click NOT if a child control (checkbox, button) was clicked
                      if ((e.target as HTMLElement).closest("button,input,label")) return;
                      handleRowClick(product.product_id);
                    }}
                    aria-label={`Edit product ${product.name}`}
                  >
                    {/* Bulk select checkbox */}
                    <td className="pl-3 pr-2 py-2 align-middle">
                      <input
                        type="checkbox"
                        checked={selected.includes(product.product_id)}
                        onChange={(e) => {
                          setSelected((prev) =>
                            e.target.checked
                              ? [...prev, product.product_id]
                              : prev.filter((id) => id !== product.product_id)
                          );
                        }}
                        aria-label={`Select product ${product.name}`}
                        tabIndex={0}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </td>
                    {/* Image */}
                    <td className="px-2 py-2">
                      <img
                        src={`https://picsum.photos/seed/${product.product_id}/64/64`}
                        alt=""
                        width={42}
                        height={42}
                        className="rounded object-cover border border-gray-200"
                        loading="lazy"
                        style={{ backgroundColor: "#f3f4f6" }}
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = "https://picsum.photos/seed/fallback/64/64";
                        }}
                      />
                    </td>
                    {/* Name (title) */}
                    <td className="px-2 py-2 font-semibold" title={product.name}>
                      <span className="truncate max-w-xs inline-block align-bottom">{product.name}</span>
                    </td>
                    {/* Status toggle */}
                    <td className="px-2 py-2">
                      <select
                        value={product.status}
                        onChange={(e) => {
                          setActionError(null);
                          setActionSuccess(null);
                          updateProductStatusMutation.mutate({ product_id: product.product_id, status: e.target.value });
                        }}
                        className={`border ${product.status === "active" ? "border-emerald-500" : product.status === "inactive" ? "border-yellow-500" : "border-gray-300"} px-2 py-1 rounded text-xs`}
                        aria-label={`Change status for product ${product.name}`}
                        tabIndex={0}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                        <option value="archived">Archived</option>
                      </select>
                    </td>
                    {/* Inventory */}
                    <td className="px-2 py-2 text-center">
                      <span className={product.inventory_count > 12 ? "text-green-700" : product.inventory_count > 0 ? "text-orange-500" : "text-red-600"}>
                        {product.inventory_count}
                      </span>
                    </td>
                    {/* Price */}
                    <td className="px-2 py-2 font-mono">${product.price.toFixed(2)}</td>
                    {/* Vendor */}
                    <td className="px-2 py-2 text-xs max-w-xs truncate">
                      {product.vendor_id
                        ? (vendors.find((v) => v.vendor_id === product.vendor_id)?.display_name || product.vendor_id)
                        : <span className="text-gray-400 italic">—</span>}
                    </td>
                    {/* Average Rating */}
                    <td className="px-2 py-2">
                      <span className="text-yellow-700 font-semibold">{product.average_rating.toFixed(2)}</span>
                      <span className="text-gray-400"> ({product.total_ratings})</span>
                    </td>
                    {/* Created */}
                    <td className="px-2 py-2 text-xs font-mono whitespace-nowrap">{new Date(product.created_at).toLocaleString()}</td>
                    {/* Updated */}
                    <td className="px-2 py-2 text-xs font-mono whitespace-nowrap">{new Date(product.updated_at).toLocaleString()}</td>
                    {/* Actions: Edit, Delete */}
                    <td className="px-2 py-2 flex flex-row gap-2">
                      <Link
                        to={`/admin/products/${encodeURIComponent(product.product_id)}`}
                        className="text-blue-700 font-semibold hover:underline px-2 py-1 rounded"
                        aria-label="Edit"
                        onClick={(e) => e.stopPropagation()}
                        tabIndex={0}
                      >Edit</Link>
                      <button
                        type="button"
                        className="text-red-600 hover:bg-red-50 rounded px-2 py-1 font-semibold text-xs"
                        aria-label="Delete Product"
                        tabIndex={0}
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirmDeleteIds([product.product_id]);
                          if (confirm(`Permanently delete product "${product.name}"?`)) {
                            deleteProductMutation.mutate(product.product_id);
                          }
                        }}
                        disabled={deleteProductMutation.isPending}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Pagination controls */}
      {totalPages > 1 && (
        <nav aria-label="Product pagination" className="max-w-7xl mx-auto px-4 mt-6 text-center">
          <ul className="inline-flex items-center space-x-2">
            <li>
              <button
                onClick={() => setPage(1)}
                disabled={page === 1}
                className="px-2 py-1 rounded border border-gray-300 text-xs text-gray-700 hover:bg-gray-100 disabled:text-gray-400"
                aria-label="First page"
              >&laquo; First</button>
            </li>
            <li>
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-2 py-1 rounded border border-gray-300 text-xs text-gray-700 hover:bg-gray-100 disabled:text-gray-400"
                aria-label="Previous page"
              >&lsaquo; Prev</button>
            </li>
            {Array.from({ length: Math.min(7, totalPages) }).map((_, i) => {
              let displayPage = i + Math.max(1, page - 3);
              if (displayPage > totalPages) displayPage = totalPages;
              if (displayPage < 1) displayPage = 1;
              return (
                <li key={displayPage}>
                  <button
                    onClick={() => setPage(displayPage)}
                    className={`px-3 py-1 rounded text-xs border ${
                      page === displayPage
                        ? "bg-blue-600 text-white border-blue-600"
                        : "border-gray-300 text-gray-700 hover:bg-blue-50"
                    }`}
                    aria-current={page === displayPage ? "page" : undefined}
                    aria-label={`Go to page ${displayPage}`}
                  >{displayPage}</button>
                </li>
              );
            })}
            <li>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-2 py-1 rounded border border-gray-300 text-xs text-gray-700 hover:bg-gray-100 disabled:text-gray-400"
                aria-label="Next page"
              >Next &rsaquo;</button>
            </li>
            <li>
              <button
                onClick={() => setPage(totalPages)}
                disabled={page === totalPages}
                className="px-2 py-1 rounded border border-gray-300 text-xs text-gray-700 hover:bg-gray-100 disabled:text-gray-400"
                aria-label="Last page"
              >Last &raquo;</button>
            </li>
          </ul>
        </nav>
      )}

      {/* Accessibility: hidden live region for dynamic operations */}
      <div aria-live="polite" className="sr-only">
        {loadingProducts && "Loading products..."}
        {deleteProductMutation.isPending && "Deleting product..."}
        {bulkDeleteMutation.isPending && "Deleting selected products..."}
        {startBulkImportMutation.isPending && "Bulk import starting..."}
      </div>
    </>
  );
};

export default UV_Admin_Products;