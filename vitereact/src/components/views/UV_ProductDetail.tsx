import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '@/store/main';

// --- Type Imports (from Zod schemas, see provided types) ---
import type { Product, ProductImage, ProductReview, AiRecommendation, Vendor } from '@schema';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

const UV_ProductDetail: React.FC = () => {
  // --- route param ---
  const params = useParams<{ id: string }>();
  const navigate = useNavigate();
  const product_id = params.id?.trim() || '';

  // ===== Global State Selectors (ALWAYS individual) =====
  const currentUser = useAppStore(state => state.authentication_state.current_user);
  const authToken = useAppStore(state => state.authentication_state.auth_token);
  const isAuthenticated = useAppStore(state => state.authentication_state.authentication_status.is_authenticated);
  const cartState = useAppStore(state => state.cart_state);
  const wishlistState = useAppStore(state => state.wishlist_state);
  const setError = useAppStore(state => state.set_error);
  const clearError = useAppStore(state => state.clear_error);

  // For review sort/filter UI
  const [reviewSort, setReviewSort] = useState<'created_at_desc' | 'created_at_asc' | 'rating_desc' | 'rating_asc'>('created_at_desc');
  const [selectedQuantity, setSelectedQuantity] = useState(1);

  // To show modals (image, etc.)
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

  // --- Local state for add2cart/wishlist/review error/loading
  const [localError, setLocalError] = useState<string | null>(null);
  const [addToCartLoading, setAddToCartLoading] = useState(false);
  const [addToWishlistLoading, setAddToWishlistLoading] = useState(false);
  const [reviewFormVisible, setReviewFormVisible] = useState(false);
  const [reviewForm, setReviewForm] = useState<{ rating: number, text: string; image_url: string | null }>({ rating: 0, text: '', image_url: null });
  const [reviewFormLoading, setReviewFormLoading] = useState(false);

  // --- Focus trap for modal
  const lightboxRef = useRef<HTMLDivElement | null>(null);

  // ========== DATA FETCHES (react-query: loading, error, data) ==========

  // Fetch PRODUCT
  const {
    data: productData,
    isLoading: isLoadingProduct,
    error: errorProduct,
  } = useQuery<Product, Error>({
    queryKey: ['product', product_id],
    queryFn: async () => {
      if (!product_id) throw new Error('Product ID required');
      const res = await axios.get(`${API_BASE}/products/${encodeURIComponent(product_id)}`);
      return res.data;
    },
    enabled: !!product_id,
    retry: 0,
  });

  // Fetch PRODUCT IMAGES
  const {
    data: imagesData,
    isLoading: isLoadingImages,
    error: errorImages,
  } = useQuery<{ product_images: ProductImage[] }, Error>({
    queryKey: ['product_images', product_id],
    queryFn: async () => {
      const res = await axios.get(`${API_BASE}/products/${encodeURIComponent(product_id)}/images`);
      return res.data;
    },
    enabled: !!product_id,
    retry: 0,
  });

  // Fetch VENDOR (if applicable)
  const vendor_id = productData?.vendor_id || null;
  const {
    data: vendorData,
    isLoading: isLoadingVendor,
  } = useQuery<Vendor | null, Error>({
    queryKey: ['vendor', vendor_id],
    queryFn: async () => {
      if (!vendor_id) return null;
      const res = await axios.get(`${API_BASE}/vendors/${encodeURIComponent(vendor_id)}`);
      return res.data;
    },
    enabled: !!vendor_id,
    retry: 0,
  });

  // Fetch REVIEWS (visible only)
  const {
    data: reviewsData,
    isLoading: isLoadingReviews,
    error: errorReviews,
    refetch: refetchReviews,
  } = useQuery<{ product_reviews: ProductReview[], total: number }, Error>({
    queryKey: ['product_reviews', product_id, reviewSort],
    queryFn: async () => {
      const sort = reviewSort.includes('created_at')
        ? { sort_by: 'created_at', sort_order: reviewSort.endsWith('desc') ? 'desc' : 'asc' }
        : { sort_by: 'rating', sort_order: reviewSort.endsWith('desc') ? 'desc' : 'asc' };
      const url = `${API_BASE}/products/${encodeURIComponent(product_id)}/reviews?is_hidden=false&sort_by=${sort.sort_by}&sort_order=${sort.sort_order}`;
      const res = await axios.get(url);
      return res.data;
    },
    enabled: !!product_id,
    retry: 0,
  });

  // AI RECOMMENDATIONS
  const {
    data: aiRecsData,
    isLoading: isLoadingRecs,
    error: errorRecs,
  } = useQuery<{ ai_recommendations: AiRecommendation[], total: number }, Error>({
    queryKey: ['ai_recs', product_id, currentUser?.user_id],
    queryFn: async () => {
      let params = `context_type=product_detail&context_product_id=${encodeURIComponent(product_id)}`;
      if (currentUser?.user_id) params += `&user_id=${encodeURIComponent(currentUser.user_id)}`;
      const res = await axios.get(`${API_BASE}/ai/recommendations?${params}`);
      return res.data;
    },
    enabled: !!product_id,
    retry: 0,
  });

  // ========== MEMOS and DERIVED STATE ==========

  // -- images sorted
  const product_images: ProductImage[] = useMemo(() => {
    return imagesData?.product_images?.length
      ? [...imagesData.product_images].sort((a, b) => a.sort_order - b.sort_order)
      : [];
  }, [imagesData]);

  // -- reviews
  const reviews: ProductReview[] = useMemo(() => {
    return reviewsData?.product_reviews || [];
  }, [reviewsData]);

  // -- current user review
  const userReview = useMemo<ProductReview | null>(() => {
    if (!isAuthenticated || !currentUser) return null;
    const rev = reviews.find((r) => r.user_id === currentUser.user_id && !r.is_hidden);
    return rev || null;
  }, [reviews, isAuthenticated, currentUser]);

  // -- average rating (from productData, always up-to-date)
  const averageRating = productData?.average_rating || 0;
  const totalRatings = productData?.total_ratings || 0;

  // -- available wishlists
  const wishlists = wishlistState.wishlists;
  const selected_wishlist_id = wishlistState.selected_wishlist_id || (wishlists[0]?.wishlist_id ?? '');

  // -- inventory status
  const isOutOfStock = productData?.inventory_count === 0 || productData?.status !== 'active';

  // ============ MUTATIONS =============

  const queryClient = useQueryClient();

  // -- Add to Cart Mutation
  const addToCartMutation = useMutation({
    mutationFn: async (payload: {
      cart_id: string,
      product_id: string,
      name: string,
      price: number,
      quantity: number,
      max_quantity: number,
      image_url: string | undefined,
      vendor_name: string | null,
    }) => {
      setAddToCartLoading(true);
      setLocalError(null);
      try {
        await axios.post(`${API_BASE}/cart/items`, payload, {
          headers: { Authorization: `Bearer ${authToken}` },
        });
      } finally {
        setAddToCartLoading(false);
      }
    },
    onSuccess: () => {
      // Cart state is synced by web socket; show UI feedback if desired.
    },
    onError: (e: any) => {
      setLocalError(e?.response?.data?.message || e.message || 'Could not add to cart');
    },
  });

  // -- Add to Wishlist Mutation
  const addToWishlistMutation = useMutation({
    mutationFn: async (payload: { wishlist_id: string, product_id: string }) => {
      setAddToWishlistLoading(true);
      setLocalError(null);
      await axios.post(`${API_BASE}/wishlists/${payload.wishlist_id}/products`, { product_id: payload.product_id }, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
    },
    onSuccess: () => { /* wishlist is updated via websocket */ },
    onError: (e: any) => {
      setLocalError(e?.response?.data?.message || e.message || 'Could not add to wishlist');
    },
    onSettled: () => {
      setAddToWishlistLoading(false);
    }
  });

  // -- Submit (add/edit) Review Mutation
  const reviewMutation = useMutation({
    mutationFn: async (payload: { rating: number; review_text: string; review_image_url: string | null }) => {
      setReviewFormLoading(true);
      setLocalError(null);
      // Always post to POST /products/{product_id}/reviews regardless (add or edit = upsert, per backend)
      await axios.post(`${API_BASE}/products/${product_id}/reviews`, {
        product_id,
        user_id: currentUser?.user_id,
        rating: payload.rating,
        review_text: payload.review_text,
        review_image_url: payload.review_image_url || null,
      }, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
    },
    onSuccess: () => {
      setReviewFormVisible(false);
      setReviewFormLoading(false);
      setReviewForm({ rating: 0, text: '', image_url: null });
      // refetchReviews();  // Not needed, realtime will update
    },
    onError: (e: any) => {
      setLocalError(e?.response?.data?.message || e.message || 'Could not submit review');
      setReviewFormLoading(false);
    }
  });

  // -- Delete Review Mutation
  const deleteReviewMutation = useMutation({
    mutationFn: async (review_id: string) => {
      setLocalError(null);
      await axios.delete(`${API_BASE}/reviews/${review_id}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
    },
    onSuccess: () => {
      // will get realtime update
    },
    onError: (e: any) => {
      setLocalError(e?.response?.data?.message || e.message || 'Could not delete review');
    }
  });

  // ============ EFFECTS & HANDLERS =============

  // On mount, scroll to top and clear local error
  useEffect(() => {
    window.scrollTo(0, 0);
    setLocalError(null);
  }, [product_id]);

  // Error message reset on input change
  useEffect(() => {
    if (localError) setLocalError(null);
    // eslint-disable-next-line
  }, [selectedQuantity, reviewForm.rating, reviewForm.text, reviewForm.image_url]);

  // Keyboard modal close for lightbox
  useEffect(() => {
    if (lightboxIdx !== null) {
      const handler = (e: KeyboardEvent) => {
        if (e.key === 'Escape') setLightboxIdx(null);
      };
      window.addEventListener('keydown', handler);
      return () => window.removeEventListener('keydown', handler);
    }
  }, [lightboxIdx]);

  // ============ HANDLER FNS =============

  const handleAddToCart = () => {
    if (!isAuthenticated || !authToken) {
      navigate('/login');
      return;
    }
    if (!productData) return;
    if (!cartState || !cartState.items || !cartState.items.length) {
      setLocalError('Cart state missing, please try again.');
      return;
    }
    addToCartMutation.mutate({
      cart_id: cartState.items[0]?.cart_id || '', // expects at least one item with cart_id
      product_id: productData.product_id,
      name: productData.name,
      price: productData.price,
      quantity: selectedQuantity,
      max_quantity: productData.inventory_count,
      image_url: product_images[0]?.image_url,
      vendor_name: vendorData?.display_name || null,
    });
  };

  const handleAddToWishlist = () => {
    if (!isAuthenticated || !authToken) {
      navigate('/login');
      return;
    }
    if (!selected_wishlist_id) {
      setLocalError('No wishlist selected.');
      return;
    }
    addToWishlistMutation.mutate({ wishlist_id: selected_wishlist_id, product_id });
  };

  // Share - copy link
  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setLocalError('Product link copied to clipboard!');
      setTimeout(() => setLocalError(null), 2000);
    } catch {
      setLocalError('Failed to copy link!');
    }
  };

  // Review Form open
  const openReviewForm = () => {
    setReviewForm({
      rating: userReview?.rating || 0,
      text: userReview?.review_text || '',
      image_url: userReview?.review_image_url || null,
    });
    setReviewFormVisible(true);
  };

  // Review Form submit
  const handleReviewFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!productData || !currentUser) {
      setLocalError('You must be logged in to review.');
      return;
    }
    if (reviewForm.rating < 1 || reviewForm.rating > 5) {
      setLocalError('Rating must be 1-5 stars.');
      return;
    }
    reviewMutation.mutate({
      rating: reviewForm.rating,
      review_text: reviewForm.text,
      review_image_url: reviewForm.image_url,
    });
  };

  // Delete review
  const handleDeleteReview = async () => {
    if (!userReview) return;
    if (window.confirm('Are you sure you want to delete your review?')) {
      deleteReviewMutation.mutate(userReview.review_id);
    }
  };

  // Review sort change
  const sortOpts = [
    { value: 'created_at_desc', label: 'Newest' },
    { value: 'created_at_asc', label: 'Oldest' },
    { value: 'rating_desc', label: 'Highest Rated' },
    { value: 'rating_asc', label: 'Lowest Rated' },
  ];

  // ================ RENDER MAIN VIEW ================
  // Loading/Error: Product fetch
  if (isLoadingProduct) {
    return (
      <>
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <div className="text-blue-600 mt-4 text-lg font-medium">Loading product...</div>
        </div>
      </>
    );
  }
  if (errorProduct || !productData) {
    return (
      <>
        <div className="max-w-2xl mx-auto text-center py-12">
          <div className="text-2xl font-bold text-red-600 mb-2" aria-live="polite">
            Product not found
          </div>
          <p className="text-gray-700 mb-4">The product you're looking for does not exist or was removed.</p>
          <Link to="/products" className="inline-block px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            Back to Catalog
          </Link>
        </div>
      </>
    );
  }

  return (
    <>
      {/* Error banners for any errors */}
      {(localError || errorImages || errorReviews || errorRecs) && (
        <div className="fixed top-2 inset-x-0 flex justify-center z-40" aria-live="polite">
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-md shadow-lg flex items-center max-w-2xl">
            <span className="mr-3">{localError || errorImages?.message || errorReviews?.message || errorRecs?.message}</span>
            <button
              aria-label="Dismiss error"
              className="ml-4 text-red-500 text-lg hover:text-red-700 focus:outline-none"
              onClick={() => setLocalError(null)}
            >
              &times;
            </button>
          </div>
        </div>
      )}

      {/* ----------- PRODUCT DETAIL ---------- */}
      <div className="max-w-6xl mx-auto mt-8 p-6 bg-white rounded-2xl shadow flex flex-col md:flex-row gap-10">
        {/* IMAGE CAROUSEL OR Fallback */}
        <div className="md:w-1/2 flex flex-col items-center justify-center">
          <div className="relative w-full">
            {/* Carousel main image */}
            {product_images.length > 0 ? (
              <>
                <img
                  src={product_images[lightboxIdx ?? 0]?.image_url}
                  alt={productData.name || "Product image"}
                  className="w-full aspect-square object-contain rounded-lg shadow border cursor-pointer"
                  onClick={() => setLightboxIdx(lightboxIdx !== null ? null : 0)}
                  tabIndex={0}
                  aria-label="Open full-size image"
                />
                {/* Thumbnails */}
                <div className="flex gap-2 mt-5 overflow-x-auto">
                  {product_images.map((img, idx) => (
                    <button
                      key={img.product_image_id}
                      tabIndex={0}
                      onClick={() => setLightboxIdx(idx)}
                      aria-label={`Show image ${idx + 1}`}
                      className={`rounded-md border-2 ${idx === (lightboxIdx ?? 0) ? 'border-blue-600' : 'border-gray-200'} focus:outline-none`}
                    >
                      <img src={img.image_url} alt={`Thumb ${idx + 1}`} className="w-16 h-16 object-cover rounded" />
                    </button>
                  ))}
                </div>
              </>
            ) : (
              // Fallback image
              <img
                src={`https://picsum.photos/seed/fallback${encodeURIComponent(productData.product_id)}/400/400`}
                alt="Fallback product"
                className="w-full aspect-square object-contain rounded-lg shadow border bg-gray-50"
              />
            )}
            {/* Image lightbox modal (focus trap) */}
            {(lightboxIdx !== null && lightboxIdx < product_images.length) && (
              <div
                ref={lightboxRef}
                className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-80"
                tabIndex={-1}
                aria-modal="true"
                aria-label="Product image viewer lightbox"
                onClick={() => setLightboxIdx(null)}
              >
                <div
                  className="relative"
                  onClick={e => e.stopPropagation()}
                  tabIndex={0}
                >
                  <img
                    src={product_images[lightboxIdx].image_url}
                    alt={`Full product image`}
                    className="max-w-[85vw] max-h-[80vh] rounded-md"
                  />
                  {/* Controls */}
                  <button
                    className="absolute top-2 right-2 text-white bg-black bg-opacity-50 rounded-full p-2"
                    aria-label="Close image viewer"
                    onClick={() => setLightboxIdx(null)}
                  >
                    &times;
                  </button>
                  {/* Prev/Next */}
                  {lightboxIdx > 0 && (
                    <button
                      className="absolute top-1/2 left-[-2rem] text-3xl text-white bg-black bg-opacity-50 rounded-full px-3 py-1"
                      onClick={() => setLightboxIdx(lightboxIdx - 1)}
                      aria-label="Previous image"
                    >&#8592;</button>
                  )}
                  {lightboxIdx < product_images.length - 1 && (
                    <button
                      className="absolute top-1/2 right-[-2rem] text-3xl text-white bg-black bg-opacity-50 rounded-full px-3 py-1"
                      onClick={() => setLightboxIdx(lightboxIdx + 1)}
                      aria-label="Next image"
                    >&#8594;</button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
        {/* ----------- PRODUCT INFO ----------- */}
        <div className="md:w-1/2 space-y-6">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900">{productData.name}</h1>
          <div className="flex items-center gap-3 mt-2">
            <span className="text-2xl text-blue-700 font-semibold">${productData.price.toFixed(2)}</span>
            <span className={`ml-3 text-xs px-2.5 py-1 rounded-full font-medium ${isOutOfStock ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-800'}`}>
              {isOutOfStock ? 'Out of stock' : productData.inventory_count <= 5 ? `Only ${productData.inventory_count} left!` : 'In stock'}
            </span>
          </div>
          <div className="mt-2 text-sm text-gray-600 whitespace-pre-line">{productData.description}</div>
          {vendorData && (
            <div className="flex items-center gap-2 mt-2 text-sm text-gray-500">
              <span className="font-medium">Vendor:</span>
              <span>{vendorData.display_name}</span>
            </div>
          )}
          <div className="flex items-center gap-2 mt-2">
            {/* Average rating stars */}
            <div className="flex items-center gap-1" aria-label={`Average rating: ${averageRating.toFixed(1)} out of 5`}>
              {[1, 2, 3, 4, 5].map(star => (
                <svg key={star} className={`w-5 h-5 ${averageRating >= star ? 'text-yellow-400' : 'text-gray-200'}`} fill="currentColor" viewBox="0 0 20 20">
                  <polygon points="9.9,2 12.26,7.74 18.52,8.34 13.68,12.69 15.36,18.82 9.9,15.15 4.44,18.82 6.12,12.69 1.28,8.34 7.54,7.74" />
                </svg>
              ))}
            </div>
            <span className="text-sm text-gray-700 ml-1">({totalRatings})</span>
          </div>

          {/* --- ACTIONS --- */}
          <div className="flex gap-2 mt-6 flex-wrap">
            <div className="flex items-center gap-1">
              <button
                onClick={() => setSelectedQuantity(q => q > 1 ? q - 1 : 1)}
                className="px-2 py-1 border rounded font-bold"
                aria-label="Decrease quantity"
                tabIndex={0}
                disabled={selectedQuantity <= 1}
                type="button"
              >-</button>
              <input
                type="number"
                min={1}
                max={productData.inventory_count}
                value={selectedQuantity}
                onChange={e => setSelectedQuantity(Math.max(1, Math.min(productData.inventory_count, Number(e.target.value) || 1)))}
                className="w-12 px-2 text-center border rounded appearance-none"
                aria-label="Quantity"
              />
              <button
                onClick={() => setSelectedQuantity(q => Math.min(productData.inventory_count, q + 1))}
                className="px-2 py-1 border rounded font-bold"
                aria-label="Increase quantity"
                tabIndex={0}
                disabled={selectedQuantity >= productData.inventory_count || isOutOfStock}
                type="button"
              >+</button>
            </div>
            <button
              onClick={handleAddToCart}
              disabled={addToCartLoading || isOutOfStock}
              className={`flex items-center gap-1 px-6 py-2 rounded-lg font-semibold focus:outline-none focus:ring transition-colors text-white ${isOutOfStock ? 'bg-gray-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
              aria-label="Add to cart"
              type="button"
            >
              {addToCartLoading ? (
                <>
                  <svg className="animate-spin w-5 h-5 mr-1" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                  Adding...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13l-1.34 2.68A1 1 0 007 17h10a1 1 0 00.95-.68L21 9M16 17a2 2 0 11-4 0" /></svg>
                  Add to Cart
                </>
              )}
            </button>
            <button
              onClick={handleAddToWishlist}
              disabled={addToWishlistLoading || !selected_wishlist_id || !isAuthenticated}
              className="flex items-center gap-1 px-4 py-2 rounded-lg text-pink-700 bg-pink-100 font-semibold focus:outline-none focus:ring hover:bg-pink-200"
              aria-label="Add to wishlist"
              type="button"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M3.172 5.172a4 4 0 015.656 0l.172.172.172-.172a4 4 0 115.656 5.656L10 15.414l-6.828-6.828a4 4 0 010-5.656z"></path></svg>
              Wishlist
            </button>
            <button
              onClick={handleShare}
              aria-label="Copy product link"
              tabIndex={0}
              className="flex items-center px-3 py-2 rounded-lg text-gray-600 bg-gray-100 font-semibold hover:bg-gray-200"
              type="button"
            >
              <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15 12h2a3 3 0 013 3v4a3 3 0 01-3 3H7a3 3 0 01-3-3v-4a3 3 0 013-3h2m4-10v10m0 0-4-4m4 4 4-4" /></svg>
              Share
            </button>
            {/* If guest, prompt login for wishlist/reviews */}
            {!isAuthenticated && (
              <Link to="/login" className="text-blue-700 hover:text-blue-900 underline ml-3 text-sm" tabIndex={0}>
                Log in to save to wishlist or write reviews
              </Link>
            )}
          </div>
        </div>
      </div>
      {/* ---- AI RECOMMENDATIONS SECTION ---- */}
      <section className="max-w-6xl mx-auto mt-12">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">You might also like</h2>
        {isLoadingRecs ? (
          <div className="flex items-center gap-2 text-gray-500">
            <div className="animate-spin h-5 w-5 border-b-2 border-blue-600 rounded-full"></div>
            Loading recommendations...
          </div>
        ) : aiRecsData && aiRecsData.ai_recommendations.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {aiRecsData.ai_recommendations.map((rec) => (
              <Link
                key={rec.product_id}
                to={`/products/${rec.product_id}`}
                className="block p-4 bg-white border rounded-xl shadow-md hover:shadow-lg transition-all"
                tabIndex={0}
              >
                <img
                  src={rec.image_url || `https://picsum.photos/seed/rec-${encodeURIComponent(rec.product_id)}/200/200`}
                  alt={rec.name}
                  className="w-full h-40 object-cover rounded mb-3"
                />
                <div className="font-medium text-gray-900 text-lg truncate">{rec.name}</div>
                <div className="text-blue-700 font-semibold">${rec.price.toFixed(2)}</div>
                <div className="text-xs text-gray-400 mt-1">{rec.reason || 'Recommended for you'}</div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-gray-500 text-sm">No recommendations at this time.</div>
        )}
      </section>
      {/* ---- REVIEWS & RATINGS PANEL ---- */}
      <section className="max-w-6xl mx-auto mt-16">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-2 mb-4">
          <h2 className="text-xl font-bold text-gray-800">Reviews</h2>
          <div className="flex gap-4 items-center">
            <label htmlFor="sort" className="text-sm text-gray-700 font-medium mr-2">Sort:</label>
            <select
              id="sort"
              value={reviewSort}
              onChange={e => setReviewSort(e.target.value as typeof reviewSort)}
              className="py-1 px-2 border border-gray-200 rounded-lg text-sm"
            >
              {sortOpts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <button
              onClick={() => isAuthenticated ? openReviewForm() : navigate('/login')}
              className="ml-2 px-4 py-2 rounded-lg font-semibold bg-blue-600 text-white hover:bg-blue-700"
              type="button"
              tabIndex={0}
            >
              {userReview ? 'Edit My Review' : 'Write a Review'}
            </button>
          </div>
        </div>
        {isLoadingReviews ? (
          <div className="flex items-center gap-2 text-gray-500">
            <div className="animate-spin h-5 w-5 border-b-2 border-blue-600 rounded-full"></div>
            Loading reviews...
          </div>
        ) : reviews.length > 0 ? (
          <div className="space-y-8">
            {reviews.map((rv) => (
              <div key={rv.review_id} className="flex flex-col md:flex-row gap-4 items-start border-b pb-6">
                <div className="flex flex-col items-center w-24">
                  <div className="flex gap-1 items-center">
                    {[1, 2, 3, 4, 5].map(star => (
                      <svg key={star} className={`w-4 h-4 ${rv.rating >= star ? 'text-yellow-400' : 'text-gray-200'}`} fill="currentColor" viewBox="0 0 20 20">
                        <polygon points="9.9,2 12.26,7.74 18.52,8.34 13.68,12.69 15.36,18.82 9.9,15.15 4.44,18.82 6.12,12.69 1.28,8.34 7.54,7.74" />
                      </svg>
                    ))}
                  </div>
                  <span className="text-xs text-gray-500 mt-1">{new Date(rv.created_at).toLocaleDateString()}</span>
                  {rv.user_id === currentUser?.user_id && (
                    <span className="text-xs text-blue-700 font-bold mt-1">My review</span>
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-900">{rv.review_text || <span className="italic text-gray-400">No text</span>}</span>
                  </div>
                  {rv.review_image_url && (
                    <img
                      src={rv.review_image_url}
                      alt="Review"
                      className="mt-2 w-32 h-32 object-cover rounded border"
                    />
                  )}
                </div>
                {/* If my review, add edit/delete */}
                {rv.user_id === currentUser?.user_id && (
                  <div className="mt-2 flex flex-col gap-2">
                    <button
                      className="text-sm text-blue-700 underline hover:text-blue-900"
                      onClick={openReviewForm}
                      tabIndex={0}
                      type="button"
                    >Edit</button>
                    <button
                      className="text-sm text-red-600 underline hover:text-red-800"
                      onClick={handleDeleteReview}
                      tabIndex={0}
                      type="button"
                    >Delete</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-sm text-gray-500 py-6">There are no reviews yet. Be the first to review this product!</div>
        )}
        {/* --- Review Form Modal --- */}
        {reviewFormVisible && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <form
              onSubmit={handleReviewFormSubmit}
              className="bg-white rounded-xl shadow-lg p-6 w-full max-w-md relative"
              aria-modal="true"
              aria-labelledby="review-form-title"
            >
              <h3 id="review-form-title" className="text-lg font-bold mb-4">
                {userReview ? 'Edit Your Review' : 'Write a Review'}
              </h3>
              <div className="mb-3 flex items-center gap-2" aria-label="Your rating">
                {[1,2,3,4,5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    tabIndex={0}
                    className={`text-2xl ${reviewForm.rating >= star ? "text-yellow-400" : "text-gray-300"} focus:outline-none`}
                    onClick={() => setReviewForm(f => ({ ...f, rating: star }))}
                    aria-label={`${star} star${star > 1 ? 's' : ''}`}
                  >&#9733;</button>
                ))}
              </div>
              <textarea
                aria-label="Your review"
                placeholder="Write your review here (optional)..."
                className="w-full min-h-[80px] border rounded px-3 py-2 mb-3"
                value={reviewForm.text}
                onChange={e => setReviewForm(f => ({ ...f, text: e.target.value }))}
              />
              <input
                type="url"
                className="w-full border rounded px-3 py-1 mb-3"
                placeholder="(Optional) Image URL"
                value={reviewForm.image_url || ''}
                onChange={e => setReviewForm(f => ({ ...f, image_url: e.target.value ? e.target.value : null }))}
                aria-label="Image URL"
              />
              <div className="flex gap-3 items-center">
                <button
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold disabled:opacity-50"
                  disabled={reviewFormLoading || reviewForm.rating < 1}
                  type="submit"
                >
                  {reviewFormLoading ? 'Submitting...' : 'Submit Review'}
                </button>
                <button
                  type="button"
                  className="px-3 py-2 text-gray-600 rounded hover:bg-gray-100"
                  onClick={() => setReviewFormVisible(false)}
                >Cancel</button>
              </div>
              {localError && (
                <div className="mt-2 text-red-600 text-sm" aria-live="polite">{localError}</div>
              )}
            </form>
          </div>
        )}
      </section>
    </>
  );
};

export default UV_ProductDetail;