// store/main.tsx

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import axios from 'axios';
import { io, Socket } from 'socket.io-client';

// ======================
// TYPES
// ======================

export interface User {
  user_id: string;
  name: string;
  email: string;
  password_hash?: string;
  role: 'customer' | 'admin' | 'vendor';
  profile_image_url: string | null;
  is_blocked: boolean;
  created_at: string;
  updated_at: string;
}

// --- Auth State ---
export interface AuthenticationState {
  current_user: User | null;
  auth_token: string | null;
  authentication_status: {
    is_authenticated: boolean;
    is_loading: boolean;
  };
  error_message: string | null;
}

// --- Cart State ---
export interface CartItem {
  cart_item_id?: string; // May be missing in realtime event payload for guests
  cart_id?: string;
  product_id: string;
  name: string;
  price: number;
  quantity: number;
  image_url?: string | null;
  max_quantity: number;
  vendor_name?: string | null;
  added_at?: string;
}

export interface CartState {
  items: CartItem[];
  subtotal: number;
  tax: number;
  shipping: number;
  total: number;
  updated_at: string;
}

// --- Wishlist State ---
export interface WishlistProduct {
  product_id: string;
  name: string;
  image_url: string;
  price: number;
}

export interface Wishlist {
  wishlist_id: string;
  title: string;
  products: WishlistProduct[];
  created_at: string;
  updated_at: string;
}

export interface WishlistState {
  wishlists: Wishlist[];
  selected_wishlist_id: string | null;
}

// --- Notification State ---
export interface NotificationEntity {
  notification_id: string;
  user_id: string | null;
  content: string;
  type: string;
  is_read: boolean;
  created_at: string;
  related_entity_type?: string | null;
  related_entity_id?: string | null;
}

export interface NotificationState {
  notifications: NotificationEntity[];
  unread_count: number;
}

// --- AI Recommendations State ---
export interface AiRecommendation {
  product_id: string;
  name: string;
  price: number;
  image_url: string;
  reason: string;
}

export interface AiRecommendationsState {
  home_feed: AiRecommendation[];
  product_recommendations: { [product_id: string]: AiRecommendation[] };
}

// --- Admin Dashboard State ---
export interface AdminDashboardState {
  revenue_total: number;
  avg_order_value: number;
  total_orders: number;
  inventory_low_count: number;
  top_products: { product_id: string; name: string; sales_count: number }[];
  user_registration_count: number;
  last_updated: string;
}

// --- Error & Loading State ---
export interface ErrorState {
  error_message: string | null;
  last_action: string | null;
}
export interface GlobalLoadingState {
  is_global_loading: boolean;
  context: string | null;
}

// --- Search State ---
export interface SearchSuggestion {
  product_id: string;
  name: string;
  image_url: string;
  price: number;
}
export interface SearchResult {
  product_id: string;
  name: string;
  image_url: string;
  price: number;
  average_rating: number;
  in_stock: boolean;
}
export interface SearchState {
  query: string;
  suggestions: SearchSuggestion[];
  is_loading: boolean;
  last_results: SearchResult[];
}

// --- Root State Type ---
export interface AppStoreState {
  // Global
  authentication_state: AuthenticationState;
  cart_state: CartState;
  wishlist_state: WishlistState;
  notification_state: NotificationState;
  ai_recommendations_state: AiRecommendationsState;
  admin_dashboard_state: AdminDashboardState;
  error_state: ErrorState;
  global_loading_state: GlobalLoadingState;
  search_state: SearchState;

  // Real-time connection
  realtime_connection: 'connected' | 'disconnected' | 'connecting';

  // Socket instance (NOT persisted)
  socket: Socket | null;

  // ---------------------
  // ACTIONS (Global only!)
  // ---------------------
  // --- Auth actions ---
  login_user: (email: string, password: string) => Promise<void>;
  register_user: (name: string, email: string, password: string) => Promise<void>;
  logout_user: () => Promise<void>;
  initialize_auth: () => Promise<void>;
  clear_auth_error: () => void;
  update_user_profile: (userData: Partial<User>) => void;

  // --- Cart/Wishlist/Notification/AI/Admin State setters from real-time ---
  set_cart_state: (cart: Partial<CartState>) => void;
  clear_cart_state: () => void;

  set_wishlist_state: (wishlist_state: Partial<WishlistState>) => void;
  set_selected_wishlist_id: (wishlist_id: string | null) => void;

  set_notification_state: (notif_state: Partial<NotificationState>) => void;
  push_notification: (notification: NotificationEntity) => void;

  set_ai_recommendations_state: (ai_recs: Partial<AiRecommendationsState>) => void;

  set_admin_dashboard_state: (dash: Partial<AdminDashboardState>) => void;

  set_error: (error_message: string, last_action?: string | null) => void;
  clear_error: () => void;

  set_global_loading: (context?: string | null) => void;
  clear_global_loading: () => void;

  set_search_state: (search: Partial<SearchState>) => void;

  // --- Real-time wiring ---
  connect_socket: () => void;
  disconnect_socket: () => void;
}

// Convenience
const API_BASE = `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}`;

// ======================
// THE STORE
// ======================

export const useAppStore = create<AppStoreState>()(
  persist(
    (set, get) => ({
      // --- INITIAL STATE ---
      authentication_state: {
        current_user: null,
        auth_token: null,
        authentication_status: {
          is_authenticated: false,
          is_loading: true,
        },
        error_message: null,
      },
      cart_state: {
        items: [],
        subtotal: 0,
        tax: 0,
        shipping: 0,
        total: 0,
        updated_at: '',
      },
      wishlist_state: {
        wishlists: [],
        selected_wishlist_id: null,
      },
      notification_state: {
        notifications: [],
        unread_count: 0,
      },
      ai_recommendations_state: {
        home_feed: [],
        product_recommendations: {},
      },
      admin_dashboard_state: {
        revenue_total: 0,
        avg_order_value: 0,
        total_orders: 0,
        inventory_low_count: 0,
        top_products: [],
        user_registration_count: 0,
        last_updated: '',
      },
      error_state: {
        error_message: null,
        last_action: null,
      },
      global_loading_state: {
        is_global_loading: false,
        context: null,
      },
      search_state: {
        query: '',
        suggestions: [],
        is_loading: false,
        last_results: [],
      },
      realtime_connection: 'disconnected',
      socket: null,

      // ==============
      // ACTIONS
      // ==============

      // ---- AUTH ----

      login_user: async (email: string, password: string) => {
        set((state) => ({
          authentication_state: {
            ...state.authentication_state,
            authentication_status: { ...state.authentication_state.authentication_status, is_loading: true },
            error_message: null,
          },
        }));
        try {
          const response = await axios.post(
            `${API_BASE}/auth/login`,
            { email, password },
            { headers: { 'Content-Type': 'application/json' } }
          );
          const { user, token } = response.data;
          set({
            authentication_state: {
              current_user: user,
              auth_token: token,
              authentication_status: { is_authenticated: true, is_loading: false },
              error_message: null,
            },
          });
          // Connect socket as this user
          get().connect_socket();
        } catch (e: any) {
          const msg = e.response?.data?.message || e.message || 'Login failed';
          set({
            authentication_state: {
              current_user: null,
              auth_token: null,
              authentication_status: { is_authenticated: false, is_loading: false },
              error_message: msg,
            },
          });
          throw new Error(msg);
        }
      },

      register_user: async (name: string, email: string, password: string) => {
        set((state) => ({
          authentication_state: {
            ...state.authentication_state,
            authentication_status: { ...state.authentication_state.authentication_status, is_loading: true },
            error_message: null,
          },
        }));
        try {
          const response = await axios.post(
            `${API_BASE}/auth/register`,
            { name, email, password_hash: password, role: 'customer' },
            { headers: { 'Content-Type': 'application/json' } }
          );
          const { user, token } = response.data;
          set({
            authentication_state: {
              current_user: user,
              auth_token: token,
              authentication_status: { is_authenticated: true, is_loading: false },
              error_message: null,
            },
          });
          // Connect socket as this user
          get().connect_socket();
        } catch (e: any) {
          const msg = e.response?.data?.message || e.message || 'Registration failed';
          set({
            authentication_state: {
              current_user: null,
              auth_token: null,
              authentication_status: { is_authenticated: false, is_loading: false },
              error_message: msg,
            },
          });
          throw new Error(msg);
        }
      },

      logout_user: async () => {
        try {
          const token = get().authentication_state.auth_token;
          if (token) {
            await axios.post(`${API_BASE}/auth/logout`, {}, {
              headers: { Authorization: `Bearer ${token}` },
            });
          }
        } catch {}
        set({
          authentication_state: {
            current_user: null,
            auth_token: null,
            authentication_status: { is_authenticated: false, is_loading: false },
            error_message: null,
          },
          cart_state: {
            items: [],
            subtotal: 0,
            tax: 0,
            shipping: 0,
            total: 0,
            updated_at: '',
          },
          wishlist_state: {
            wishlists: [],
            selected_wishlist_id: null,
          },
          notification_state: {
            notifications: [],
            unread_count: 0,
          },
          ai_recommendations_state: {
            home_feed: [],
            product_recommendations: {},
          },
        });
        get().disconnect_socket();
      },

      initialize_auth: async () => {
        // On app load; check if token exists, validate user & rehydrate
        const { auth_token } = get().authentication_state;
        // No token = not authed
        if (!auth_token) {
          set((state) => ({
            authentication_state: {
              ...state.authentication_state,
              authentication_status: { ...state.authentication_state.authentication_status, is_loading: false },
            },
          }));
          return;
        }
        try {
          // No /auth/verify endpoint; fetch self profile
          const response = await axios.get(`${API_BASE}/profile`, {
            headers: { Authorization: `Bearer ${auth_token}` },
          });
          set((state) => ({
            authentication_state: {
              ...state.authentication_state,
              current_user: response.data,
              authentication_status: { is_authenticated: true, is_loading: false },
              error_message: null,
            },
          }));
          // Connect socket
          get().connect_socket();
        } catch (e) {
          set((state) => ({
            authentication_state: {
              ...state.authentication_state,
              current_user: null,
              auth_token: null,
              authentication_status: { is_authenticated: false, is_loading: false },
              error_message: null,
            },
          }));
          get().disconnect_socket();
        }
      },

      clear_auth_error: () => set((state) => ({
        authentication_state: {
          ...state.authentication_state,
          error_message: null,
        },
      })),

      update_user_profile: (userData: Partial<User>) =>
        set((state) => ({
          authentication_state: {
            ...state.authentication_state,
            current_user: state.authentication_state.current_user
              ? { ...state.authentication_state.current_user, ...userData }
              : null,
          },
        })),

      // ---- CART ----
      set_cart_state: (cart: Partial<CartState>) =>
        set((state) => ({
          cart_state: { ...state.cart_state, ...cart },
        })),
      clear_cart_state: () =>
        set(() => ({
          cart_state: {
            items: [],
            subtotal: 0,
            tax: 0,
            shipping: 0,
            total: 0,
            updated_at: '',
          },
        })),

      // ---- WISHLIST ----
      set_wishlist_state: (wishlist_state: Partial<WishlistState>) =>
        set((state) => ({
          wishlist_state: { ...state.wishlist_state, ...wishlist_state },
        })),
      set_selected_wishlist_id: (wishlist_id: string | null) =>
        set((state) => ({
          wishlist_state: { ...state.wishlist_state, selected_wishlist_id: wishlist_id },
        })),

      // ---- NOTIFICATIONS ----
      set_notification_state: (notif_state: Partial<NotificationState>) =>
        set((state) => ({
          notification_state: { ...state.notification_state, ...notif_state },
        })),
      push_notification: (notification: NotificationEntity) =>
        set((state) => ({
          notification_state: {
            ...state.notification_state,
            notifications: [notification, ...state.notification_state.notifications].slice(0, 100),
            unread_count: !notification.is_read
              ? state.notification_state.unread_count + 1
              : state.notification_state.unread_count,
          },
        })),

      // --- AI REC ---
      set_ai_recommendations_state: (ai_recs: Partial<AiRecommendationsState>) =>
        set((state) => ({
          ai_recommendations_state: { ...state.ai_recommendations_state, ...ai_recs },
        })),

      // --- ADMIN DASHBOARD ---
      set_admin_dashboard_state: (dash: Partial<AdminDashboardState>) =>
        set((state) => ({
          admin_dashboard_state: { ...state.admin_dashboard_state, ...dash },
        })),

      // --- ERROR / LOADING ---
      set_error: (error_message: string, last_action: string | null = null) =>
        set((state) => ({
          error_state: { error_message, last_action },
        })),
      clear_error: () => set(() => ({ error_state: { error_message: null, last_action: null } })),

      set_global_loading: (context: string | null = null) =>
        set(() => ({ global_loading_state: { is_global_loading: true, context } })),
      clear_global_loading: () =>
        set(() => ({ global_loading_state: { is_global_loading: false, context: null } })),

      // --- SEARCH STATE ---
      set_search_state: (search: Partial<SearchState>) =>
        set((state) => ({
          search_state: { ...state.search_state, ...search },
        })),

      // --- REALTIME: SOCKET.IO CLIENT & EVENTS ---
      connect_socket: () => {
        // If already connected, do nothing
        if (get().socket) return;

        const { authentication_state } = get();
        let token = authentication_state.auth_token;
        // Socket options: User token (if logged in), otherwise as guest
        let socket: Socket;

        set(() => ({ realtime_connection: 'connecting' }));

        try {
          socket = io(API_BASE, {
            path: '/ws',
            transports: ['websocket'],
            autoConnect: true,
            auth: token ? { token } : {},
            query: token ? {} : {},
            reconnection: true,
          });
        } catch (error) {
          set(() => ({ realtime_connection: 'disconnected' }));
          return;
        }

        // Set socket instance
        set(() => ({
          socket,
        }));

        // Attach event listeners
        socket.on('connect', () => {
          set(() => ({ realtime_connection: 'connected' }));
        });
        socket.on('disconnect', () => {
          set(() => ({ realtime_connection: 'disconnected' }));
        });

        // --- Realtime Events Mapping ---

        // CART
        socket.on('cart.updated', (payload) => {
          // Payload: AsyncAPI - { items, subtotal, tax, shipping, total, updated_at }
          set((state) => ({
            cart_state: { ...state.cart_state, ...payload },
          }));
        });
        socket.on('cart.item_stock_invalid', (payload) => {
          // Payload: { cart_item: CartItem, error_message: string }
          set((state) => ({
            error_state: {
              error_message: payload.error_message || "One or more cart items are unavailable.",
              last_action: "cart_item_stock_invalid",
            },
          }));
        });

        // WISHLIST
        socket.on('wishlist.updated', (payload) => {
          // Payload: { wishlists: Array, selected_wishlist_id }
          set(() => ({
            wishlist_state: {
              wishlists: payload.wishlists || [],
              selected_wishlist_id: payload.selected_wishlist_id || null,
            },
          }));
        });

        // NOTIFICATIONS
        socket.on('notification.state.updated', (payload) => {
          // { notifications: [...], unread_count: N }
          set(() => ({
            notification_state: {
              notifications: payload.notifications || [],
              unread_count: payload.unread_count || 0,
            },
          }));
        });

        socket.on('notification.new', (notification) => {
          get().push_notification(notification);
        });

        // AI RECOMMENDATIONS
        socket.on('ai_recommendations.updated', (payload) => {
          set(() => ({
            ai_recommendations_state: {
              home_feed: payload.home_feed || [],
              product_recommendations: payload.product_recommendations || {},
            },
          }));
        });

        // ADMIN DASHBOARD
        socket.on('admin.analytics.updated', (payload) => {
          set(() => ({
            admin_dashboard_state: {
              revenue_total: payload.revenue_total || 0,
              avg_order_value: payload.avg_order_value || 0,
              total_orders: payload.total_orders || 0,
              inventory_low_count: payload.inventory_low_count || 0,
              top_products: payload.top_products || [],
              user_registration_count: payload.user_registration_count || 0,
              last_updated: payload.last_updated || '',
            },
          }));
        });

        // ORDER (no state mutators - handled per-view, but can be used for global notif)
        socket.on('order.status.changed', (payload) => {
          // Optionally, show notification
        });
        socket.on('order.created', (payload) => {
          // Optionally, show notification
        });
        socket.on('order.cancelled', (payload) => {
          // Optionally, show notification
        });

        // PRODUCT/REVIEW: handled per-view or by notification toast only

        // USER BLOCK STATUS: if user is blocked in another session, auto-logout
        socket.on('user.block_status.changed', (payload) => {
          const current_user = get().authentication_state.current_user;
          if (current_user && payload.user_id === current_user.user_id && payload.is_blocked) {
            set(() => ({
              authentication_state: {
                current_user: null,
                auth_token: null,
                authentication_status: { is_authenticated: false, is_loading: false },
                error_message: "Your account has been blocked by an administrator.",
              },
            }));
            get().disconnect_socket();
          }
        });

        // Any additional events needed for badge sync/UX can be attached here
      },

      disconnect_socket: () => {
        const s = get().socket;
        if (s) {
          s.disconnect();
          set(() => ({
            socket: null,
            realtime_connection: 'disconnected',
          }));
        }
      },
    }),
    {
      name: 'aiocart-global-store-v1',
      // Persist only the *minimal* required state (NO socket, no error/loading, do not persist realtime_connection)
      partialize: (state) => ({
        authentication_state: {
          current_user: state.authentication_state.current_user,
          auth_token: state.authentication_state.auth_token,
          authentication_status: {
            is_authenticated: state.authentication_state.authentication_status.is_authenticated,
            is_loading: false,
          },
          error_message: null,
        },
        cart_state: state.cart_state,
        wishlist_state: state.wishlist_state,
        notification_state: {
          notifications: state.notification_state.notifications,
          unread_count: state.notification_state.unread_count,
        },
        ai_recommendations_state: {
          home_feed: state.ai_recommendations_state.home_feed,
          product_recommendations: state.ai_recommendations_state.product_recommendations,
        },
        admin_dashboard_state: state.admin_dashboard_state,
        search_state: state.search_state,
      }),
      // Never persist error or loading state
      version: 1,
    }
  )
);
