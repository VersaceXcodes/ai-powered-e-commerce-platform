import React, { useState, useEffect, useRef } from 'react';
import { useAppStore } from '@/store/main';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

// --- Types (from Zod schemas)
interface Wishlist {
  wishlist_id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
  products?: WishlistProduct[];
}

interface WishlistProduct {
  product_id: string;
  name: string;
  image_url: string;
  price: number;
}



interface CartItemInput {
  cart_id: string;
  product_id: string;
  name: string;
  price: number;
  quantity: number;
  image_url?: string | null;
  max_quantity: number;
  vendor_name?: string | null;
}

// --- API helpers
const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

// Sanitize string input: remove leading/trailing/multi-space
function sanitizeInput(s: string) {
  return s.replace(/\s+/g, ' ').trim();
}

// --- Component Start
const UV_WishlistModal: React.FC = () => {
  // Zustand selectors - always use individual selectors!
  const currentUser = useAppStore(state => state.authentication_state.current_user);
  const authToken = useAppStore(state => state.authentication_state.auth_token);
  const wishlistState = useAppStore(state => state.wishlist_state);
  const setWishlistState = useAppStore(state => state.set_wishlist_state);
  const setSelectedWishlistId = useAppStore(state => state.set_selected_wishlist_id);
  const cartState = useAppStore(state => state.cart_state);
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  // Local state/UI controls
  const [modalMode, setModalMode] = useState<'view' | 'create' | 'rename' | 'delete'>('view');
  const [wishlistTitleInput, setWishlistTitleInput] = useState('');
  const [renameTitleInput, setRenameTitleInput] = useState('');
  const [activeWishlistId, setActiveWishlistId] = useState<string | null>(null);
  const [selectedProductForMove, setSelectedProductForMove] = useState<string | null>(null);
  const [moveTargetWishlistId, setMoveTargetWishlistId] = useState<string | null>(null);
  const [showMoveDialog, setShowMoveDialog] = useState<boolean>(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [removeProductConfirm, setRemoveProductConfirm] = useState<{ pid: string, wid: string } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // For focus management in dialogs
  const inputRef = useRef<HTMLInputElement | null>(null);

  // QueryClient for react-query
  const queryClient = useQueryClient();

  // Convenience: resolve wishlists from global state
  const wishlists: Wishlist[] = Array.isArray(wishlistState.wishlists) ? wishlistState.wishlists : [];
  const selected_wishlist_id: string | null = wishlistState.selected_wishlist_id ?? null;

  // --- Sync active wishlist: on mount/URL param/global update
  useEffect(() => {
    let targetId = searchParams.get('wishlist_id');
    if (targetId && wishlists.some(w => w.wishlist_id === targetId)) {
      setActiveWishlistId(targetId);
      setSelectedWishlistId(targetId);
    } else if ((selected_wishlist_id && wishlists.some(w => w.wishlist_id === selected_wishlist_id))) {
      setActiveWishlistId(selected_wishlist_id);
    } else if (wishlists.length > 0) {
      setActiveWishlistId(wishlists[0].wishlist_id);
      setSelectedWishlistId(wishlists[0].wishlist_id);
    } else {
      setActiveWishlistId(null);
    }
    // eslint-disable-next-line
  }, [searchParams, wishlists, selected_wishlist_id]);

  // --- When activeWishlistId changes, update global selected_wishlist_id and clear errors
  useEffect(() => {
    if (activeWishlistId && activeWishlistId !== selected_wishlist_id) {
      setSelectedWishlistId(activeWishlistId);
      setErrorMessage(null);
    }
    // eslint-disable-next-line
  }, [activeWishlistId]);

  // --- Fetch wishlists (when user changes or on mount)
  useEffect(() => {
    if (!currentUser || !authToken) return;
    // Only re-fetch if not loaded by WebSocket
    queryClient.invalidateQueries({ queryKey: ['wishlists_for_user', currentUser.user_id] });
    // eslint-disable-next-line
  }, [currentUser?.user_id]);

  // React-query: Fetch wishlists (stale but true real-time from WS - so just use for initial load/fallback)
  const {
    isLoading: isWishlistsLoading,
    isError: isWishlistsError,
    error: wishlistsError,
    refetch: refetchWishlists,
  } = useQuery({
    queryKey: ['wishlists_for_user', currentUser?.user_id],
    queryFn: async (): Promise<Wishlist[]> => {
      if (!currentUser || !authToken) return [];
      const res = await axios.get(`${API_BASE}/wishlists`, {
        params: { user_id: currentUser.user_id },
        headers: { Authorization: `Bearer ${authToken}` }
      });
      return res.data.wishlists as Wishlist[];
    },
    enabled: !!currentUser && !!authToken,
    onSuccess: (data) => {
      setWishlistState({ wishlists: data });
      // For global consistency, auto-select first if none
      if (!wishlistState.selected_wishlist_id && data.length > 0)
        setSelectedWishlistId(data[0].wishlist_id);
    },
    onError: (err: any) => {
      setErrorMessage(err?.response?.data?.message || 'Could not load wishlists.');
    },
    staleTime: 3 * 60 * 1000,
    refetchOnWindowFocus: false
  });

  // Helper: get active wishlist and its products (could fallback to GET /wishlists/{wishlist_id}/products if not present)
  const activeWishlist = wishlists.find(w => w.wishlist_id === activeWishlistId) || null;
  const activeProducts: WishlistProduct[] = activeWishlist && Array.isArray(activeWishlist.products)
    ? activeWishlist.products : [];

  // --- CREATE WISHLIST
  const createWishlistMutation = useMutation({
    mutationFn: async (payload: { user_id: string, title: string }) => {
      const res = await axios.post(`${API_BASE}/wishlists`,
        payload,
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
      return res.data as Wishlist;
    },
    onMutate: () => {
      setErrorMessage(null);
    },
    onSuccess: (created) => {
      setWishlistState({ wishlists: [...wishlists, created], selected_wishlist_id: created.wishlist_id });
      setActiveWishlistId(created.wishlist_id);
      setWishlistTitleInput('');
      setModalMode('view');
    },
    onError: (err: any) => {
      setErrorMessage(err?.response?.data?.message || 'Error creating wishlist.');
    }
  });

  // --- RENAME WISHLIST
  const renameWishlistMutation = useMutation({
    mutationFn: async ({ wishlist_id, title }: { wishlist_id: string, title: string }) => {
      const res = await axios.patch(`${API_BASE}/wishlists/${wishlist_id}`,
        { title },
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
      return res.data as Wishlist;
    },
    onSuccess: (data, variables) => {
      setWishlistState({
        wishlists: wishlists.map(wl => wl.wishlist_id === variables.wishlist_id ? { ...wl, title: variables.title } : wl)
      });
      setRenameTitleInput('');
      setModalMode('view');
    },
    onError: (err: any) => {
      setErrorMessage(err?.response?.data?.message || 'Rename failed.');
    }
  });

  // --- DELETE WISHLIST
  const deleteWishlistMutation = useMutation({
    mutationFn: async (wishlist_id: string) => {
      await axios.delete(`${API_BASE}/wishlists/${wishlist_id}`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      return wishlist_id;
    },
    onSuccess: (deleted_wishlist_id) => {
      const nextList = wishlists.filter(wl => wl.wishlist_id !== deleted_wishlist_id);
      setWishlistState({
        wishlists: nextList,
        selected_wishlist_id: nextList[0]?.wishlist_id || null
      });
      setActiveWishlistId(nextList[0]?.wishlist_id || null);
      setDeleteConfirmId(null);
      setModalMode('view');
    },
    onError: (err: any) => {
      setErrorMessage(err?.response?.data?.message || 'Delete failed.');
    }
  });

  // --- REMOVE PRODUCT FROM WISHLIST
  const removeProductMutation = useMutation({
    mutationFn: async (args: { wishlist_id: string, product_id: string }) => {
      await axios.delete(`${API_BASE}/wishlists/${args.wishlist_id}/products/${args.product_id}`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      return args.product_id;
    },
    onSuccess: (removed_pid, args) => {
      // Remove product from global state wishlists
      setWishlistState({
        wishlists: wishlists.map(wl => wl.wishlist_id === args.wishlist_id
          ? { ...wl, products: (wl.products || []).filter(p => p.product_id !== removed_pid) }
          : wl
        )
      });
      setRemoveProductConfirm(null);
    },
    onError: (err: any) => {
      setErrorMessage(err?.response?.data?.message || 'Remove failed.');
    }
  });

  // --- MOVE PRODUCT BETWEEN WISHLISTS
  const moveProductMutation = useMutation({
    mutationFn: async (args: { source_wishlist_id: string, target_wishlist_id: string, product_id: string }) => {
      await axios.post(`${API_BASE}/wishlists/${args.source_wishlist_id}/products/move`,
        args,
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
      return args;
    },
    onSuccess: () => {
      setShowMoveDialog(false);
      setSelectedProductForMove(null);
      setMoveTargetWishlistId(null);
    },
    onError: (err: any) => {
      setErrorMessage(err?.response?.data?.message || 'Move failed.');
    }
  });

  // --- ADD PRODUCT TO CART
  const addToCartMutation = useMutation({
    mutationFn: async (input: CartItemInput) => {
      const res = await axios.post(`${API_BASE}/cart/items`, input, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      return res.data;
    },
    onSuccess: () => {
      // Optionally, show toast "Added to cart!"
    },
    onError: (err: any) => {
      setErrorMessage(err?.response?.data?.message || 'Add to cart failed.');
    }
  });

  // --- Dialog focus management
  useEffect(() => {
    if ((modalMode === 'create' || modalMode === 'rename') && inputRef.current) {
      inputRef.current.focus();
    }
  }, [modalMode]);

  // --- Handler functions ----
  const handleCreateWishlist = (e: React.FormEvent) => {
    e.preventDefault();
    const title = sanitizeInput(wishlistTitleInput);
    if (!title) {
      setErrorMessage('Title cannot be empty.');
      return;
    }
    if (wishlists.some(w => w.title.toLowerCase() === title.toLowerCase())) {
      setErrorMessage('A wishlist with this name already exists.');
      return;
    }
    createWishlistMutation.mutate({ user_id: currentUser!.user_id, title });
  };

  const handleRenameWishlist = (e: React.FormEvent) => {
    e.preventDefault();
    const title = sanitizeInput(renameTitleInput);
    if (!title) {
      setErrorMessage('Title cannot be empty.');
      return;
    }
    if (!activeWishlistId) return;
    if (wishlists.some(w => w.title.toLowerCase() === title.toLowerCase() && w.wishlist_id !== activeWishlistId)) {
      setErrorMessage('A wishlist with this name already exists.');
      return;
    }
    renameWishlistMutation.mutate({ wishlist_id: activeWishlistId, title });
  };

  const handleDeleteWishlist = () => {
    if (deleteConfirmId) {
      deleteWishlistMutation.mutate(deleteConfirmId);
    }
  };

  const handleMoveProduct = (product_id: string) => {
    setSelectedProductForMove(product_id);
    setShowMoveDialog(true);
    setMoveTargetWishlistId(null);
    setErrorMessage(null);
  };

  const handleConfirmMoveProduct = () => {
    if (!selectedProductForMove || !moveTargetWishlistId || !activeWishlistId) return;
    moveProductMutation.mutate({
      source_wishlist_id: activeWishlistId,
      target_wishlist_id: moveTargetWishlistId,
      product_id: selectedProductForMove
    });
  };

  const handleAddToCart = (p: WishlistProduct) => {
    // For demo: assume quantity=1, max_quantity=99, vendor_name unknown
    const cart_id = (cartState as any).cart_id || undefined;
    if (!cart_id) {
      setErrorMessage("No active cart. Please try again later.");
      return;
    }

    addToCartMutation.mutate({
      cart_id,
      product_id: p.product_id,
      name: p.name,
      price: p.price,
      quantity: 1,
      image_url: p.image_url,
      max_quantity: 99,
      vendor_name: null
    });
  };

  // --- RENDER ---
  const isLoading = isWishlistsLoading || createWishlistMutation.isPending || renameWishlistMutation.isPending ||
    deleteWishlistMutation.isPending || removeProductMutation.isPending || addToCartMutation.isPending || moveProductMutation.isPending;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black bg-opacity-30 flex justify-center items-center transition-all duration-150">
        <div className="w-full max-w-3xl bg-white shadow-2xl rounded-lg p-0 md:p-4 relative overflow-auto max-h-[90vh] flex flex-col"
          tabIndex={0}
          aria-modal="true"
          role="dialog"
        >
          <button
            type="button"
            onClick={() => navigate(-1)}
            tabIndex={0}
            aria-label="Close wishlist modal"
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 rounded-full bg-gray-100 border border-gray-200 p-2 focus:outline-none focus:ring-2 focus:ring-blue-600 transition"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" aria-hidden="true" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <div className="flex flex-col md:flex-row h-full">
            {/* Sidebar - Wishlists */}
            <aside className="border-b md:border-b-0 md:border-r border-gray-200 md:pr-4 py-4 md:py-0 min-w-[180px] w-full md:w-[220px] bg-white flex flex-col">
              <div className="flex justify-between items-center px-4 mb-2">
                <span className="text-lg font-semibold text-gray-900">Your Wishlists</span>
                <button
                  type="button"
                  aria-label="Create new wishlist"
                  className="p-1 rounded text-blue-600 hover:bg-blue-100 hover:text-blue-800 transition"
                  onClick={() => { setModalMode('create'); setWishlistTitleInput(''); setErrorMessage(null); }}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"
                    aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v12m6-6H6" />
                  </svg>
                </button>
              </div>
              <nav className="flex flex-col gap-1 px-2 mt-2" aria-label="Wishlist list">
                {wishlists.length === 0 && !isLoading && (
                  <span className="text-sm text-gray-500 p-4 text-center">No wishlists yet.<br />Why not create one?</span>
                )}
                {wishlists.map(wl => (
                  <button
                    key={wl.wishlist_id}
                    className={`flex items-center px-4 py-2 w-full rounded-md transition 
                    ${wl.wishlist_id === activeWishlistId
                        ? 'bg-blue-50 text-blue-800 font-semibold'
                        : 'hover:bg-gray-100 text-gray-800'}`
                    }
                    tabIndex={0}
                    onClick={() => { setActiveWishlistId(wl.wishlist_id); setErrorMessage(null); }}
                    aria-current={wl.wishlist_id === activeWishlistId ? "page" : undefined}
                  >
                    <span className="truncate flex-1 text-left">{wl.title}</span>
                    {wl.wishlist_id === activeWishlistId && (
                      <span className="ml-2 text-blue-500" aria-label="Current wishlist">*</span>
                    )}
                  </button>
                ))}
              </nav>
            </aside>

            {/* Main panel */}
            <div className="flex-1 p-6 flex flex-col relative">
              {/* --- Head and controls --- */}
              <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-bold text-gray-900">
                    {activeWishlist ? activeWishlist.title : 'Wishlist'}
                  </h2>
                  {activeWishlist &&
                    <>
                      <button
                        type="button"
                        aria-label="Rename wishlist"
                        className="p-1 rounded text-gray-500 hover:bg-gray-100 hover:text-blue-600 transition"
                        onClick={() => { setRenameTitleInput(activeWishlist.title); setModalMode('rename'); setErrorMessage(null); }}
                        tabIndex={0}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536M4 20h7" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7.5 7.5l9 9M19.5 4.5a2.121 2.121 0 113 3L12 18l-4 1 1-4 10.5-10.5z" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        aria-label="Delete wishlist"
                        className="p-1 rounded text-gray-400 hover:bg-red-50 hover:text-red-600 transition"
                        onClick={() => { setDeleteConfirmId(activeWishlist.wishlist_id); setModalMode('delete'); setErrorMessage(null); }}
                        tabIndex={0}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </>
                  }
                </div>
                {activeWishlist &&
                  <span className="text-gray-500 text-xs ml-3 select-none">
                    {Array.isArray(activeWishlist.products) ? activeWishlist.products.length : 0} item{Array.isArray(activeWishlist.products) && activeWishlist.products.length === 1 ? '' : 's'}
                  </span>
                }
              </div>

              {/* --- Error bar --- */}
              {errorMessage && (
                <div className="mb-4 bg-red-50 text-red-700 px-4 py-2 rounded-md border border-red-200" aria-live="polite">{errorMessage}</div>
              )}
              {/* --- loading spinner --- */}
              {isLoading && (
                <div className="flex justify-center items-center py-10" aria-live="polite">
                  <svg className="animate-spin h-8 w-8 text-blue-500" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-30" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={4}></circle>
                    <path className="opacity-70" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.464 0 0 5.373 0 12h4z"></path>
                  </svg>
                  <span className="ml-2 text-blue-600 text-sm font-semibold">Loading...</span>
                </div>
              )}

              {/* --- Main content: wishlist products --- */}
              {(!isLoading && activeWishlist && Array.isArray(activeProducts) && activeProducts.length > 0) ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
                  {activeProducts.map((p) => (
                    <div
                      key={p.product_id}
                      className="border border-gray-100 rounded-lg bg-white shadow hover:shadow-lg p-3 transition flex flex-col items-center relative"
                    >
                      <Link to={`/products/${p.product_id}`} className="w-full flex-grow" tabIndex={0}>
                        <img
                          src={p.image_url || `https://picsum.photos/seed/${p.product_id}/240/240`}
                          alt={p.name}
                          className="rounded-md w-full h-36 object-cover mb-2"
                          loading="lazy"
                          width={240}
                          height={144}
                        />
                        <h3 className="font-bold text-gray-800 text-base truncate mb-1">{p.name}</h3>
                        <div className="text-blue-700 font-semibold text-lg mb-1">${p.price.toFixed(2)}</div>
                      </Link>
                      <div className="flex gap-2 mt-2">
                        <button
                          type="button"
                          aria-label="Add to cart"
                          onClick={() => handleAddToCart(p)}
                          className="bg-blue-600 hover:bg-blue-700 text-white rounded px-3 py-1 text-xs font-semibold"
                          tabIndex={0}
                          disabled={addToCartMutation.isPending}
                        >
                          Add to Cart
                        </button>
                        <button
                          type="button"
                          aria-label="Remove from wishlist"
                          onClick={() => setRemoveProductConfirm({ pid: p.product_id, wid: activeWishlist.wishlist_id })}
                          className="text-gray-400 hover:text-red-600 bg-gray-100 hover:bg-red-50 rounded p-1"
                          tabIndex={0}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          aria-label="Move to another wishlist"
                          onClick={() => handleMoveProduct(p.product_id)}
                          className="text-gray-400 hover:text-blue-400 bg-gray-50 hover:bg-blue-50 rounded p-1"
                          tabIndex={0}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" aria-hidden="true" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8v8c0 1.105.895 2 2 2h8c1.105 0 2-.895 2-2V8m-8 4h8m-8 4h4" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : ((!isLoading && activeWishlist) &&
                <div className="flex flex-col items-center justify-center h-64 w-full">
                  <svg className="w-20 h-20 text-gray-200 mx-auto mb-6" fill="none" viewBox="0 0 48 48">
                    <path d="M34 12a6 6 0 00-6-6H20a6 6 0 00-6 6c0 6.63 9.62 16.67 10.06 17.09a1 1 0 001.44 0C24.38 28.67 34 18.63 34 12z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
                    <circle cx="24" cy="12" r="3" fill="currentColor" />
                  </svg>
                  <span className="text-gray-500 text-center text-lg">Your wishlist is empty.<br />Start adding your favorite products!</span>
                </div>
              )}

              {/* --- CREATE WISHLIST Dialog --- */}
              {modalMode === 'create' && (
                <div className="fixed top-0 left-0 right-0 bottom-0 z-50 bg-black bg-opacity-40 flex items-center justify-center">
                  <form onSubmit={handleCreateWishlist} className="bg-white rounded-lg p-6 shadow-md flex flex-col w-[90vw] max-w-sm relative" aria-modal="true" role="dialog">
                    <button
                      type="button"
                      className="absolute top-2 right-2 text-gray-400 hover:text-gray-700 rounded-full p-1"
                      aria-label="Close create dialog"
                      onClick={() => { setModalMode('view'); setWishlistTitleInput(''); setErrorMessage(null); }}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                    <label htmlFor="wishlist-title" className="text-lg font-semibold mb-2">New Wishlist Name</label>
                    <input
                      ref={inputRef}
                      id="wishlist-title"
                      type="text"
                      required
                      minLength={2}
                      maxLength={100}
                      value={wishlistTitleInput}
                      onChange={e => { setWishlistTitleInput(e.target.value); setErrorMessage(null); }}
                      className="border p-2 rounded-md mb-4"
                      aria-label="Wishlist name"
                    />
                    {errorMessage &&
                      <span className="mb-2 text-red-600 text-sm" aria-live="polite">{errorMessage}</span>
                    }
                    <button
                      type="submit"
                      disabled={createWishlistMutation.isPending}
                      className="bg-blue-600 hover:bg-blue-700 text-white rounded px-4 py-2 font-semibold"
                    >
                      {createWishlistMutation.isPending ? "Creating..." : "Create"}
                    </button>
                  </form>
                </div>
              )}

              {/* --- RENAME Dialog --- */}
              {modalMode === 'rename' && (
                <div className="fixed inset-0 z-50 bg-black bg-opacity-40 flex items-center justify-center">
                  <form onSubmit={handleRenameWishlist} className="bg-white rounded-lg p-6 shadow-md flex flex-col w-[90vw] max-w-sm relative" aria-modal="true" role="dialog">
                    <button
                      type="button"
                      className="absolute top-2 right-2 text-gray-400 hover:text-gray-700 rounded-full p-1"
                      aria-label="Close rename dialog"
                      onClick={() => { setModalMode('view'); setRenameTitleInput(''); setErrorMessage(null); }}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                    <label htmlFor="rename-title" className="text-lg font-semibold mb-2">Rename Wishlist</label>
                    <input
                      ref={inputRef}
                      id="rename-title"
                      type="text"
                      required
                      minLength={2}
                      maxLength={100}
                      value={renameTitleInput}
                      onChange={e => { setRenameTitleInput(e.target.value); setErrorMessage(null); }}
                      className="border p-2 rounded-md mb-4"
                      aria-label="New wishlist name"
                    />
                    {errorMessage &&
                      <span className="mb-2 text-red-600 text-sm" aria-live="polite">{errorMessage}</span>
                    }
                    <button
                      type="submit"
                      disabled={renameWishlistMutation.isPending}
                      className="bg-blue-600 hover:bg-blue-700 text-white rounded px-4 py-2 font-semibold"
                    >
                      {renameWishlistMutation.isPending ? "Renaming..." : "Save"}
                    </button>
                  </form>
                </div>
              )}

              {/* --- DELETE DIALOG --- */}
              {modalMode === 'delete' && deleteConfirmId === activeWishlistId && (
                <div className="fixed inset-0 z-50 bg-black bg-opacity-40 flex items-center justify-center">
                  <div className="bg-white rounded-lg p-6 shadow-md w-[90vw] max-w-sm flex flex-col items-center">
                    <span className="text-xl font-semibold mb-4 text-red-700">Delete this wishlist?</span>
                    <span className="mb-6 text-gray-700 text-center">This will remove your wishlist and all its products (products are NOT deleted from the store).</span>
                    {errorMessage &&
                      <span className="mb-2 text-red-600 text-sm" aria-live="polite">{errorMessage}</span>
                    }
                    <div className="flex gap-3">
                      <button
                        onClick={() => setModalMode('view')}
                        className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded font-semibold"
                      >Cancel</button>
                      <button
                        onClick={handleDeleteWishlist}
                        className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded font-semibold"
                      >Delete</button>
                    </div>
                  </div>
                </div>
              )}

              {/* --- REMOVE PRODUCT CONFIRM DIALOG --- */}
              {removeProductConfirm && (
                <div className="fixed inset-0 z-50 bg-black bg-opacity-40 flex items-center justify-center">
                  <div className="bg-white rounded-lg p-6 shadow-md w-[90vw] max-w-xs flex flex-col items-center">
                    <span className="text-base font-medium mb-4 text-gray-700">Remove this product from wishlist?</span>
                    {errorMessage &&
                      <span className="mb-2 text-red-600 text-sm" aria-live="polite">{errorMessage}</span>
                    }
                    <div className="flex gap-3">
                      <button
                        onClick={() => setRemoveProductConfirm(null)}
                        className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-3 py-1 rounded font-semibold"
                      >Cancel</button>
                      <button
                        onClick={() => {
                          if (removeProductConfirm)
                            removeProductMutation.mutate({
                              wishlist_id: removeProductConfirm.wid,
                              product_id: removeProductConfirm.pid
                            });
                        }}
                        className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded font-semibold"
                      >Remove</button>
                    </div>
                  </div>
                </div>
              )}

              {/* --- MOVE PRODUCT MODAL --- */}
              {showMoveDialog && (
                <div className="fixed inset-0 z-50 bg-black bg-opacity-40 flex items-center justify-center">
                  <div className="bg-white rounded-lg p-6 shadow-md w-[90vw] max-w-xs flex flex-col items-center">
                    <span className="text-base font-medium mb-4 text-gray-700">Move product to:</span>
                    <select
                      value={moveTargetWishlistId ?? ''}
                      onChange={e => setMoveTargetWishlistId(e.target.value)}
                      className="border p-2 rounded-md w-full mb-4"
                      aria-label="Select target wishlist"
                    >
                      <option value="" disabled>Select wishlist...</option>
                      {wishlists.filter(wl => wl.wishlist_id !== activeWishlistId).map(wl => (
                        <option key={wl.wishlist_id} value={wl.wishlist_id}>{wl.title}</option>
                      ))}
                    </select>
                    {errorMessage &&
                      <span className="mb-2 text-red-600 text-sm" aria-live="polite">{errorMessage}</span>
                    }
                    <div className="flex gap-3">
                      <button
                        onClick={() => { setShowMoveDialog(false); setSelectedProductForMove(null); }}
                        className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-3 py-1 rounded font-semibold"
                      >Cancel</button>
                      <button
                        disabled={!moveTargetWishlistId}
                        onClick={handleConfirmMoveProduct}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded font-semibold disabled:opacity-40"
                      >Move</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default UV_WishlistModal;