import React, { useEffect, useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';
import { useAppStore } from '@/store/main';

// --- Types from Zustand (matches backend, Zod) ---
interface Cart {
  cart_id: string;
  user_id: string | null;
  is_guest: boolean;
  subtotal: number;
  tax: number;
  shipping: number;
  total: number;
  updated_at: string;
  created_at: string;
}

interface CartItem {
  cart_item_id: string;
  cart_id: string;
  product_id: string;
  name: string;
  price: number;
  quantity: number;
  image_url?: string | null;
  max_quantity: number;
  vendor_name?: string | null;
  added_at?: string;
}

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

// --- Cart Modal Component ---
const UV_CartModal: React.FC = () => {
  // --- Zustand selectors (ALWAYS use individual selectors!) ---
  const currentUser = useAppStore(state => state.authentication_state.current_user);
  const authToken = useAppStore(state => state.authentication_state.auth_token);
  const cartState = useAppStore(state => state.cart_state);
  const setCartState = useAppStore(state => state.set_cart_state);
  const globalError = useAppStore(state => state.error_state.error_message);
  const setError = useAppStore(state => state.set_error);
  const clearError = useAppStore(state => state.clear_error);

  // --- Local UI State ---
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [quantityActionId, setQuantityActionId] = useState<string | null>(null);

  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const errorRef = useRef<HTMLDivElement | null>(null);

  // --- Cart identifiers ---
  const cartId = cartState && (cartState as any).cart_id
    ? (cartState as any).cart_id
    : (cartState as any)?.items?.length
      ? (cartState as any).items[0]?.cart_id
      : null;

  // --- Fetch full cart summary (not needed if kept by socket) ---
  const fetchCart = async (): Promise<Cart> => {
    if (!cartId) throw new Error("No cart_id available");
    const { data } = await axios.get(`${API_BASE}/cart`, {
      params: { cart_id: cartId },
      headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
    });
    return data;
  };

  // --- Fetch cart items (for up-to-date in mutation fallback) ---
  const fetchCartItems = async (): Promise<CartItem[]> => {
    if (!cartId) throw new Error("Missing cart_id");
    const { data } = await axios.get(`${API_BASE}/cart/items`, {
      params: { cart_id: cartId },
      headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
    });
    return data.cart_items;
  };

  // --- REFRESH cart summary and items on open or cart.updated (socket sync) ---
  useEffect(() => {
    // On mount, if cart_state is flat/default (not yet hydrated), fetch once as fallback
    if (!cartState?.subtotal && cartId) {
      setLoading(true);
      Promise.all([fetchCart(), fetchCartItems()])
        .then(([cartApi, itemsApi]) => {
          // Cart inserts items as .items, as required by Zustand global format
          setCartState({
            ...cartApi,
            items: itemsApi,
          });
        })
        .catch((err) => {
          setErrorMessage(err?.response?.data?.message || err.message || 'Failed to load cart.');
        })
        .finally(() => setLoading(false));
    }
  }, [cartId, setCartState, cartState?.subtotal]);

  // --- Sync error from global socket events (cart.item_stock_invalid) ---
  useEffect(() => {
    if (globalError) setErrorMessage(globalError);
  }, [globalError]);

  // --- Focus error on update (aria-live) ---
  useEffect(() => {
    if (errorMessage && errorRef.current) {
      errorRef.current.focus();
    }
  }, [errorMessage]);

  // --- Cart items: from store (socket always syncs this) ---
  const cartItems: CartItem[] = Array.isArray(cartState?.items) ? cartState.items : [];

  // --- -- PATCH: Quantity Update ---
  const updateQuantityMutation = useMutation({
    mutationFn: async (payload: { cart_item_id: string, quantity: number, max_quantity: number }) => {
      setQuantityActionId(payload.cart_item_id);
      setLoading(true);
      clearError();
      setErrorMessage(null);
      await axios.patch(`${API_BASE}/cart/items`, payload, {
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
      });
      // Server will sync via WS. Optimistically update local if you want snappier UX:
      // setCartState({ items: cartItems.map(i => i.cart_item_id === payload.cart_item_id ? { ...i, quantity: payload.quantity } : i) });
    },
    onError: (error: any) => {
      setError("Update quantity failed", "cart_update_quantity");
      setErrorMessage(error?.response?.data?.message || error.message || 'Failed to update quantity.');
    },
    onSuccess: () => {
      setQuantityActionId(null);
      // Query invalidation not strictly required (socket event updates store), but do it for completeness
      queryClient.invalidateQueries({ queryKey: ['cart', cartId] });
      queryClient.invalidateQueries({ queryKey: ['cart_items', cartId] });
    },
    onSettled: () => {
      setLoading(false);
      setQuantityActionId(null);
    },
  });

  // --- -- REMOVE: Cart Item ---
  const removeItemMutation = useMutation({
    mutationFn: async (cart_item_id: string) => {
      setRemovingId(cart_item_id);
      setLoading(true);
      clearError();
      setErrorMessage(null);
      await axios.delete(`${API_BASE}/cart/items`, {
        params: { cart_item_id },
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
      });
    },
    onError: (error: any) => {
      setError("Remove item failed", "cart_remove_item");
      setErrorMessage(error?.response?.data?.message || error.message || 'Failed to remove cart item.');
    },
    onSuccess: () => {
      setRemovingId(null);
      queryClient.invalidateQueries({ queryKey: ['cart', cartId] });
      queryClient.invalidateQueries({ queryKey: ['cart_items', cartId] });
    },
    onSettled: () => {
      setLoading(false);
      setRemovingId(null);
    },
  });

  // --- -- CLEAR: Whole Cart ---
  const clearCartMutation = useMutation({
    mutationFn: async () => {
      setLoading(true);
      clearError();
      setErrorMessage(null);
      await axios.delete(`${API_BASE}/cart`, {
        params: { cart_id: cartId },
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
      });
    },
    onError: (error: any) => {
      setError("Clear cart failed", "cart_clear_cart");
      setErrorMessage(error?.response?.data?.message || error.message || 'Failed to clear cart.');
    },
    onSuccess: () => {
      setShowClearDialog(false);
      queryClient.invalidateQueries({ queryKey: ['cart', cartId] });
      queryClient.invalidateQueries({ queryKey: ['cart_items', cartId] });
    },
    onSettled: () => setLoading(false),
  });

  // --- UI handlers ---
  const handleQtyChange = (cart_item_id: string, currQty: number, maxQty: number, dir: number) => {
    if ((dir === -1 && currQty <= 1) || (dir === 1 && currQty >= maxQty)) return;
    updateQuantityMutation.mutate({ cart_item_id, quantity: currQty + dir, max_quantity: maxQty });
  };

  const handleRemove = (cart_item_id: string) => {
    removeItemMutation.mutate(cart_item_id);
  };

  const handleClearCart = () => {
    clearCartMutation.mutate();
  };

  const handleCheckout = () => {
    navigate('/checkout');
  };

  const handleKeepShopping = () => {
    navigate('/products');
  };

  // --- Utility: USD formatter
  const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

  // --- Empty cart visual
  const emptyVisualUrl = 'https://picsum.photos/seed/aiocart_emptycart/300/200';

  // --- Modal (always open per app layout) ---
  return (
    <>
      <div
        className={
          "fixed z-50 top-0 right-0 w-full max-w-md h-full bg-white shadow-lg border-l border-gray-200 flex flex-col transition-transform duration-300 " +
          "md:w-[28rem] " +
          (!cartId ? "translate-x-full pointer-events-none" : "translate-x-0")
        }
        role="dialog"
        aria-modal="true"
        aria-labelledby="cart-modal-title"
        tabIndex={-1}
      >
        <header className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50">
          <h2 id="cart-modal-title" className="text-lg font-bold text-gray-900">
            Your Cart
          </h2>
          <button
            type="button"
            aria-label="Close cart panel"
            className="p-2 rounded hover:bg-gray-100 focus:outline-none"
            onClick={handleKeepShopping}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <title>Close cart</title>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </header>
        <section className="flex-1 overflow-y-auto px-4 py-4">
          {/* Notification (Error) */}
          {(errorMessage || loading) && (
            <div
              ref={errorRef}
              tabIndex={-1}
              aria-live="polite"
              className={`mb-3 rounded p-3 border text-sm ${
                errorMessage
                  ? 'border-red-300 bg-red-50 text-red-800'
                  : 'border-blue-200 bg-blue-50 text-blue-600'
              }`}
            >
              {loading
                ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4 text-blue-500" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>
                    <span>Working...</span>
                  </span>
                )
                : errorMessage}
            </div>
          )}

          {/* EMPTY CART */}
          {cartItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[75%] text-center">
              <img
                src={emptyVisualUrl}
                alt="Empty Cart"
                className="w-40 h-32 object-cover mb-4 rounded shadow"
                draggable={false}
              />
              <h3 className="text-xl font-semibold mb-2">Your cart is empty!</h3>
              <p className="text-gray-500 mb-4">Ready for a new find? Add something from our store.</p>
              <button
                type="button"
                onClick={handleKeepShopping}
                className="inline-flex items-center text-white bg-blue-600 rounded px-4 py-2 font-semibold hover:bg-blue-700 shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                tabIndex={0}
              >
                Continue Shopping
              </button>
            </div>
          ) : (
            <>
              <ul className="divide-y divide-gray-200 -mx-2 mb-6">
                {cartItems.map(item => (
                  <li
                    key={item.cart_item_id}
                    className={`flex items-center py-4 px-2 gap-3 ${removingId === item.cart_item_id ? "opacity-60" : ""}`}
                  >
                    {/* Product image and link */}
                    <Link
                      to={`/products/${item.product_id}`}
                      tabIndex={0}
                      className="shrink-0 w-16 h-16 flex items-center justify-center bg-gray-100 rounded bg-opacity-75 hover:shadow outline-blue-500 outline-2 focus:outline"
                    >
                      <img
                        src={item.image_url || `https://picsum.photos/seed/prod_${item.product_id}/64/64`}
                        alt={item.name}
                        className="w-14 h-14 object-cover rounded"
                        draggable={false}
                        loading="lazy"
                      />
                    </Link>
                    {/* Product details */}
                    <div className="flex-1 min-w-0">
                      <Link to={`/products/${item.product_id}`} className="block text-md font-semibold text-gray-900 hover:text-blue-700 truncate" tabIndex={0}>
                        {item.name}
                      </Link>
                      {item.vendor_name && (
                        <p className="text-xs text-gray-500 mt-0.5">by {item.vendor_name}</p>
                      )}
                      <div className="mt-1 text-sm text-gray-700">{fmt.format(item.price)}</div>
                    </div>
                    {/* Quantity stepper */}
                    <div className="flex flex-col items-end gap-2 ml-3">
                      <div className="flex items-center border rounded-lg overflow-hidden">
                        <button
                          type="button"
                          aria-label="Decrease quantity"
                          tabIndex={0}
                          className="p-2 bg-gray-50 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                          disabled={item.quantity <= 1 || loading || quantityActionId === item.cart_item_id}
                          onClick={() => handleQtyChange(item.cart_item_id, item.quantity, item.max_quantity, -1)}
                        >-</button>
                        <div className="px-3 py-1 min-w-[2ch] text-center text-sm font-medium">{item.quantity}</div>
                        <button
                          type="button"
                          aria-label="Increase quantity"
                          tabIndex={0}
                          className="p-2 bg-gray-50 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                          disabled={item.quantity >= item.max_quantity || loading || quantityActionId === item.cart_item_id}
                          onClick={() => handleQtyChange(item.cart_item_id, item.quantity, item.max_quantity, 1)}
                        >+</button>
                      </div>
                      {item.quantity >= item.max_quantity && (
                        <span className="block text-xs text-yellow-500">Max stock reached</span>
                      )}
                      {/* Remove button */}
                      <button
                        type="button"
                        aria-label="Remove item from cart"
                        tabIndex={0}
                        className="flex items-center gap-1 px-2 py-1 rounded bg-red-50 text-red-600 hover:bg-red-100 text-xs font-semibold transition-colors focus:outline-none disabled:opacity-70"
                        disabled={loading || removingId === item.cart_item_id}
                        onClick={() => handleRemove(item.cart_item_id)}
                      >
                        <svg className="h-4 w-4 mr-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <title>Remove</title>
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        Remove
                      </button>
                    </div>
                  </li>
                ))}
              </ul>

              {/* Cart summary */}
              <div className="sticky bottom-0 bg-white border-t border-gray-100 py-4 px-2 md:px-4 z-20">
                <div className="space-y-1 mb-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Subtotal</span>
                    <span>{fmt.format(cartState.subtotal || 0)}</span>
                  </div>
                  {cartState.tax > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Tax (est.)</span>
                      <span>{fmt.format(cartState.tax)}</span>
                    </div>
                  )}
                  {cartState.shipping > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Shipping (simulated)</span>
                      <span>{fmt.format(cartState.shipping)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-extrabold text-base pt-1">
                    <span>Total</span>
                    <span>{fmt.format(cartState.total || cartState.subtotal || 0)}</span>
                  </div>
                </div>

                <div className="flex mb-1">
                  <button
                    type="button"
                    className="w-full flex justify-center items-center py-2 px-3 rounded bg-blue-600 text-white font-semibold shadow hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors disabled:opacity-60"
                    aria-label="Proceed to checkout"
                    disabled={loading}
                    onClick={handleCheckout}
                  >
                    Proceed to Checkout
                  </button>
                </div>
                <div className="flex justify-between items-center">
                  <button
                    type="button"
                    className="text-sm px-2 py-1 text-gray-500 underline hover:text-blue-700 focus:outline-none"
                    aria-label="Continue shopping"
                    onClick={handleKeepShopping}
                  >
                    &larr; Keep Shopping
                  </button>
                  <button
                    type="button"
                    className="text-sm px-2 py-1 text-red-600 underline hover:text-red-800 focus:outline-none"
                    aria-label="Clear cart"
                    onClick={() => setShowClearDialog(true)}
                  >
                    Clear Cart
                  </button>
                </div>
              </div>
            </>
          )}
        </section>

        {/* Confirm Clear Cart Dialog */}
        {showClearDialog && (
          <div className="absolute inset-0 bg-black/30 flex items-end justify-center z-50" aria-modal="true" role="alertdialog">
            <div className="bg-white rounded-t-lg px-6 py-5 w-full shadow-lg max-w-md animate-slide-up">
              <h3 className="text-lg font-semibold mb-2 text-red-700">Clear your cart?</h3>
              <p className="text-gray-600 mb-4">Are you sure you want to remove all items? This can't be undone.</p>
              <div className="flex gap-3 justify-end">
                <button
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded font-medium hover:bg-gray-200"
                  onClick={() => setShowClearDialog(false)}
                >
                  Cancel
                </button>
                <button
                  className="px-4 py-2 bg-red-600 text-white rounded font-medium hover:bg-red-700 disabled:opacity-60"
                  disabled={loading}
                  onClick={handleClearCart}
                >
                  {loading ? 'Clearing...' : 'Clear Cart'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default UV_CartModal;