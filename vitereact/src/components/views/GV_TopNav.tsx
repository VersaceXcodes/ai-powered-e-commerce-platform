import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { useAppStore } from '@/store/main';
import { SearchSuggestion } from '@schema';



const API_BASE = `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}`;

// --- Query: Search Suggestions ---
const fetchSearchSuggestions = async ({ queryKey }: { queryKey: readonly unknown[] }) => {
  const [_key, searchQuery, token] = queryKey as readonly [string, string, string | undefined];
  if (!searchQuery || searchQuery.trim() === '') return [];
  const resp = await axios.get(
    `${API_BASE}/search_terms`,
    {
      params: { query: searchQuery, limit: 8 },
      headers: token
        ? { Authorization: `Bearer ${token}` }
        : undefined,
    }
  );
  // The backend returns: { search_terms: [ { search_term_id, ... } ] }
  // Our type: SearchSuggestion[] (map: query, product_id (may be null!), use fallback image/price if missing)
  if (
    Array.isArray(resp.data?.search_terms) &&
    resp.data.search_terms.length > 0
  ) {
    return resp.data.search_terms.map((term: any) => ({
      // search_term_id and query are always present, product_id may be present.
      product_id: term.product_id || '', // Can be empty string if search term has no associated product
      name: term.query || '',
      image_url: term.image_url || `https://picsum.photos/seed/s-${encodeURIComponent(term.query || '')}/60/60`,
      price: typeof term.price === 'number' ? term.price : 0,
    })) as SearchSuggestion[];
  } else {
    return [];
  }
};

// Main TopNav Component
const GV_TopNav: React.FC = () => {
  // -- Zustand: Only individual selectors!
  const current_user = useAppStore(state => state.authentication_state.current_user);
  const is_authenticated = useAppStore(state => state.authentication_state.authentication_status.is_authenticated);

  const auth_token = useAppStore(state => state.authentication_state.auth_token);

  const cart_items = useAppStore(state => state.cart_state.items);
  const wishlists = useAppStore(state => state.wishlist_state.wishlists);
  const unread_notification_count = useAppStore(state => state.notification_state.unread_count);
  const global_search_query = useAppStore(state => state.search_state.query);
  const search_suggestions_store = useAppStore(state => state.search_state.suggestions);
  const set_search_state = useAppStore(state => state.set_search_state);
  const logout_user = useAppStore(state => state.logout_user);

  // Modals/overlays - open trigger logic is up to global state, here we just call events


  // --- Local State ---
  const [search_input, setSearchInput] = useState(global_search_query || '');
  const [searchHasFocus, setSearchHasFocus] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeSuggestionIdx, setActiveSuggestionIdx] = useState<number>(-1);

  // --- Navigation ---
  const navigate = useNavigate();


  // --- Compute badge counts ---
  const cart_items_count = cart_items ? cart_items.reduce((acc, item) => acc + (item.quantity || 0), 0) : 0;
  const wishlist_products_count = wishlists
    ? wishlists.reduce((total, wl) => total + (Array.isArray(wl.products) ? wl.products.length : 0), 0)
    : 0;

  // --- Search suggestions: Use React Query ---
  const {
    data: searchSuggestions,
    isLoading: isLoadingSuggestions,
    refetch: fetchSuggestions,
  } = useQuery<SearchSuggestion[], Error>({
    queryKey: ['search_suggestions', search_input, auth_token],
    queryFn: fetchSearchSuggestions,
    enabled: !!search_input && searchHasFocus,
    refetchOnWindowFocus: false,
    retry: 0
  });

  // --- Whenever search input changes, update state and fetch debounced suggestions ---
  const lastSearchReq = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    if (!searchHasFocus) {
      setDropdownOpen(false);
      return;
    }
    if (!search_input || search_input.trim() === "") {
      setDropdownOpen(false);
      set_search_state({ suggestions: [] });
      setActiveSuggestionIdx(-1);
      return;
    }
    // Debounce 200ms
    if (lastSearchReq.current) clearTimeout(lastSearchReq.current);
    lastSearchReq.current = setTimeout(() => {
      fetchSuggestions().then((res: any) => {
        set_search_state({ suggestions: res.data || res }); // Some versions of react-query return data here
        setDropdownOpen(true);
      }).catch(() => {
        set_search_state({ suggestions: [] });
        setDropdownOpen(true);
      });
    }, 200);
    // Cleanup
    return () => {
      if (lastSearchReq.current) clearTimeout(lastSearchReq.current);
    };
    // eslint-disable-next-line
  }, [search_input, searchHasFocus]);

  // Update store search query value as well for global state
  useEffect(() => {
    set_search_state({ query: search_input });
    // eslint-disable-next-line
  }, [search_input]);

  // Update dropdownOn on focus/blur
  useEffect(() => {
    const suggestions = searchSuggestions as SearchSuggestion[] | undefined;
    if (dropdownOpen && !(suggestions?.length || search_suggestions_store.length)) {
      setDropdownOpen(false);
    }
    // eslint-disable-next-line
  }, [searchSuggestions, search_suggestions_store, dropdownOpen]);

  // --- Handle search submit ---
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!search_input || search_input.trim() === "") return;
    // Reset dropdown, blur input, clear keyboard combo
    setDropdownOpen(false);
    setActiveSuggestionIdx(-1);

    // Navigate to product list page with ?query=
    navigate(`/products?query=${encodeURIComponent(search_input.trim())}`);
  };

  // --- Handle select suggestion (by click or enter) ---
  const handleSuggestionSelect = (idx: number) => {
    setDropdownOpen(false);
    setActiveSuggestionIdx(-1);
    setSearchInput("");
    set_search_state({ query: "", suggestions: [] });
    const suggestion =
      (searchSuggestions && searchSuggestions[idx]) ||
      (search_suggestions_store && search_suggestions_store[idx]);
    if (!suggestion) return;
    if (suggestion.product_id) {
      navigate(`/products/${suggestion.product_id}`);
    } else if (suggestion.name) {
      navigate(`/products?query=${encodeURIComponent(suggestion.name)}`);
    }
  };

  // --- Search bar keyboard navigation ---
  const handleSearchInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const searchSuggestionsArray = Array.isArray(searchSuggestions) ? searchSuggestions : [];
    const storeArray = Array.isArray(search_suggestions_store) ? search_suggestions_store : [];
    
    if (!dropdownOpen && (searchSuggestionsArray.length || storeArray.length)) {
      setDropdownOpen(true);
    }
    const suggestions =
      searchSuggestionsArray.length > 0
        ? searchSuggestionsArray
        : storeArray;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActiveSuggestionIdx(idx => {
          if (!suggestions) return 0;
          return suggestions.length === 0
            ? 0
            : (idx + 1) % suggestions.length;
        });
        break;
      case "ArrowUp":
        e.preventDefault();
        setActiveSuggestionIdx(idx => {
          if (!suggestions) return 0;
          return suggestions.length === 0
            ? 0
            : (idx - 1 + suggestions.length) % suggestions.length;
        });
        break;
      case "Enter":
        if (activeSuggestionIdx >= 0 && suggestions && suggestions.length > 0) {
          e.preventDefault();
          handleSuggestionSelect(activeSuggestionIdx);
        } else {
          // Call submit
          handleSearchSubmit(e);
        }
        break;
      case "Escape":
        setDropdownOpen(false);
        setActiveSuggestionIdx(-1);
        break;
      default:
        break;
    }
  };

  // --- Profile menu close on outside click ---
  const profileMenuRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!profileMenuOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (
        profileMenuRef.current &&
        !profileMenuRef.current.contains(e.target as Node)
      ) {
        setProfileMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [profileMenuOpen]);

  // --- Hamburger mobile menu close on outside click ---
  const mobileMenuRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (
        mobileMenuRef.current &&
        !mobileMenuRef.current.contains(e.target as Node)
      ) {
        setMobileMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [mobileMenuOpen]);

  // --- Cart Modal and Wishlist Modal triggers ---
  // Per app structure, just navigating to /cart or /wishlists shows modals. So use navigate().
  const openCartModal = useCallback(() => {
    navigate('/cart'); // Shows UV_CartModal via router in main layout
  }, [navigate]);
  const openWishlistModal = useCallback(() => {
    if (is_authenticated) {
      navigate('/wishlists');
    } else {
      navigate('/login');
    }
  }, [navigate, is_authenticated]);
  const openNotificationCenter = useCallback(() => {
    // Notification center is a global overlay, but just navigating (or using state) will do
    // We rely on global overlay being present in app layout, usually controlled by normalized state.
    // For demo, navigate to /notifications if needed.
    navigate('/admin/notifications');
  }, [navigate]);

  // --- Handle logout ---
  const handleLogout = async () => {
    await logout_user();
    navigate('/login', { replace: true });
  };

  // --- Keyboard accessibility for search suggestions (reset idx if input changes) ---
  useEffect(() => {
    setActiveSuggestionIdx(-1);
  }, [search_input]);

  // --- Logo href: home vs. dashboard for admin/vendor ---
  let logoHref = '/';
  if (current_user && current_user.role === 'admin') logoHref = '/admin';
  if (current_user && current_user.role === 'vendor') logoHref = '/vendor';

  // --- Avatar fallback ---
  const avatar =
    current_user && current_user.profile_image_url
      ? current_user.profile_image_url
      : `https://ui-avatars.com/api/?name=${encodeURIComponent(
          current_user?.name || 'User'
        )}&background=0D8ABC&color=fff`;



  // --- Admin links (sidebar/drawer OR top if desktop) ---
  const adminLinks = [
    { label: "Dashboard", href: "/admin" },
    { label: "Products", href: "/admin/products" },
    { label: "Orders", href: "/admin/orders" },
    { label: "Users", href: "/admin/users" },
    { label: "Categories", href: "/admin/categories" },
    { label: "Analytics", href: "/admin/analytics" },
    { label: "Reviews", href: "/admin/reviews" },
    { label: "Notifications", href: "/admin/notifications" },
  ];

  // --- Vendor links (if vendor) ---
  const vendorLinks = [
    { label: "Dashboard", href: "/vendor" },
    { label: "Products", href: "/vendor/products" },
    { label: "Orders", href: "/vendor/orders" },
  ];

  // --- Main Render ---
  return (
    <>
      <nav className="w-full bg-white shadow sticky top-0 z-40" role="navigation" aria-label="Global">
        {/* ================== NAV WRAPPER ================= */}
        <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8">
          <div className="flex justify-between h-16">
            {/* --- Left: Logo + mobile hamburger --- */}
            <div className="flex items-center">
              {/* Mobile hamburger */}
              <button
                type="button"
                className="inline-flex items-center justify-center sm:hidden p-2 rounded-md text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-600"
                aria-label="Open main menu"
                aria-controls="mobile-menu"
                aria-expanded={mobileMenuOpen}
                onClick={() => setMobileMenuOpen(m => !m)}
                tabIndex={0}
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d={mobileMenuOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} />
                </svg>
              </button>
              {/* Logo */}
              <Link
                to={logoHref}
                className="flex items-center space-x-2 ml-2 sm:ml-0"
                tabIndex={0}
                aria-label="Home"
              >
                <img src="https://picsum.photos/seed/aiocart-logo/36/36" alt="AIOCart" className="h-9 w-9 rounded-full shadow" />
                <span className="text-lg font-semibold text-blue-700 hidden sm:inline">
                  AIOCart
                </span>
              </Link>
            </div>

            {/* --- Center: Search --- */}
            <div className="flex-1 flex items-center justify-center px-2">
              <form
                className="w-full max-w-lg relative"
                autoComplete="off"
                role="search"
                onSubmit={handleSearchSubmit}
                onFocus={() => setSearchHasFocus(true)}
                onBlur={() => setTimeout(() => setSearchHasFocus(false), 120)}
              >
                <input
                  type="text"
                  className="block w-full rounded-lg border border-gray-200 py-2 pl-4 pr-10 bg-gray-50 text-base text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Search products, categories, or brands"
                  aria-label="Search products"
                  value={search_input}
                  onChange={e => {
                    setSearchInput(e.target.value);
                    setDropdownOpen(true);
                  }}
                  onKeyDown={handleSearchInputKeyDown}
                  aria-autocomplete="list"
                  aria-controls="search-autocomplete-list"
                  aria-activedescendant={
                    activeSuggestionIdx >= 0
                      ? `search-suggestion-${activeSuggestionIdx}`
                      : undefined
                  }
                  autoCorrect="off"
                  autoCapitalize="none"
                  tabIndex={0}
                />
                {searchHasFocus && search_input && dropdownOpen && (
                  <div
                    className="absolute z-30 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-64 overflow-y-auto"
                    role="listbox"
                    id="search-autocomplete-list"
                  >
                    {isLoadingSuggestions && (
                      <div className="p-4 text-gray-500 flex items-center">
                        <svg className="animate-spin mr-2 h-4 w-4 text-blue-400" viewBox="0 0 24 24" fill="none">
                          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.37 0 0 5.37 0 12h4zm2 5.29A7.96 7.96 0 014 12H0c0 3.04 1.14 5.82 3 7.94l3-2.65z" />
                        </svg>
                        Loading...
                      </div>
                    )}
                    {!isLoadingSuggestions && Array.isArray(searchSuggestions) && searchSuggestions.length === 0 && (
                      <div className="p-4 text-gray-400">No suggestions found.</div>
                    )}
                    {!isLoadingSuggestions &&
                      Array.isArray(searchSuggestions) &&
                      searchSuggestions.length > 0 &&
                      searchSuggestions.map((s, idx) => (
                        <button
                          key={s.product_id + "-" + idx}
                          id={`search-suggestion-${idx}`}
                          className={`flex items-center w-full text-left p-2 hover:bg-blue-50 transition ${
                            activeSuggestionIdx === idx ? 'bg-blue-100' : ''
                          }`}
                          type="button"
                          tabIndex={0}
                          aria-selected={activeSuggestionIdx === idx}
                          onMouseDown={() => handleSuggestionSelect(idx)}
                          onMouseEnter={() => setActiveSuggestionIdx(idx)}
                        >
                          <img
                            src={s.image_url || `https://picsum.photos/seed/search-${idx}/36/36`}
                            alt=""
                            className="w-8 h-8 rounded object-cover mr-3"
                          />
                          <div>
                            <span className="block text-sm font-medium text-gray-800">{s.name}</span>
                            <span className="block text-xs text-gray-500">${s.price ? s.price.toFixed(2) : "—"}</span>
                          </div>
                        </button>
                      ))}
                  </div>
                )}
              </form>
            </div>

            {/* --- Right: Icons & Menus --- */}
            <div className="flex items-center space-x-2">
              {/* Cart button */}
              <button
                className="relative p-2 rounded-full text-gray-700 hover:bg-gray-100 transition focus:outline-none"
                aria-label={`Cart (${cart_items_count || 0} items)`}
                onClick={openCartModal}
                tabIndex={0}
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path d="M3 3h2l.4 2M7 13h10l4-8H5.4" strokeLinecap="round" strokeLinejoin="round"/>
                  <circle cx="9" cy="19" r="2"/>
                  <circle cx="17" cy="19" r="2"/>
                </svg>
                {cart_items_count > 0 && (
                  <span className="absolute top-1 right-1 inline-flex items-center justify-center px-1.5 py-0.5 rounded-full text-xs font-semibold bg-blue-600 text-white">
                    {cart_items_count}
                  </span>
                )}
              </button>

              {/* Wishlist button */}
              <button
                className="relative p-2 rounded-full text-gray-700 hover:bg-gray-100 transition focus:outline-none"
                aria-label={`Wishlist (${wishlist_products_count || 0} items)`}
                onClick={openWishlistModal}
                tabIndex={0}
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path d="M4.318 6.318a4.5 4.5 0 010 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                {wishlist_products_count > 0 && (
                  <span className="absolute top-1 right-1 inline-flex items-center justify-center px-1.5 py-0.5 rounded-full text-xs font-semibold bg-pink-500 text-white">
                    {wishlist_products_count}
                  </span>
                )}
              </button>

              {/* Notification bell (not on /404 etc) */}
              <button
                className="relative p-2 rounded-full text-gray-700 hover:bg-gray-100 transition focus:outline-none"
                aria-label={`Notifications (${unread_notification_count || 0} unread)`}
                aria-haspopup="true"
                onClick={openNotificationCenter}
                tabIndex={0}
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path d="M15 17h5l-1.405-1.405C18.21 15.137 18 14.702 18 14.25V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.25c0 .452-.21.887-.595 1.345L4 17h5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                {unread_notification_count > 0 && (
                  <span className="absolute top-1 right-1 inline-flex items-center justify-center px-1.5 py-0.5 rounded-full text-xs font-semibold bg-yellow-500 text-white">
                    {unread_notification_count}
                  </span>
                )}
              </button>

              {/* Profile menu or Auth links */}
              {is_authenticated ? (
                <div className="relative" ref={profileMenuRef}>
                  <button
                    className="flex items-center space-x-2 p-1 rounded-full border border-transparent hover:bg-gray-100 focus:outline-none"
                    onClick={() => setProfileMenuOpen(open => !open)}
                    aria-haspopup="true"
                    aria-expanded={profileMenuOpen}
                    aria-controls="profile-menu"
                    tabIndex={0}
                  >
                    <img
                      src={avatar}
                      alt={current_user?.name || "Account"}
                      className="h-9 w-9 rounded-full object-cover border border-gray-300 shadow"
                    />
                    <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                  {/* Profile Dropdown */}
                  {profileMenuOpen && (
                    <div
                      className="absolute right-0 z-20 mt-2 w-56 bg-white rounded-md shadow-lg border border-gray-100 py-1"
                      id="profile-menu"
                      role="menu"
                      aria-label="User menu"
                    >
                      <div className="flex items-center px-4 py-3 border-b border-gray-200">
                        <img
                          src={avatar}
                          alt={current_user?.name || "Account"}
                          className="h-10 w-10 rounded-full border border-gray-300"
                        />
                        <div className="ml-3">
                          <div className="text-sm font-semibold text-gray-900">{current_user?.name}</div>
                          <div className="text-xs text-gray-500 truncate">{current_user?.email}</div>
                          <div className="text-xs text-gray-400">{current_user?.role}</div>
                        </div>
                      </div>
                      <Link
                        to="/profile"
                        className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 transition"
                        role="menuitem"
                        tabIndex={0}
                        onClick={() => setProfileMenuOpen(false)}
                      >Profile</Link>
                      <Link
                        to="/orders"
                        className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 transition"
                        role="menuitem"
                        tabIndex={0}
                        onClick={() => setProfileMenuOpen(false)}
                      >My Orders</Link>
                      {current_user?.role === 'admin' && (
                        <Link
                          to="/admin"
                          className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 transition"
                          role="menuitem"
                          tabIndex={0}
                          onClick={() => setProfileMenuOpen(false)}
                        >Admin Dashboard</Link>
                      )}
                      {current_user?.role === 'vendor' && (
                        <Link
                          to="/vendor"
                          className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 transition"
                          role="menuitem"
                          tabIndex={0}
                          onClick={() => setProfileMenuOpen(false)}
                        >Vendor Dashboard</Link>
                      )}
                      <button
                        onClick={handleLogout}
                        className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition"
                        role="menuitem"
                        tabIndex={0}
                      >Log out</button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="hidden sm:flex items-center space-x-2">
                  <Link
                    to="/login"
                    className="px-4 py-2 rounded-md text-blue-700 border border-blue-600 bg-white hover:bg-blue-50 focus:outline-none transition text-sm font-medium"
                    tabIndex={0}
                  >
                    Sign In
                  </Link>
                  <Link
                    to="/register"
                    className="px-4 py-2 rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none transition text-sm font-medium"
                    tabIndex={0}
                  >
                    Register
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ============= MOBILE DRAWER MENU ============ */}
        {mobileMenuOpen && (
          <div
            ref={mobileMenuRef}
            className="sm:hidden absolute w-full left-0 top-16 bg-white border-t border-gray-100 shadow-md z-50"
            id="mobile-menu"
            aria-modal="true"
            role="dialog"
          >
            <div className="p-4 flex flex-col space-y-3">
              {/* Sidebar Image */}
              <div className="flex justify-center mb-4">
                <img 
                  src="/src/assets/cofounder.webp" 
                  alt="Cofounder" 
                  className="w-24 h-24 rounded-full object-cover border-2 border-blue-200 shadow-md"
                />
              </div>
              {/* Always show Shop/Home */}
              <Link to="/" className="block py-2 px-3 text-blue-700 font-bold rounded hover:bg-blue-50 transition" onClick={()=>setMobileMenuOpen(false)} tabIndex={0}>Home</Link>
              <Link to="/products" className="block py-2 px-3 rounded hover:bg-blue-50 transition" onClick={()=>setMobileMenuOpen(false)} tabIndex={0}>Shop</Link>
              {is_authenticated && (
                <>
                  <Link to="/orders" className="block py-2 px-3 rounded hover:bg-blue-50 transition" onClick={()=>setMobileMenuOpen(false)} tabIndex={0}>My Orders</Link>
                  <Link to="/profile" className="block py-2 px-3 rounded hover:bg-blue-50 transition" onClick={()=>setMobileMenuOpen(false)} tabIndex={0}>Profile</Link>
                </>
              )}
              {current_user?.role === 'admin' && (
                <>
                  <Link to="/admin" className="block py-2 px-3 rounded hover:bg-blue-50 transition" onClick={()=>setMobileMenuOpen(false)} tabIndex={0}>Admin Dashboard</Link>
                  {adminLinks.map(link => (
                    <Link key={link.href} to={link.href} className="block py-2 px-3 rounded hover:bg-blue-50 transition" onClick={()=>setMobileMenuOpen(false)} tabIndex={0}>{link.label}</Link>
                  ))}
                </>
              )}
              {current_user?.role === 'vendor' && (
                <>
                  <Link to="/vendor" className="block py-2 px-3 rounded hover:bg-blue-50 transition" onClick={()=>setMobileMenuOpen(false)} tabIndex={0}>Vendor Dashboard</Link>
                  {vendorLinks.map(link => (
                    <Link key={link.href} to={link.href} className="block py-2 px-3 rounded hover:bg-blue-50 transition" onClick={()=>setMobileMenuOpen(false)} tabIndex={0}>{link.label}</Link>
                  ))}
                </>
              )}
              <div className="flex items-center space-x-3 mt-3">
                <button
                  className="flex-1 py-2 bg-blue-600 text-white rounded font-semibold"
                  onClick={() => { openCartModal(); setMobileMenuOpen(false); }}
                  tabIndex={0}
                  aria-label={`Show cart (${cart_items_count})`}
                >
                  Cart {cart_items_count > 0 ? `(${cart_items_count})` : ""}
                </button>
                <button
                  className="flex-1 py-2 bg-pink-500 text-white rounded font-semibold"
                  onClick={() => { openWishlistModal(); setMobileMenuOpen(false); }}
                  tabIndex={0}
                  aria-label={`Show wishlist (${wishlist_products_count})`}
                >
                  Wishlist {wishlist_products_count > 0 ? `(${wishlist_products_count})` : ""}
                </button>
                <button
                  className="flex-1 py-2 bg-yellow-500 text-white rounded font-semibold"
                  onClick={() => { openNotificationCenter(); setMobileMenuOpen(false); }}
                  tabIndex={0}
                  aria-label={`Show notifications (${unread_notification_count})`}
                >
                  Notifs {unread_notification_count > 0 ? `(${unread_notification_count})` : ""}
                </button>
              </div>
              {/* Auth links if guest */}
              {!is_authenticated && (
                <div className="mt-4 flex flex-col space-y-2">
                  <Link to="/login" className="block py-2 px-3 rounded bg-blue-600 text-white font-medium text-center" tabIndex={0} onClick={()=>setMobileMenuOpen(false)}>Sign In</Link>
                  <Link to="/register" className="block py-2 px-3 rounded bg-white border border-blue-600 text-blue-700 font-medium text-center" tabIndex={0} onClick={()=>setMobileMenuOpen(false)}>Register</Link>
                </div>
              )}
              {/* Logout at bottom if authed */}
              {is_authenticated && (
                <button
                  className="mt-4 py-2 px-3 rounded bg-red-600 text-white font-medium"
                  tabIndex={0}
                  onClick={() => { handleLogout(); setMobileMenuOpen(false); }}
                >Log out</button>
              )}
            </div>
          </div>
        )}

      </nav>
    </>
  );
};

export default GV_TopNav;