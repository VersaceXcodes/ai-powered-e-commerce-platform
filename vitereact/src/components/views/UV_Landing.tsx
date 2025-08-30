import React from "react";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { Link } from "react-router-dom";
import { useAppStore } from "@/store/main";

import type { AIRecommendation, Product, Category } from "@schema";

// --- API helpers ---
const API_BASE =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";

// --- Fetch AI Recommendations ---
// NOTE: Returns ai_recommendations: AiRecommendation[]
const fetchAiRecommendations = async (
  user_id: string | null
): Promise<AIRecommendation[]> => {
  const params: Record<string, string> = {};
  if (user_id) params.user_id = user_id;
  const { data } = await axios.get(`${API_BASE}/ai/recommendations`, {
    params,
  });
  // Must match backend's response: { ai_recommendations: AiRecommendation[], total }
  return data.ai_recommendations;
};

// --- Fetch Featured Products (top 6 "active" by popularity) ---
const fetchFeaturedProducts = async (): Promise<Product[]> => {
  const { data } = await axios.get(`${API_BASE}/products`, {
    params: {
      sort_by: "popularity",
      status: "active",
      per_page: 6,
    },
  });
  // Must match backend's response: { products: Product[], total }
  return data.products;
};

// --- Fetch Categories ---
const fetchCategories = async (): Promise<Category[]> => {
  const { data } = await axios.get(`${API_BASE}/categories`);
  return data.categories;
};

const UV_Landing: React.FC = () => {
  // ---- GLOBAL AUTH STATE (Zustand, individual selectors) ----
  const isAuthenticated = useAppStore(
    (state) => state.authentication_state.authentication_status.is_authenticated
  );
  const currentUser = useAppStore(
    (state) => state.authentication_state.current_user
  );

  // --- AI Recommendations ---
  const {
    data: aiRecs,
    isLoading: aiRecsLoading,
    error: aiRecsError,

  } = useQuery<AIRecommendation[], Error>({
    queryKey: [
      "ai_recommendations",
      currentUser?.user_id || "guest",
    ],
    queryFn: () => fetchAiRecommendations(currentUser?.user_id || null),
    // Refetch when user_id changes for perfect live personalization
    enabled: true,
    staleTime: 1000 * 60, // 1 min
    retry: 1,
    refetchOnWindowFocus: false,
  });

  // --- FEATURED PRODUCTS ---
  const {
    data: featuredProducts,
    isLoading: featuredProductsLoading,
    error: featuredProductsError,
  } = useQuery<Product[], Error>({
    queryKey: ["featured_products"],
    queryFn: fetchFeaturedProducts,
    staleTime: 1000 * 120, // 2 min
    retry: 1,
    refetchOnWindowFocus: false,
  });

  // --- CATEGORIES ---
  const {
    data: categories,
    isLoading: categoriesLoading,
    error: categoriesError,
  } = useQuery<Category[], Error>({
    queryKey: ["categories"],
    queryFn: fetchCategories,
    staleTime: 1000 * 300, // 5 min
    retry: 1,
    refetchOnWindowFocus: false,
  });

  // ---- Loading and Error States ----
  const isLoading =
    aiRecsLoading || featuredProductsLoading || categoriesLoading;
  const error =
    aiRecsError?.message ||
    featuredProductsError?.message ||
    categoriesError?.message ||
    null;

  // --- Accessibility Helpers ---
  const aiSectionLabel = isAuthenticated
    ? "Recommended for You"
    : "Trending Now";

  // --- Banner image (public CDN, or fallback) ---
  const bannerImgUrl =
    "https://picsum.photos/seed/bannerhome-1/1200/350";

  // --- Helper: Empty state fallback texts ---
  const noRecsMessage = isAuthenticated
    ? "No personal recommendations yet. Try exploring featured products below or shop new arrivals!"
    : "Trending recommendations are currently unavailable. Try browsing categories or featured products!";

  const heroCtaBrowse = (
    <Link
      to="/products"
      className="inline-block rounded-md bg-blue-600 text-white font-semibold px-6 py-3 shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 text-lg transition"
    >
      Browse All Products
    </Link>
  );

  const heroCtaRegister = (
    <Link
      to="/register"
      className="ml-4 inline-block rounded-md border border-blue-500 text-blue-600 font-semibold px-6 py-3 hover:bg-blue-50 hover:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 text-lg transition"
    >
      Create Account
    </Link>
  );

  const heroCtaLogin = (
    <Link
      to="/login"
      className="ml-4 inline-block rounded-md border border-gray-400 text-gray-700 font-semibold px-6 py-3 hover:bg-gray-50 hover:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 text-lg transition"
    >
      Sign In
    </Link>
  );

  // --- HERO/BANNER BG Overlay Style (for big contrast on any img) ---
  return (
    <>
      {/* Error Boundaries - always wrap in safe containers */}
      {error && (
        <div
          role="alert"
          aria-live="polite"
          className="max-w-2xl mx-auto my-4 px-4 py-3 bg-red-50 border border-red-200 rounded text-red-700 text-center"
        >
          <span aria-label="Error:">{error}</span>
        </div>
      )}

      {/* Banner / Hero */}
      <section
        className="relative h-[260px] md:h-[340px] w-full flex items-center overflow-hidden rounded-b-xl bg-gradient-to-br from-blue-50 to-white shadow"
        aria-label="Promotions or Storefront Hero"
      >
        <img
          src={bannerImgUrl}
          alt="Storefront offers and seasonal heroes"
          className="absolute inset-0 w-full h-full object-cover object-center opacity-70 pointer-events-none select-none"
          loading="eager"
          draggable={false}
        />
        <div className="relative z-10 max-w-4xl mx-auto px-8 py-8 w-full flex flex-col items-center justify-center text-center">
          <h1 className="text-3xl md:text-5xl font-black text-gray-900 mb-2 drop-shadow-lg">
            Welcome to AIOCart
          </h1>
          <p className="mt-1 text-base md:text-xl text-gray-700 font-medium mb-6">
            Shop smarter with AI-powered recommendations, trendiest products, and hand-picked deals for you.
          </p>
          <div className="flex justify-center flex-wrap gap-2">
            {heroCtaBrowse}
            {!isAuthenticated && heroCtaRegister}
            {!isAuthenticated && heroCtaLogin}
          </div>
        </div>
      </section>

      <div className="w-full max-w-7xl mx-auto px-4 py-7 md:py-10">
        {/* --- Categories Chips Tiles --- */}
        <section
          aria-label="Product Categories"
          className="mb-8"
        >
          <h2 className="text-xl md:text-2xl font-bold mb-4 text-gray-800">Shop by Category</h2>
          {categoriesLoading ? (
            <div className="flex flex-row gap-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <span
                  key={i}
                  className="inline-block h-10 w-32 bg-gray-100 animate-pulse rounded-full"
                  aria-hidden="true"
                ></span>
              ))}
            </div>
          ) : categories && categories.length > 0 ? (
            <div className="flex flex-row flex-wrap gap-x-3 gap-y-2">
              {categories.map((category) => (
                <Link
                  to={`/products?category_ids=${encodeURIComponent(category.category_id)}`}
                  key={category.category_id}
                  data-cat={category.category_id}
                  className="inline-flex items-center px-5 py-2 rounded-full bg-blue-50 text-blue-700 hover:bg-blue-100 hover:text-blue-800 text-base font-medium border border-blue-200 shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-400"
                  tabIndex={0}
                  aria-label={`Browse category: ${category.name}`}
                >
                  <span className="truncate">{category.name}</span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-gray-500 italic">No categories found.</div>
          )}
        </section>

        {/* --- AI Recommendations --- */}
        <section
          className="mb-12"
          aria-label={aiSectionLabel}
        >
          <div className="flex flex-row justify-between items-baseline mb-2">
            <h2 className="text-xl md:text-2xl font-bold text-gray-800">
              {aiSectionLabel}
            </h2>
            {/* Only for authenticated users: see more recs (optional future action) */}
          </div>
          {aiRecsLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5 mt-2">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="flex flex-col items-center rounded-lg border border-gray-100 bg-gray-50 p-4 shadow animate-pulse"
                >
                  <div className="h-32 w-32 bg-gray-200 rounded-lg mb-2"></div>
                  <div className="h-5 w-3/4 bg-gray-200 rounded mt-1"></div>
                  <div className="h-4 w-2/3 bg-gray-100 rounded mt-2"></div>
                </div>
              ))}
            </div>
          ) : aiRecs && aiRecs.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5 mt-2">
              {aiRecs.map((rec) => (
                <Link
                  to={`/products/${encodeURIComponent(rec.product_id)}`}
                  key={rec.recommendation_id}
                  className="flex flex-col items-center rounded-lg border border-gray-100 bg-white p-4 shadow hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 transition group"
                  tabIndex={0}
                  aria-label={`View product recommended: ${rec.product_id}`}
                >
                  <img
                    src={`https://picsum.photos/seed/${encodeURIComponent(
                      rec.product_id
                    )}/220/220`}
                    alt="Recommended product cover"
                    className="w-32 h-32 rounded-lg object-cover bg-gray-100"
                    loading="lazy"
                  />
                  <span className="text-lg font-semibold text-blue-800 mt-2 truncate">
                    {/* We'll have to fetch actual product name via enrichment in future; here, just product_id */}
                    Product #{rec.product_id.slice(-6)}
                  </span>
                  <span className="text-gray-600 text-[13px] mt-1 italic truncate">{rec.reason}</span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-gray-500 mt-3">{noRecsMessage}</div>
          )}
        </section>

        {/* --- Featured Products Carousel/Grid --- */}
        <section
          className="mb-16"
          aria-label="Featured Products"
        >
          <div className="flex flex-row justify-between items-baseline mb-2">
            <h2 className="text-xl md:text-2xl font-bold text-gray-800">
              Featured Products
            </h2>
            <Link
              to="/products"
              className="text-blue-600 hover:text-blue-800 text-sm font-semibold underline ml-1"
            >
              See all
            </Link>
          </div>
          {featuredProductsLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mt-3">
              {[...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className="rounded-lg bg-gray-100 p-4 animate-pulse"
                  aria-hidden="true"
                >
                  <div className="h-28 w-full bg-gray-300 rounded-lg mb-2"></div>
                  <div className="h-4 w-2/3 bg-gray-200 rounded"></div>
                  <div className="h-3 w-1/2 bg-gray-100 rounded mt-1"></div>
                </div>
              ))}
            </div>
          ) : featuredProducts && featuredProducts.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mt-3">
              {featuredProducts.map((product) => (
                <Link
                  to={`/products/${encodeURIComponent(product.product_id)}`}
                  key={product.product_id}
                  className="group rounded-lg overflow-hidden border border-gray-100 hover:shadow-lg transition bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2"
                  tabIndex={0}
                  aria-label={`View featured product: ${product.name}`}
                >
                  <img
                    src={`https://picsum.photos/seed/featured_${encodeURIComponent(
                      product.product_id
                    )}/220/140`}
                    alt={`Image of ${product.name}`}
                    className="w-full h-36 object-cover bg-gray-100"
                    loading="lazy"
                  />
                  <div className="px-3 py-2 flex flex-col">
                    <span className="font-semibold text-gray-900 text-base truncate">
                      {product.name}
                    </span>
                    <span className="text-blue-700 font-bold text-lg mt-1">
                      ${product.price.toFixed(2)}
                    </span>
                    <div className="flex items-center mt-1 gap-1 text-yellow-500 text-xs" title={`Average rating: ${product.average_rating.toFixed(1)} stars`}>
                      <span aria-label="star" role="img">★</span>
                      <span>{product.average_rating.toFixed(1)}</span>
                      <span className="text-gray-400 ml-2">({product.total_ratings})</span>
                    </div>
                    <span
                      className={`inline-block bg-${product.inventory_count > 0 ? "green" : "red"
                        }-100 text-${product.inventory_count > 0 ? "green" : "red"
                        }-700 text-xs rounded px-2 py-0.5 mt-2 self-start`}
                    >
                      {product.inventory_count > 0
                        ? product.inventory_count <= 5
                          ? `Only ${product.inventory_count} left`
                          : "In Stock"
                        : "Out of Stock"}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-gray-500 mt-3">
              No featured products available right now. Please check back soon!
            </div>
          )}
        </section>

        {/* --- Friendly Empty/Fallback CTA for Guests or Zero Data */}
        {!isLoading && !isAuthenticated && (
          <div className="mt-10 text-center">
            <div className="inline-block bg-blue-50 border border-blue-100 rounded-lg px-7 py-6">
              <h3 className="text-lg font-bold text-blue-700 mb-2">New here?</h3>
              <p className="text-gray-700">
                Register now to get personalized recommendations, save to multiple wishlists, and receive order updates!
              </p>
              <div className="mt-4 flex flex-row justify-center gap-4">
                {heroCtaRegister}
                {heroCtaLogin}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default UV_Landing;