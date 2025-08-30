import React, { useState, useEffect, useRef } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useAppStore } from '@/store/main';

// --- SCHEMA TYPES (from Zod, per backend DB:zodschemas) ---
type ProductStatus = 'active' | 'inactive' | 'pending' | 'deleted';

// Inline Product type as per schema (for type safety)
interface Product {
  product_id: string;
  name: string;
  description: string;
  price: number;
  inventory_count: number;
  status: ProductStatus;
  vendor_id: string | null;
  average_rating: number;
  total_ratings: number;
  created_at: string;
  updated_at: string;
}

// How many products per page
const PER_PAGE = 20;

// ProductStatus values and labels
const PRODUCT_STATUS_LABELS: Record<ProductStatus, string> = {
  active: 'Active',
  inactive: 'Inactive',
  pending: 'Pending',
  deleted: 'Deleted',
};

const STATUS_DROPDOWN_OPTIONS: { label: string; value: string }[] = [
  { label: 'All Statuses', value: '' },
  { label: 'Active', value: 'active' },
  { label: 'Inactive', value: 'inactive' },
  { label: 'Pending', value: 'pending' },
  { label: 'Deleted', value: 'deleted' },
];

// --- QUERY FXNS ---

const API_BASE = `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}`;

// Fetch vendor's products (filtered)
const fetchVendorProducts = async ({
  vendor_id,
  status,
  query,
  page,
}: {
  vendor_id: string;
  status: string;
  query: string;
  page: number;
  token: string;
}): Promise<{ vendor_products: Product[]; total: number }> => {
  const params: Record<string, string> = {
    vendor_id: vendor_id,
    per_page: String(PER_PAGE),
    page: String(page),
  };
  if (status) params.status = status;
  if (query) params.query = query;

  const res = await axios.get(`${API_BASE}/products`, {
    params,
    headers: {
      Authorization: `Bearer ${window.localStorage.getItem('aiocart-global-store-v1') ? JSON.parse(window.localStorage.getItem('aiocart-global-store-v1')!).authentication_state.auth_token : ''}`,
    },
  });
  // OpenAPI spec response: { products, total }
  return {
    vendor_products: res.data.products,
    total: res.data.total,
  };
};

// Delete vendor product mutation
const deleteVendorProduct = async ({
  product_id,
  token,
}: {
  product_id: string;
  token: string;
}): Promise<void> => {
  await axios.delete(`${API_BASE}/products/${product_id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
};

// Update product status mutation (requires sending the full UpdateProductInput)
const updateVendorProductStatus = async ({
  product,
  next_status,
  token,
}: {
  product: Product;
  next_status: ProductStatus;
  token: string;
}): Promise<Product> => {
  // PUT /products/{product_id} - send full UpdateProductInput
  const payload = {
    product_id: product.product_id,
    name: product.name,
    description: product.description,
    price: product.price,
    inventory_count: product.inventory_count,
    status: next_status,
    vendor_id: product.vendor_id,
  };
  const res = await axios.put(`${API_BASE}/products/${product.product_id}`, payload, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
};

// --- MAIN COMPONENT ---
const UV_Vendor_Products: React.FC = () => {
  // --- Auth State Selector (CRITICAL PATTERN) ---
  const currentUser = useAppStore(state => state.authentication_state.current_user);
  const authToken = useAppStore(state => state.authentication_state.auth_token);

  // --- Local State (search, filter, pagination) ---
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  // Use URL param or fallbacks
  const paramStatus = searchParams.get('status') || '';
  const paramQuery = searchParams.get('query') || '';
  const paramPage = Number(searchParams.get('page') || '1');

  const [selectedStatus, setSelectedStatus] = useState(paramStatus);
  const [query, setQuery] = useState(paramQuery);
  const [page, setPage] = useState(paramPage);

  // For debounced search
  const [inputValue, setInputValue] = useState(paramQuery);
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);

  // --- Error & Notification State ---
  const [localError, setLocalError] = useState<string | null>(null);
  const errorRef = useRef<HTMLDivElement | null>(null);

  // --- QUERY CLIENT ---
  const queryClient = useQueryClient();

  // --- REACT QUERY: FETCH PRODUCTS ---
  const {
    data,
    isLoading,
    isError,
    error,

    isFetching,
  } = useQuery({
    queryKey: [
      'vendor_products',
      {
        vendor_id: currentUser?.user_id || '',
        status: selectedStatus,
        query,
        page,
      }
    ],
    queryFn: () =>
      fetchVendorProducts({
        vendor_id: currentUser?.user_id || '',
        status: selectedStatus,
        query,
        page,
        token: authToken || '',
      }),
    enabled: !!currentUser && !!authToken,
    placeholderData: (previousData) => previousData,
  });

  // --- DELETE PRODUCT ---
  const {
    mutate: mutateDeleteProduct,
    isPending: isDeleting,
  } = useMutation({
    mutationFn: (vars: { product_id: string; token: string }) =>
      deleteVendorProduct(vars),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendor_products'] });
      setLocalError(null);
    },
    onError: (err: any) => {
      setLocalError(err?.response?.data?.message || err?.message || 'Delete failed');
      if (errorRef.current) errorRef.current.focus();
    },
  });

  // --- UPDATE PRODUCT STATUS ---
  const {
    mutate: mutateStatus,
    isPending: isStatusUpdating,
  } = useMutation({
    mutationFn: (vars: { product: Product; next_status: ProductStatus; token: string }) =>
      updateVendorProductStatus(vars),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendor_products'] });
      setLocalError(null);
    },
    onError: (err: any) => {
      setLocalError(err?.response?.data?.message || err?.message || 'Status update failed');
      if (errorRef.current) errorRef.current.focus();
    },
  });

  // --- URL SYNC EFFECT ---
  useEffect(() => {
    const params: any = {};
    if (selectedStatus) params.status = selectedStatus;
    if (query) params.query = query;
    if (page > 1) params.page = String(page);
    setSearchParams(params, { replace: true });
    // Clear error when filter/search/page changes
    setLocalError(null);
  }, [selectedStatus, query, page, setSearchParams]);

  // --- Search input debounce ---
  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      setQuery(inputValue);
      setPage(1);
    }, 350);
    return () => {
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
    };
    // eslint-disable-next-line
  }, [inputValue]);

  // --- Table pagination logic
  const totalProducts = data?.total || 0;
  const totalPages = Math.ceil(totalProducts / PER_PAGE);

  // --- Accessibility: scroll to error on error set
  useEffect(() => {
    if (localError && errorRef.current) {
      errorRef.current.focus();
    }
  }, [localError]);

  // --- Handlers ---
  const handleStatusFilter = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedStatus(e.target.value);
    setPage(1);
  };
  const handleSearchInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    setLocalError(null);
  };

  const handlePageChange = (nextPage: number) => {
    setPage(nextPage);
  };

  // Actions: Delete, Status Toggle
  const handleDelete = (product_id: string) => {
    if (window.confirm("Are you sure you want to delete this product? This action is irreversible.")) {
      if (authToken) {
        mutateDeleteProduct({ product_id, token: authToken });
      } else {
        setLocalError("Invalid auth token.");
      }
    }
  };

  const handleStatusToggle = (product: Product) => {
    if (!authToken) {
      setLocalError('Invalid auth token');
      return;
    }
    // Toggle only active <-> inactive. Deleted remain deleted.
    let next_status: ProductStatus = 'inactive';
    if (product.status === 'active') next_status = 'inactive';
    else if (product.status === 'inactive') next_status = 'active';
    else next_status = 'deleted'; // Deleted can't toggle
    if (product.status === 'deleted') {
      setLocalError('Cannot change status for deleted products.');
      return;
    }
    mutateStatus({ product, next_status, token: authToken });
  };

  // Add product navigation
  const handleAddProduct = () => {
    navigate('/vendor/products/new');
  };

  return (
    <>
      <div className="max-w-7xl mx-auto py-8 px-2 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between space-y-3 md:space-y-0">
          <h1 className="text-2xl font-bold text-gray-900">My Products</h1>
          <button
            onClick={handleAddProduct}
            className="ml-auto bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md shadow text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2"
            aria-label="Add Product"
            tabIndex={0}
          >
            + Add Product
          </button>
        </div>
        <div className="flex flex-col sm:flex-row items-center mb-4 gap-2">
          {/* Search */}
          <div className="flex w-full sm:w-auto items-center relative">
            <input
              type="text"
              className="w-full sm:w-64 px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 text-sm"
              placeholder="Search products..."
              value={inputValue}
              onChange={handleSearchInput}
              aria-label="Search products"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
            />
            {/* Clear btn */}
            {inputValue && (
              <button
                onClick={() => setInputValue('')}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
                aria-label="Clear search"
                tabIndex={0}
              >
                ×
              </button>
            )}
          </div>
          {/* Status filter */}
          <div className="sm:ml-4">
            <label htmlFor="status-filter" className="sr-only">
              Filter by Status
            </label>
            <select
              id="status-filter"
              value={selectedStatus}
              onChange={handleStatusFilter}
              className="border-gray-300 text-sm rounded-md px-2 py-2 focus:ring-indigo-500 focus:border-indigo-500"
              aria-label="Filter by Status"
            >
              {STATUS_DROPDOWN_OPTIONS.map(option =>
                <option key={option.value} value={option.value}>{option.label}</option>
              )}
            </select>
          </div>
        </div>

        {/* Error Message */}
        {(localError || isError || error) && (
          <div
            ref={errorRef}
            tabIndex={-1}
            aria-live="polite"
            className="rounded bg-red-100 border border-red-300 text-red-700 px-4 py-3 mb-4"
          >
            <div className="flex items-center">
              <svg aria-hidden="true" className="w-5 h-5 text-red-600 mr-2" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01" />
              </svg>
              <span>
                {localError ||
                  (error as any)?.message ||
                  (isError && 'Failed to load products.')}
              </span>
            </div>
          </div>
        )}

        {/* Table or Empty state */}
        <div className="overflow-x-auto shadow rounded-md bg-white">
          {isLoading || isFetching ? (
            <div className="py-12 flex flex-col items-center justify-center">
              <svg className="animate-spin h-8 w-8 text-blue-500 mb-2" viewBox="0 0 24 24" fill="none">
                <circle
                  className="opacity-25" cx="12" cy="12" r="10"
                  stroke="currentColor" strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              <span className="text-blue-700">Loading products…</span>
            </div>
          ) : (
            <>
              {(data?.vendor_products && data.vendor_products.length > 0) ? (
                <table className="min-w-full divide-y divide-gray-200">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Image</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Inventory</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Price</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Avg Rating</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100">
                    {data.vendor_products.map((product) => (
                      <tr key={product.product_id} data-product-id={product.product_id}>
                        {/* Image: fallback only, UI spec says no product image in schema */}
                        <td className="px-4 py-3 w-16 sm:w-20">
                          <img
                            src={`https://picsum.photos/seed/${encodeURIComponent(product.product_id)}/48/48`}
                            alt={`${product.name} preview`}
                            className="h-12 w-12 rounded object-cover border border-gray-200 bg-gray-50"
                            loading="lazy"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900">{product.name}</div>
                          <div className="text-xs text-gray-400 truncate w-48 sm:w-64">{product.product_id}</div>
                        </td>
                        <td className="px-4 py-3 text-gray-700">{product.inventory_count}</td>
                        <td className="px-4 py-3 text-gray-700">${product.price.toFixed(2)}</td>
                        <td className="px-4 py-3">
                          <span
                            className={
                              'inline-block px-2 py-1 rounded-full text-xs font-semibold ' +
                              (product.status === 'active'
                                ? 'bg-green-100 text-green-800'
                                : (product.status === 'inactive'
                                  ? 'bg-yellow-100 text-yellow-700'
                                  : 'bg-gray-200 text-gray-600'))
                            }
                          >
                            {PRODUCT_STATUS_LABELS[product.status]}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-700">
                          <span title={`Total ratings: ${product.total_ratings}`}>
                            {product.average_rating?.toFixed(2) || '0.00'} / 5
                          </span>
                        </td>
                        <td className="px-4 py-2 text-right">
                          <div className="flex items-center justify-end gap-1 space-x-1">
                            {/* Edit */}
                            <Link
                              to={`/vendor/products/${product.product_id}`}
                              className="inline-flex items-center px-2 py-1 text-xs font-medium rounded bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-300 transition"
                              aria-label="Edit product"
                              tabIndex={0}
                            >
                              <svg aria-hidden="true" className="h-4 w-4 mr-1" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                <path d="M15.232 5.232l3.536 3.536M9 11l4 4L20.485 7.515A2.121 2.121 0 1017.364 4.393L9 12.757V17h4.243z" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                              Edit
                            </Link>

                            {/* Status toggler (active/inactive only) */}
                            {(product.status === 'active' || product.status === 'inactive') && (
                              <button
                                tabIndex={0}
                                className={
                                  "inline-flex items-center px-2 py-1 text-xs font-medium rounded border " +
                                  (product.status === 'active'
                                    ? 'bg-yellow-100 hover:bg-yellow-200 text-yellow-700 border-yellow-300'
                                    : 'bg-green-100 hover:bg-green-200 text-green-800 border-green-300')
                                }
                                onClick={() => handleStatusToggle(product)}
                                aria-label={product.status === 'active' ? "Deactivate product" : "Activate product"}
                                disabled={isStatusUpdating}
                              >
                                <svg aria-hidden="true" className="h-4 w-4 mr-1" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                  {product.status === 'active' ? (
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6" />
                                  ) : (
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6m-3-3h6" />
                                  )}
                                </svg>
                                {product.status === 'active' ? 'Deactivate' : 'Activate'}
                              </button>
                            )}

                            {/* Delete */}
                            {product.status !== 'deleted' && (
                              <button
                                tabIndex={0}
                                className="inline-flex items-center px-2 py-1 text-xs font-medium rounded bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 focus:outline-none focus:ring-2 focus:ring-red-300 ml-1"
                                aria-label="Delete product"
                                onClick={() => handleDelete(product.product_id)}
                                disabled={isDeleting}
                              >
                                <svg aria-hidden="true" className="h-4 w-4 mr-1" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                                Delete
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="py-12 flex flex-col items-center justify-center">
                  <svg className="h-16 w-16 text-gray-400 mb-2" viewBox="0 0 64 64" fill="none">
                    <rect x="8" y="16" width="48" height="24" rx="6" fill="#e5e7eb" />
                    <rect x="20" y="14" width="24" height="4" rx="2" fill="#cbd5e1" />
                  </svg>
                  <p className="text-gray-700 mb-2 text-lg">No products found.</p>
                  <button
                    onClick={handleAddProduct}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md shadow text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2"
                    aria-label="Add your first product"
                    tabIndex={0}
                  >
                    + Add your first product
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Pagination */}
        {totalProducts > 0 && totalPages > 1 && (
          <nav
            className="flex justify-between items-center py-5"
            aria-label="Pagination"
          >
            <button
              onClick={() => handlePageChange(page - 1)}
              disabled={page <= 1 || isLoading || isFetching}
              className="px-3 py-2 bg-white border border-gray-200 rounded-md text-sm font-medium text-gray-900 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Previous page"
            >
              Previous
            </button>
            <div className="text-sm text-gray-700 flex-1 text-center">
              Page <span className="font-semibold">{page}</span> of <span className="font-semibold">{totalPages}</span>
            </div>
            <button
              onClick={() => handlePageChange(page + 1)}
              disabled={page >= totalPages || isLoading || isFetching}
              className="px-3 py-2 bg-white border border-gray-200 rounded-md text-sm font-medium text-gray-900 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Next page"
            >
              Next
            </button>
          </nav>
        )}
      </div>
    </>
  );
};

export default UV_Vendor_Products;