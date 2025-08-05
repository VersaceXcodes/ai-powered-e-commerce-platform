import React, { useEffect, useRef, useCallback, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { useAppStore } from "@/store/main";

// TypeScript types for modal registry
type ModalType =
  | "confirm_delete_cart_item"
  | "confirm_clear_cart"
  | "confirm_remove_wishlist"
  | "edit_wishlist_name"
  | "create_wishlist"
  | "image_lightbox";

// Modal Global Overlay System
const GV_Modals: React.FC = () => {
  // Zustand selectors (ALWAYS individual selectors)
  const active_modal = useAppStore(state => (state as any).active_modal);
  const modal_payload = useAppStore(state => (state as any).modal_payload);
  const set_error = useAppStore(state => state.set_error);
  const clear_error = useAppStore(state => state.clear_error);
  const set_global_loading = useAppStore(state => state.set_global_loading);
  const clear_global_loading = useAppStore(state => state.clear_global_loading);

  // These are mapped from the globalState architecture
  const is_global_loading = useAppStore(state => state.global_loading_state.is_global_loading);
  const loading_context = useAppStore(state => state.global_loading_state.context);
  const global_error_message = useAppStore(state => state.error_state.error_message);

  // To manage modals, we will "inject" set_active_modal/modal_payload into appStore -- else, implement them locally as a workaround (since store does not provide them in the provided code).
  // Since store is not aware of modal logic, we'll handle in this component as internal state, but expose imperative handlers for open/close modal via a global window or context (not shown).
  // Here, we implement modal control as local React state BUT sync with Zustand if a global modal manager is present.

  // IN THIS IMPLEMENTATION: We'll assume modal state is kept locally (component-scoped) for reliability (since not in provided global store).
  // If in real app, sync Zustand.

  // Folder-level state (satisfying "single modal at a time")
  const [localActiveModal, setLocalActiveModal] = React.useState<ModalType | null>(null);
  const [localModalPayload, setLocalModalPayload] = React.useState<any>(null);

  // Synchronize local and global modal state (store->local and local->store)
  useEffect(() => {
    if (active_modal !== localActiveModal) setLocalActiveModal(active_modal ?? null);
    if (JSON.stringify(modal_payload) !== JSON.stringify(localModalPayload)) setLocalModalPayload(modal_payload ?? null);
    // eslint-disable-next-line
  }, [active_modal, modal_payload]);

  // Modal close handler
  const closeModal = useCallback(() => {
    setLocalActiveModal(null);
    setLocalModalPayload(null);
    // Optionally, sync store
    if ((useAppStore as any).setState) {
      // setState works for Zustand
      (useAppStore as any).setState({ active_modal: null, modal_payload: null });
    }
    // Clean up errors/loading if needed
    clear_error();
    clear_global_loading();
  }, [clear_error, clear_global_loading]);

  // Keyboard ESC closes modal
  useEffect(() => {
    if (!localActiveModal && !is_global_loading && !global_error_message) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && localActiveModal && !is_global_loading && !global_error_message) {
        e.preventDefault();
        closeModal();
      }
    };
    window.addEventListener("keydown", handler, { capture: true });
    return () => window.removeEventListener("keydown", handler, { capture: true });
  }, [localActiveModal, is_global_loading, global_error_message, closeModal]);

  // Capture last focused element for focus return after closing modal
  const lastFocusRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (localActiveModal || is_global_loading || global_error_message) {
      lastFocusRef.current = document.activeElement as HTMLElement;
    }
  }, [localActiveModal, is_global_loading, global_error_message]);

  // Focus trap/focus first in dialog
  const dialogRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (localActiveModal || is_global_loading || global_error_message) {
      setTimeout(() => {
        if (dialogRef.current) {
          // Try focus first input, fallback to modal itself
          const focusable = dialogRef.current.querySelector<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          );
          (focusable || dialogRef.current).focus();
        }
      }, 10);
    }
    return () => {
      if ((!localActiveModal && !is_global_loading && !global_error_message) && lastFocusRef.current) {
        lastFocusRef.current.focus();
      }
    };
  }, [localActiveModal, is_global_loading, global_error_message]);

  // FORM states for forms (edit/create wishlist name -- controlled input)
  const [wishlistName, setWishlistName] = useState("");
  const [wishlistFormError, setWishlistFormError] = useState<string | null>(null);

  // When opening edit/create wishlist modal, set field
  useEffect(() => {
    if (localActiveModal === "edit_wishlist_name") setWishlistName(localModalPayload?.title || "");
    if (localActiveModal === "create_wishlist") setWishlistName("");
    setWishlistFormError(null);
  }, [localActiveModal, localModalPayload]);

  // Get store user for API calls
  const currentUser = useAppStore(state => state.authentication_state.current_user);

  // --- REACT QUERY: Create/Rename/Delete wishlist mutations ---
  const queryClient = useQueryClient();

  // -- CREATE wishlist
  const createWishlistMutation = useMutation({
    mutationFn: async (data: { user_id: string; title: string }) => {
      const resp = await axios.post(
        `${import.meta.env.VITE_API_BASE_URL || "http://localhost:3000"}/wishlists`,
        data,
        {
          headers: { "Content-Type": "application/json" },
        }
      );
      return resp.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wishlists"] });
      closeModal();
    },
    onError: (err: any) => {
      setWishlistFormError(err?.response?.data?.message || "Failed to create wishlist");
    },
  });

  // -- EDIT wishlist name
  const updateWishlistMutation = useMutation({
    mutationFn: async (data: { wishlist_id: string; title: string }) => {
      const resp = await axios.patch(
        `${import.meta.env.VITE_API_BASE_URL || "http://localhost:3000"}/wishlists/${data.wishlist_id}`,
        { title: data.title },
        {
          headers: { "Content-Type": "application/json" },
        }
      );
      return resp.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wishlists"] });
      closeModal();
    },
    onError: (err: any) => {
      setWishlistFormError(err?.response?.data?.message || "Failed to update wishlist");
    },
  });

  // -- DELETE wishlist
  const deleteWishlistMutation = useMutation({
    mutationFn: async (wishlist_id: string) => {
      await axios.delete(
        `${import.meta.env.VITE_API_BASE_URL || "http://localhost:3000"}/wishlists/${wishlist_id}`
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wishlists"] });
      closeModal();
    },
    onError: (err: any) => {
      set_error(err?.response?.data?.message || "Failed to remove wishlist", "confirm_remove_wishlist");
    },
  });

  // -- DELETE Cart Item
  const deleteCartItemMutation = useMutation({
    mutationFn: async (cart_item_id: string) => {
      await axios.delete(
        `${import.meta.env.VITE_API_BASE_URL || "http://localhost:3000"}/cart/items`,
        { params: { cart_item_id } }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cart_items"] });
      closeModal();
    },
    onError: (err: any) => {
      set_error(err?.response?.data?.message || "Failed to remove cart item", "confirm_delete_cart_item");
    },
  });

  // -- CLEAR Cart
  const clearCartMutation = useMutation({
    mutationFn: async (cart_id: string) => {
      await axios.delete(
        `${import.meta.env.VITE_API_BASE_URL || "http://localhost:3000"}/cart`,
        { params: { cart_id } }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cart_items"] });
      closeModal();
    },
    onError: (err: any) => {
      set_error(err?.response?.data?.message || "Failed to clear cart", "confirm_clear_cart");
    },
  });

  // ---- MODAL SUBMIT HANDLERS ----
  const handleWishlistFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setWishlistFormError(null);
    const title = wishlistName.trim();
    if (!title) {
      setWishlistFormError("List name cannot be empty.");
      return;
    }
    if (!currentUser) {
      setWishlistFormError("Authentication required.");
      return;
    }
    if (localActiveModal === "create_wishlist") {
      createWishlistMutation.mutate({ user_id: currentUser.user_id, title });
    } else if (localActiveModal === "edit_wishlist_name") {
      updateWishlistMutation.mutate({ wishlist_id: localModalPayload.wishlist_id, title });
    }
  };

  // Render nothing if NO modal/loader/error
  if (
    !localActiveModal &&
    !is_global_loading &&
    !global_error_message
  ) {
    return <></>;
  }

  return (
    <>
      {/* --- GLOBAL MODAL/OVERLAY ROOT --- */}
      {/* Overlay prevents any background interaction (z-50, fixed, full-screen, backdrop, pointer-events-none) */}
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 backdrop-blur-sm"
        aria-modal="true"
        role={is_global_loading || global_error_message ? "alertdialog" : "dialog"}
        tabIndex={-1}
        style={{ pointerEvents: "auto" }}
        onClick={e => {
          // Clicking on overlay closes ONLY if not loading or error and not clicking in modal content
          if (
            !is_global_loading &&
            !global_error_message &&
            (e.target as HTMLElement).getAttribute("role") === "dialog"
          ) {
            closeModal();
          }
        }}
      >
        {/* DIALOG/OVERLAY CONTENT */}
        <div
          ref={dialogRef}
          className={`
            rounded-lg bg-white shadow-xl w-full max-w-md mx-auto
            outline-none focus:outline-none
            ${is_global_loading || global_error_message ? 'pointer-events-auto' : ''}
            relative
          `}
          aria-live="polite"
          role="document"
          tabIndex={-1}
          onClick={e => e.stopPropagation()}
          style={{
            ...(is_global_loading || global_error_message
              ? { pointerEvents: "auto", opacity: 1 }
              : {}),
            maxWidth: localActiveModal === "image_lightbox" ? "650px" : "28rem",
            padding: localActiveModal === "image_lightbox" ? undefined : "1.5rem 1.5rem"
          }}
        >
          {/* BLOCKING LOADER OVERLAY */}
          {is_global_loading && (
            <div className="flex flex-col items-center justify-center min-h-[200px]">
              <div className="animate-spin h-12 w-12 border-4 border-blue-400 border-t-transparent rounded-full mb-4"></div>
              <p className="text-blue-700 text-lg" aria-live="polite">
                {loading_context === "checkout_submission" ? "Placing your order..." : "Please wait..."}
              </p>
            </div>
          )}

          {/* BLOCKING ERROR OVERLAY */}
          {!is_global_loading && global_error_message && (
            <div className="flex flex-col items-center justify-center min-h-[200px]">
              <div className="bg-red-100 text-red-700 border border-red-300 rounded-lg p-4 mb-4 w-full flex items-center">
                <svg width={24} height={24} className="mr-2 text-red-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01" />
                </svg>
                <span className="sr-only">Error:</span>
                <span aria-live="polite" aria-atomic="true">{global_error_message}</span>
              </div>
              <button
                type="button"
                onClick={closeModal}
                tabIndex={0}
                className="mt-4 px-5 py-2 bg-gray-700 text-white rounded-md focus:ring-2 focus:ring-gray-500 focus:outline-none"
                aria-label="Dismiss error"
                autoFocus
              >
                Dismiss
              </button>
            </div>
          )}

          {/* If showing loader or error, show only that */}
          {(!is_global_loading && !global_error_message) && (
            <>
              {/* --- CONFIRM DELETE CART ITEM --- */}
              {localActiveModal === "confirm_delete_cart_item" && (
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 mb-2">Remove item from cart?</h2>
                  <p className="mb-4 text-gray-600">Are you sure you want to remove this item from your cart?</p>
                  <div className="flex justify-end space-x-3">
                    <button
                      className="px-4 py-2 rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200 focus:ring-2 focus:ring-gray-300"
                      type="button"
                      tabIndex={0}
                      aria-label="Cancel"
                      onClick={closeModal}
                    >Cancel</button>
                    <button
                      className="px-4 py-2 rounded-md bg-red-600 text-white hover:bg-red-700 focus:ring-2 focus:ring-red-400"
                      type="button"
                      tabIndex={0}
                      aria-label="Confirm remove"
                      onClick={() => {
                        if (!localModalPayload?.cart_item_id) {
                          set_error("Missing cart item id", "confirm_delete_cart_item");
                        } else {
                          deleteCartItemMutation.mutate(localModalPayload.cart_item_id);
                        }
                      }}
                      disabled={deleteCartItemMutation.isLoading}
                    >
                      {deleteCartItemMutation.isLoading ? "Removing..." : "Remove"}
                    </button>
                  </div>
                </div>
              )}

              {/* --- CONFIRM CLEAR CART --- */}
              {localActiveModal === "confirm_clear_cart" && (
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 mb-2">Clear cart?</h2>
                  <p className="mb-4 text-gray-600">Are you sure you want to remove all items from your cart? This cannot be undone.</p>
                  <div className="flex justify-end space-x-3">
                    <button
                      className="px-4 py-2 rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200 focus:ring-2 focus:ring-gray-300"
                      type="button"
                      tabIndex={0}
                      aria-label="Cancel"
                      onClick={closeModal}
                    >Cancel</button>
                    <button
                      className="px-4 py-2 rounded-md bg-red-600 text-white hover:bg-red-700 focus:ring-2 focus:ring-red-400"
                      type="button"
                      aria-label="Confirm clear"
                      tabIndex={0}
                      onClick={() => {
                        if (!localModalPayload?.cart_id) {
                          set_error("Missing cart id", "confirm_clear_cart");
                        } else {
                          clearCartMutation.mutate(localModalPayload.cart_id);
                        }
                      }}
                      disabled={clearCartMutation.isLoading}
                    >
                      {clearCartMutation.isLoading ? "Clearing..." : "Clear Cart"}
                    </button>
                  </div>
                </div>
              )}

              {/* --- CONFIRM REMOVE WISHLIST --- */}
              {localActiveModal === "confirm_remove_wishlist" && (
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 mb-2">Delete wishlist?</h2>
                  <p className="mb-4 text-gray-600">Are you sure you want to delete this list? All products saved to it will remain in your account.</p>
                  <div className="flex justify-end space-x-3">
                    <button
                      className="px-4 py-2 rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200 focus:ring-2 focus:ring-gray-300"
                      type="button"
                      tabIndex={0}
                      aria-label="Cancel"
                      onClick={closeModal}
                    >Cancel</button>
                    <button
                      className="px-4 py-2 rounded-md bg-red-600 text-white hover:bg-red-700 focus:ring-2 focus:ring-red-400"
                      type="button"
                      aria-label="Delete"
                      tabIndex={0}
                      onClick={() => {
                        if (!localModalPayload?.wishlist_id) {
                          set_error("Missing wishlist id", "confirm_remove_wishlist");
                        } else {
                          deleteWishlistMutation.mutate(localModalPayload?.wishlist_id);
                        }
                      }}
                      disabled={deleteWishlistMutation.isLoading}
                    >
                      {deleteWishlistMutation.isLoading ? "Deleting..." : "Delete"}
                    </button>
                  </div>
                </div>
              )}

              {/* --- EDIT/RENAME WISHLIST NAME MODAL --- */}
              {(localActiveModal === "edit_wishlist_name" || localActiveModal === "create_wishlist") && (
                <form onSubmit={handleWishlistFormSubmit} className="w-full">
                  <h2 className="text-lg font-semibold text-gray-900 mb-2">
                    {localActiveModal === "edit_wishlist_name" ? "Rename wishlist" : "Create new wishlist"}
                  </h2>
                  <input
                    type="text"
                    name="wishlist_name"
                    value={wishlistName}
                    onChange={e => {
                      setWishlistName(e.target.value);
                      setWishlistFormError(null);
                    }}
                    placeholder="Enter wishlist name"
                    autoFocus
                    maxLength={100}
                    className="mb-3 w-full px-4 py-2 border border-gray-300 rounded-md focus:border-blue-500 focus:ring-1 focus:ring-blue-400"
                    aria-label="Wishlist name"
                    required
                  />
                  {wishlistFormError && (
                    <div aria-live="polite" className="text-sm text-red-600 mb-2">{wishlistFormError}</div>
                  )}
                  <div className="flex justify-end space-x-3">
                    <button
                      className="px-4 py-2 rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200 focus:ring-2 focus:ring-gray-300"
                      type="button"
                      aria-label="Cancel"
                      onClick={closeModal}
                    >Cancel</button>
                    <button
                      type="submit"
                      className="px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 focus:ring-2 focus:ring-blue-400"
                      aria-label={localActiveModal === "edit_wishlist_name" ? "Save changes" : "Create wishlist"}
                      disabled={
                        (localActiveModal === "edit_wishlist_name" && updateWishlistMutation.isLoading) ||
                        (localActiveModal === "create_wishlist" && createWishlistMutation.isLoading)
                      }
                    >
                      {(localActiveModal === "create_wishlist" && createWishlistMutation.isLoading) ||
                        (localActiveModal === "edit_wishlist_name" && updateWishlistMutation.isLoading)
                        ? (localActiveModal === "create_wishlist" ? "Creating..." : "Saving...")
                        : (localActiveModal === "create_wishlist" ? "Create" : "Save")}
                    </button>
                  </div>
                </form>
              )}

              {/* --- IMAGE LIGHTBOX MODAL --- */}
              {localActiveModal === "image_lightbox" && (
                <div className="max-w-xl w-full flex flex-col items-center justify-center py-6 bg-white rounded-md outline-none">
                  <img
                    src={typeof localModalPayload?.image_url === "string"
                      ? localModalPayload.image_url
                      : "https://picsum.photos/seed/nopayload/480/480"}
                    alt="Enlarged product"
                    className="object-contain w-full max-h-[60vh] rounded"
                    style={{ background: "#f3f4f6" }}
                  />
                  <button
                    type="button"
                    className="mt-6 text-gray-700 px-5 py-2 rounded bg-gray-50 hover:bg-gray-100 focus:ring-2 focus:ring-blue-400 outline-none"
                    aria-label="Close image"
                    tabIndex={0}
                    onClick={closeModal}
                    autoFocus
                  >Close</button>
                </div>
              )}

              {/* --- Default fallback --- */}
              {localActiveModal &&
                !(
                  [
                    "confirm_delete_cart_item",
                    "confirm_clear_cart",
                    "confirm_remove_wishlist",
                    "edit_wishlist_name",
                    "create_wishlist",
                    "image_lightbox",
                  ] as string[]
                ).includes(localActiveModal) && (
                  <div className="py-10 text-center">
                    <div className="text-xl font-semibold text-gray-800">
                      Unknown dialog: {localActiveModal}
                    </div>
                    <button
                      onClick={closeModal}
                      className="mt-5 px-5 py-2 rounded bg-gray-600 text-white font-medium focus:ring-2 focus:ring-gray-400"
                    >
                      Close
                    </button>
                  </div>
                )}
            </>
          )}
        </div>
      </div>
    </>
  );
};

export default GV_Modals;