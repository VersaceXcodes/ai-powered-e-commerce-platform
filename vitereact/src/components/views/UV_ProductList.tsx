import React, { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams, useNavigate, Link, useLocation } from "react-router-dom";
import axios from "axios";
import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import { useAppStore } from "@/store/main";

// --- Types from Zod schemas (copy/paste, for type-safety) ---
interface Product {
  product_id: string;
  name: string;
  description: string;
  price: number;
  inventory_count: number;
  status: "active" | "inactive" | "pending" | "deleted";
  vendor_id: string | null;
  average_rating: number;
  total_ratings: number;
  created_at: string;
  updated_at: string;
}

interface Category {
  category_id: string;
  name: string;
  parent_category_id: string | null;
  created_at: string;
  updated_at: string;
}

// --- API base URL ---
const API_BASE = `${import.meta.env.VITE_API_BASE_URL || "http://localhost:3000"}`;

// --- Helpers ---
const parseQueryParamStringArray = (value?: string | string[] | null) => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.join(",").split(",").filter(Boolean);
  }
  return value.split(",").filter(Boolean);
};

const DEFAULT_PAGE_SIZE = 24;

const PRODUCT_LIST_QUERY_KEY = "product-list";
const CATEGORY_LIST_QUERY_KEY = "category-list";

// --- Product list fetcher with filters ---
type ListProductsParams = {
  query?: string;
  category_ids?: string[];
  price_min?: number;
  price_max?: number;
  rating_min?: number;
  in_stock?: boolean;
  sort_by?: "name" | "price" | "created_at" | "average_rating";
  sort_order?: "asc" | "desc";
  page?: number;
  per_page?: number;
};

const fetchProducts = async ({
  query,
  category_ids,
  price_min,
  price_max,
  rating_min,
  in_stock,
  sort_by,
  sort_order,
  page,
  per_page,
}: ListProductsParams & { pageParam?: number }) => {
  // Backend supports only single category_id.
  // Use the first if multiple are selected.
  const params: Record<string, any> = {
    limit: per_page || DEFAULT_PAGE_SIZE,
    offset: ((page || 1) - 1) * (per_page || DEFAULT_PAGE_SIZE),
    status: "active"
  };
  if (query) params.query = query;
  if (category_ids && category_ids.length > 0) params.category_id = category_ids[0];
  if (price_min != null) params.min_price = price_min;
  if (price_max != null) params.max_price = price_max;
  if (sort_by) params.sort_by = sort_by;
  if (sort_order) params.sort_order = sort_order;

  const url = `${API_BASE}/products`;
  const resp = await axios.get<{ products: Product[] }>(url, { params });
  let products = resp.data.products || [];
  // Client-side filter for rating_min and in_stock since API does not support
  if (rating_min != null) products = products.filter((p) => p.average_rating >= rating_min);
  if (in_stock) products = products.filter((p) => p.inventory_count > 0);
  return products;
};

// --- Categories fetcher ---
const fetchCategories = async () => {
  const url = `${API_BASE}/categories?limit=100&sort_by=name&sort_order=asc`;
  const resp = await axios.get<{ categories: Category[] }>(url);
  return resp.data.categories || [];
};

// --- Utility: debounce hook for search queries ---
function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timeout = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timeout);
  }, [value, delay]);
  return debounced;
}

// --- Main Component ---
const UV_ProductList: React.FC = () => {
  // ------ URL state ------
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();

  // ---- Zustand auth for future navigation or context ----
  const currentUser = useAppStore((state) => state.authentication_state.current_user);

  // --- Filter state from URL, with React state for inputs ---
  const [searchInput, setSearchInput] = useState(() => searchParams.get("query") || "");
  const debouncedSearchInput = useDebouncedValue(searchInput, 350);
  const [categoryIds, setCategoryIds] = useState<string[]>(
    () => parseQueryParamStringArray(searchParams.get("category_ids"))
  );
  const [priceMin, setPriceMin] = useState<number>(() => {
    const v = searchParams.get("price_min");
    return v ? Number(v) : 0;
  });
  const [priceMax, setPriceMax] = useState<number>(() => {
    const v = searchParams.get("price_max");
    return v ? Number(v) : 0;
  });
  const [ratingMin, setRatingMin] = useState<number>(() => {
    const v = searchParams.get("rating_min");
    return v ? Number(v) : 0;
  });
  const [inStockOnly, setInStockOnly] = useState<boolean>(() =>
    searchParams.get("in_stock") === "true"
  );
  const [sortBy, setSortBy] = useState<"name" | "price" | "created_at" | "average_rating">(
    // Custom URL mapping
    () => (["name", "price", "created_at", "average_rating"].includes(searchParams.get("sort_by") || "")
      ? (searchParams.get("sort_by") as any)
      : "created_at")
  );
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">(
    () => (searchParams.get("sort_order") === "asc" ? "asc" : "desc")
  );
  const [page, setPage] = useState<number>(
    () => Number(searchParams.get("page")) > 0 ? Number(searchParams.get("page")) : 1
  );
  const [perPage, setPerPage] = useState<number>(
    () => Number(searchParams.get("per_page")) > 0 ? Number(searchParams.get("per_page")) : DEFAULT_PAGE_SIZE
  );

  // --- Update URL params when filter/search/sort/page changes ---
  useEffect(() => {
    // Compose only filled params
    const params: Record<string, string> = {};
    if (debouncedSearchInput) params["query"] = debouncedSearchInput;
    if (categoryIds.length) params["category_ids"] = categoryIds.join(",");
    if (priceMin > 0) params["price_min"] = String(priceMin);
    if (priceMax > 0) params["price_max"] = String(priceMax);
    if (Number(ratingMin) > 0) params["rating_min"] = String(ratingMin);
    if (inStockOnly) params["in_stock"] = "true";
    if (sortBy) params["sort_by"] = sortBy;
    if (sortOrder) params["sort_order"] = sortOrder;
    if (page > 1) params["page"] = String(page);
    if (perPage !== DEFAULT_PAGE_SIZE) params["per_page"] = String(perPage);
    setSearchParams(params, { replace: true });
  // eslint-disable-next-line
  }, [
    debouncedSearchInput,
    categoryIds.join(","),
    priceMin,
    priceMax,
    ratingMin,
    inStockOnly,
    sortBy,
    sortOrder,
    page,
    perPage,
  ]);

  // --- Fetch categories for filter sidebar ---
  const {
    data: categories = [],
    isLoading: isCatLoading,
    isError: isCatError,
    error: catError,
  } = useQuery<Category[], Error>({
    queryKey: [CATEGORY_LIST_QUERY_KEY],
    queryFn: fetchCategories,
    staleTime: 10 * 60 * 1000, // 10m
  });

  // --- Fetch paginated products ---
  const {
    data: productsPage,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<Product[], Error>({
    queryKey: [
      PRODUCT_LIST_QUERY_KEY,
      debouncedSearchInput,
      JSON.stringify(categoryIds),
      priceMin,
      priceMax,
      ratingMin,
      inStockOnly,
      sortBy,
      sortOrder,
      page,
      perPage,
    ],
    queryFn: () =>
      fetchProducts({
        query: debouncedSearchInput.trim() || undefined,
        category_ids: categoryIds,
        price_min: priceMin > 0 ? priceMin : undefined,
        price_max: priceMax > 0 ? priceMax : undefined,
        rating_min: ratingMin > 0 ? ratingMin : undefined,
        in_stock: inStockOnly ? true : undefined,
        sort_by: sortBy,
        sort_order: sortOrder,
        page,
        per_page: perPage,
      }),
    placeholderData: (previousData) => previousData,
    retry: 1,
  });

  // --- Pagination: if less than perPage returned, assume last page; else allow load more ---
  const [products, setProducts] = useState<Product[]>([]);
  const [hasMore, setHasMore] = useState(true);

  // Always reset list on filter change
  useEffect(() => {
    setProducts([]);
    setPage(1);
  // eslint-disable-next-line
  }, [
    debouncedSearchInput,
    categoryIds.join(","),
    priceMin,
    priceMax,
    ratingMin,
    inStockOnly,
    sortBy,
    sortOrder,
    perPage,
  ]);

  // On fetch, append/replace products based on page
  useEffect(() => {
    if (!isLoading && !isError && productsPage) {
      if (page === 1) {
        setProducts(productsPage);
      } else {
        setProducts((prev) => [...prev, ...productsPage]);
      }
      setHasMore(productsPage.length === perPage); // No more if less returned than page size
    }
  }, [productsPage, isLoading, isError, page, perPage]);

  // --- Filter Dialog Handlers ---
  const handleCategoryToggle = (catId: string) => {
    setCategoryIds((prev) =>
      prev.includes(catId) ? prev.filter((id) => id !== catId) : [...prev, catId]
    );
    setPage(1);
  };
  const handleSortBy = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSortBy(e.target.value as any);
    setPage(1);
  };
  const handleSortOrder = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSortOrder(e.target.value as any);
    setPage(1);
  };
  const handlePriceRange = (min: number, max: number) => {
    setPriceMin(min);
    setPriceMax(max);
    setPage(1);
  };
  const handleRatingMin = (v: number) => {
    setRatingMin(v);
    setPage(1);
  };
  const handleStockToggle = () => {
    setInStockOnly((v) => !v);
    setPage(1);
  };
  const handleSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchInput(e.target.value);
    setPage(1);
  };
  const handleClearFilters = () => {
    setCategoryIds([]);
    setPriceMin(0);
    setPriceMax(0);
    setRatingMin(0);
    setInStockOnly(false);
    setSortBy("created_at");
    setSortOrder("desc");
    setSearchInput("");
    setPage(1);
    setPerPage(DEFAULT_PAGE_SIZE);
  };
  const handleLoadMore = () => {
    setPage((p) => p + 1);
  };

  // Breadcrumbs (category nav, if any category selected)
  const breadcrumbs = useMemo(() => {
    if (categoryIds.length === 0 || !categories.length) return [];
    const names = categoryIds
      .map((catId) => categories.find((c) => c.category_id === catId)?.name)
      .filter(Boolean);
    return names;
  }, [categoryIds, categories]);

  // --- Product card helper (images: use picsum.photos with unique ID) ---
  function getProductImageUrl(product_id: string) {
    // Avoid leaking prod_id to picsum, but gets unique img by seed
    return `https://picsum.photos/seed/${encodeURIComponent(product_id)}/320/320`;
  }

  // Skeleton loading cards
  const skeletonCards = [];
  for (let i = 0; i < perPage; ++i) {
    skeletonCards.push(
      <div
        key={i}
        className="animate-pulse bg-white rounded-md border shadow flex flex-col"
      >
        <div className="bg-gray-100 h-48 w-full rounded-t-md"></div>
        <div className="flex-1 p-4 space-y-2">
          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          <div className="h-3 bg-gray-100 rounded w-1/3"></div>
        </div>
      </div>
    );
  }

  // --- Error boundary fallback ---
  const [boundaryError, setBoundaryError] = useState<string | null>(null);
  
  useEffect(() => {
    // Simple global error fallback for query
    if (isError || isCatError) {
      setBoundaryError(
        error?.message ||
          catError?.message ||
          "Something went wrong loading the catalog. Try again later."
      );
    } else {
      setBoundaryError(null);
    }
  }, [isError, isCatError, error, catError]);

  // --- Keyboard navigation/focus management for filters (simple implementation) ---
  const searchInputRef = useRef<HTMLInputElement>(null);

  // --- Render ---
  return (
    <>
      <main className="min-h-screen bg-gray-50 flex flex-col py-4 px-2 sm:px-6 lg:px-16">
        <div className="max-w-7xl mx-auto w-full flex flex-col sm:flex-row gap-6">
          {/* ---- Filter panel (sidebar on desktop, top bar on mobile) ---- */}
          <aside className="w-full sm:w-64 mb-6 sm:mb-0">
            <div className="bg-white p-4 rounded-md shadow border mb-4">
              <div className="flex items-center gap-1 mb-3">
                <svg width="22" height="22" fill="none" stroke="currentColor" className="text-blue-500" aria-hidden="true">
                  <path d="M7 7h10M7 11h6M7 15h8" strokeWidth={2} strokeLinecap="round"></path>
                </svg>
                <h2 className="font-bold text-lg tracking-tight">Filters</h2>
                <button
                  type="button"
                  className="ml-auto text-xs bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded"
                  onClick={handleClearFilters}
                  aria-label="Clear all filters"
                >
                  Clear
                </button>
              </div>
              {/* --- SEARCH --- */}
              <label htmlFor="search" className="block font-semibold text-gray-700 mb-1">
                Search
              </label>
              <input
                id="search"
                ref={searchInputRef}
                type="text"
                value={searchInput}
                onChange={handleSearchInputChange}
                className="w-full mb-3 px-3 py-2 rounded border border-gray-200 text-gray-800 bg-gray-50 focus:ring-2 focus:ring-blue-200 focus:outline-none"
                placeholder="Search products..."
                autoComplete="off"
              />
              {/* --- CATEGORIES --- */}
              <fieldset className="mb-3" aria-label="Category">
                <legend className="block text-gray-700 font-semibold mb-1">Categories</legend>
                <div className="flex flex-wrap gap-2">
                  {isCatLoading ? (
                    <span className="text-gray-400">Loading...</span>
                  ) : isCatError ? (
                    <span className="text-red-500 text-xs">{catError?.message || "Failed to load"}</span>
                  ) : (
                    <>
                      {categories.map((cat) => (
                        <button
                          key={cat.category_id}
                          type="button"
                          className={`px-2 py-1 border rounded ${
                            categoryIds.includes(cat.category_id)
                              ? "bg-blue-50 border-blue-400 text-blue-700 font-semibold"
                              : "bg-gray-100 border-gray-200 text-gray-700"
                          }`}
                          onClick={() => handleCategoryToggle(cat.category_id)}
                          aria-pressed={categoryIds.includes(cat.category_id)}
                        >
                          {cat.name}
                        </button>
                      ))}
                    </>
                  )}
                </div>
              </fieldset>
              {/* --- PRICE --- */}
              <fieldset className="mb-3" aria-label="Price range">
                <legend className="block text-gray-700 font-semibold mb-1">Price Range</legend>
                <div className="flex gap-2 items-center">
                  <input
                    type="number"
                    min={0}
                    max={priceMax || undefined}
                    className="w-20 px-2 py-1 rounded border border-gray-200 text-gray-700"
                    placeholder="Min"
                    value={priceMin || ""}
                    onChange={e => {
                      setPriceMin(e.target.value === "" ? 0 : Math.max(0, parseFloat(e.target.value)));
                      setPage(1);
                    }}
                  />
                  <span>-</span>
                  <input
                    type="number"
                    min={priceMin}
                    className="w-20 px-2 py-1 rounded border border-gray-200 text-gray-700"
                    placeholder="Max"
                    value={priceMax || ""}
                    onChange={e => {
                      setPriceMax(e.target.value === "" ? 0 : Math.max(priceMin, parseFloat(e.target.value)));
                      setPage(1);
                    }}
                  />
                </div>
              </fieldset>
              {/* --- RATINGS --- */}
              <fieldset className="mb-3" aria-label="Minimum rating">
                <legend className="block text-gray-700 font-semibold mb-1">Minimum Rating</legend>
                <div className="flex gap-1">
                  {[0, 1, 2, 3, 4, 5].map(v => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => handleRatingMin(v)}
                      className={`px-2 py-1 rounded border text-xs ${
                        ratingMin === v
                          ? "bg-yellow-100 border-yellow-400 text-yellow-700"
                          : "bg-gray-100 border-gray-200 text-gray-600"
                      }`}
                      aria-pressed={ratingMin === v}
                    >
                      {v === 0 ? "Any" : "★".repeat(v)}
                    </button>
                  ))}
                </div>
              </fieldset>
              {/* --- IN STOCK --- */}
              <div className="mb-1">
                <label className="inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={inStockOnly}
                    onChange={handleStockToggle}
                    className="form-checkbox rounded"
                  />
                  <span className="ml-2 text-gray-700">In stock only</span>
                </label>
              </div>
            </div>
          </aside>

          {/* ---- Product Grid/Results ---- */}
          <section className="flex-1 flex flex-col">
            {/* Breadcrumb nav for categories */}
            {breadcrumbs.length > 0 && (
              <nav className="mb-3 text-sm text-gray-500 flex items-center gap-1" aria-label="Breadcrumb">
                <Link to="/products" className="hover:underline">All Products</Link>
                <span aria-hidden="true">/</span>
                {breadcrumbs.map((cat, idx) => (
                  <span key={cat}>
                    {cat}
                    {idx < breadcrumbs.length - 1 && <span aria-hidden="true">/</span>}
                  </span>
                ))}
              </nav>
            )}

            {/* Sort controls */}
            <div className="bg-white rounded-md shadow flex flex-col sm:flex-row items-center justify-between py-2 px-3 mb-4 border">
              <div className="flex items-center gap-2 mb-2 sm:mb-0">
                <span className="font-semibold text-gray-800 text-sm">Sort by:</span>
                <select
                  value={sortBy}
                  onChange={handleSortBy}
                  className="rounded border-gray-200 px-2 py-1 text-sm"
                >
                  <option value="created_at">Newest</option>
                  <option value="price">Price</option>
                  <option value="name">Name</option>
                  <option value="average_rating">Rating</option>
                </select>
                <select
                  value={sortOrder}
                  onChange={handleSortOrder}
                  className="rounded border-gray-200 px-2 py-1 text-sm"
                  aria-label="Sort order"
                >
                  <option value="desc">Desc</option>
                  <option value="asc">Asc</option>
                </select>
              </div>
              <div className="flex gap-2 items-center text-gray-500 text-xs">
                <span>Page</span>
                <select
                  value={page}
                  onChange={e => setPage(Number(e.target.value) || 1)}
                  className="rounded border-gray-200 px-2 py-1 text-xs"
                  aria-label="Page"
                >
                  {Array.from({ length: Math.max(Math.ceil(products.length / perPage) + (hasMore ? 1 : 0), 1) }, (_, i) => (
                    <option key={i + 1} value={i + 1}>
                      {(i + 1).toString()}
                    </option>
                  ))}
                </select>
                <span className="ml-2">Per page</span>
                <select
                  value={perPage}
                  onChange={e => { setPerPage(Number(e.target.value)); setPage(1); }}
                  className="rounded border-gray-200 px-2 py-1 text-xs"
                  aria-label="Results per page"
                >
                  {[12, 24, 48, 96].map(n => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>
            </div>
            {/* Error, Loading, Empty States */}
            {boundaryError && (
              <div className="bg-red-50 border border-red-200 rounded p-4 mb-4 text-red-800" role="alert" aria-live="polite">
                <strong>Error:</strong> {boundaryError}
                <button
                  onClick={() => {setBoundaryError(null); refetch();}}
                  className="ml-4 text-sm underline"
                >
                  Retry
                </button>
              </div>
            )}
            {isLoading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-5">
                {skeletonCards}
              </div>
            ) : (
              <>
                {products.length === 0 ? (
                  <div className="flex flex-col items-center justify-center p-12">
                    <svg width="44" height="44" fill="none" className="mb-3 text-blue-200">
                      <circle cx="22" cy="22" r="21" stroke="currentColor" strokeWidth="2"/>
                      <path d="M28 18l-6 6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <h3 className="text-lg font-bold text-gray-600 mb-1">No results found</h3>
                    <div className="text-gray-400 mb-3 text-sm">
                      Try adjusting your filters, removing some, or browse our <Link to="/products" className="text-blue-500 hover:underline">full catalog</Link>.
                    </div>
                    <button
                      type="button"
                      onClick={handleClearFilters}
                      className="bg-blue-100 text-blue-700 px-4 py-2 rounded font-semibold hover:bg-blue-200"
                    >
                      Reset Filters
                    </button>
                  </div>
                ) : (
                  <>
                    <div
                      className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-5"
                      aria-live="polite"
                    >
                      {products.map((product) => (
                        <Link
                          to={`/product/${product.product_id}`}
                          key={product.product_id}
                          tabIndex={0}
                          className="bg-white rounded-md border shadow hover:shadow-md transition-shadow focus:outline-none focus:ring-2 focus:ring-blue-400 flex flex-col group"
                          aria-label={product.name}
                        >
                          <img
                            src={getProductImageUrl(product.product_id)}
                            alt={product.name || "Product image"}
                            className="object-cover w-full h-48 rounded-t-md group-hover:opacity-95 transition"
                            loading="lazy"
                            style={{ background: "#f2f2f2" }}
                          />
                          <div className="flex-1 p-3 flex flex-col justify-between">
                            <div>
                              <div className="flex items-center gap-1 mb-1">
                                <span className="font-semibold text-gray-900 truncate text-sm flex-1">{product.name}</span>
                                {product.inventory_count === 0
                                  ? <span className="ml-2 bg-red-50 border border-red-200 text-red-600 rounded px-2 py-0.5 text-xs font-medium">Out of Stock</span>
                                  : product.inventory_count <= 3
                                    ? <span className="ml-2 bg-yellow-50 border border-yellow-200 text-yellow-600 rounded px-2 py-0.5 text-xs font-medium">Low Stock</span>
                                    : <span className="ml-2 bg-green-50 border border-green-200 text-green-600 rounded px-2 py-0.5 text-xs font-medium">In Stock</span>
                                }
                              </div>
                              <div className="flex items-center gap-1 mb-2">
                                <span className="text-blue-800 font-bold text-base">
                                  ${product.price.toFixed(2)}
                                </span>
                                <span className="text-gray-400 ml-1 text-xs">{product.total_ratings} ratings</span>
                              </div>
                              {/* Rating: Simple stars */}
                              <div className="flex gap-0.5 items-center mb-1" aria-label={`Rating: ${product.average_rating}`}>
                                {[1,2,3,4,5].map(i => (
                                  <svg
                                    key={i}
                                    width="16"
                                    height="16"
                                    fill={product.average_rating >= i ? "#facc15" : "#e2e8f0"}
                                  >
                                    <polygon points="8,2 10,6 14,6 11,9 12,13 8,11 4,13 5,9 2,6 6,6"/>
                                  </svg>
                                ))}
                                <span className="ml-1 text-xs text-gray-500">{product.average_rating.toFixed(1)}</span>
                              </div>
                              {/* Desc snippet (no HTML, plain) */}
                              <p className="text-gray-600 text-xs mt-1 line-clamp-2">{product.description.slice(0, 64)}...</p>
                            </div>
                            <div className="flex items-center justify-between mt-3">
                              <span className="text-xs text-gray-400">ID: <span className="font-mono">{product.product_id.slice(-8)}</span></span>
                              <span></span>
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                    {/* Load more (pagination) */}
                    {hasMore && (
                      <div className="flex justify-center mt-6">
                        <button
                          type="button"
                          onClick={handleLoadMore}
                          className="px-8 py-2 text-blue-700 font-semibold bg-blue-50 border border-blue-100 rounded hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-300"
                          disabled={isLoading}
                          aria-label="Load more products"
                        >
                          {isLoading ? "Loading..." : "Load More"}
                        </button>
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </section>
        </div>
      </main>
    </>
  );
};

export default UV_ProductList;