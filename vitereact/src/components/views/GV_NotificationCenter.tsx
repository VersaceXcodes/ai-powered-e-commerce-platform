import React, { useState, useEffect, useRef } from "react";
import { useAppStore } from "@/store/main";
import { useQuery, useMutation } from "@tanstack/react-query";
import axios from "axios";
import { Link } from "react-router-dom";

import { NotificationListResponse, NotificationResponse } from "@schema";

const API_BASE = `${import.meta.env.VITE_API_BASE_URL || "http://localhost:3000"}`;

// The "drawer" UI is handled locally
const GV_NotificationCenter: React.FC = () => {
  // --- Modal open/close control ---
  const [show, setShow] = useState(false);

  // Focus trap on open
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (show && modalRef.current) {
      modalRef.current.focus();
    }
  }, [show]);

  // Escape to close
  useEffect(() => {
    if (!show) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShow(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [show]);

  // Selector rules: individual!
  const currentUser = useAppStore((s) => s.authentication_state.current_user);
  const authToken = useAppStore((s) => s.authentication_state.auth_token);
  const storeNotifs = useAppStore((s) => s.notification_state.notifications);
  const storeUnread = useAppStore((s) => s.notification_state.unread_count);
  const setNotificationState = useAppStore((s) => s.set_notification_state);
  const pushNotification = useAppStore((s) => s.push_notification);

  // Sorting
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Error
  const [panelError, setPanelError] = useState<string | null>(null);

  // --- React Query: Fetch notifications ---
  const {
    data: notificationsData,
    error: notificationsError,
    isLoading: notificationsLoading,
    isFetching: notificationsFetching,
    refetch: refetchNotifications
  } = useQuery<NotificationListResponse, Error>({
    queryKey: [
      "notifications",
      currentUser?.user_id,
      sortOrder,
      /* limit is fixed */
    ],
    queryFn: async () => {
      if (!currentUser || !authToken) throw new Error("Not authenticated");
      const resp = await axios.get(`${API_BASE}/notifications`, {
        headers: { Authorization: `Bearer ${authToken}` },
        params: {
          user_id: currentUser.user_id,
          limit: 100,
          sort_by: "created_at",
          sort_order: sortOrder,
        },
      });
      // Typecheck and zod-validate if desired
      if (typeof resp.data !== "object" || !Array.isArray(resp.data.notifications)) {
        throw new Error("Malformed notifications response");
      }
      return resp.data;
    },
    enabled: !!currentUser && !!authToken && show, // Only fetch when open and logged in
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: true,
  });

  // Sync data to store when query succeeds
  useEffect(() => {
    if (notificationsData?.notifications) {
      // Convert Date objects to strings for store compatibility
      const convertedNotifications = notificationsData.notifications.map(notification => ({
        ...notification,
        created_at: notification.created_at instanceof Date 
          ? notification.created_at.toISOString() 
          : notification.created_at
      }));
      setNotificationState({ notifications: convertedNotifications });
    }
  }, [notificationsData, setNotificationState]);

  // Handle query errors
  useEffect(() => {
    if (notificationsError) {
      setPanelError(notificationsError.message);
    }
  }, [notificationsError]);

  // --- Mark as read mutation ---
  const markAsReadMutation = useMutation<
    NotificationResponse,
    Error,
    string // notification_id
  >({
    mutationFn: async (notification_id) => {
      if (!authToken || !notification_id)
        throw new Error("Missing credentials or notification");
      const resp = await axios.patch(
        `${API_BASE}/notifications/${notification_id}/read`,
        { is_read: true },
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
      return resp.data;
    },
    onSuccess: (data) => {
      // Update store - convert Date to string for store compatibility
      const convertedNotification = {
        ...data,
        created_at: data.created_at instanceof Date 
          ? data.created_at.toISOString() 
          : data.created_at
      };
      pushNotification(convertedNotification);
      refetchNotifications();
    },
    onError: (err) => {
      setPanelError(err.message);
    },
  });

  // --- Mark all as read (loop) ---
  const [markAllLoading, setMarkAllLoading] = useState(false);

  const handleMarkAll = async () => {
    if (!notifList?.length) return;
    setMarkAllLoading(true);
    setPanelError(null);
    try {
      // Only unread
      const unread = notifList.filter((n) => !n.is_read);
      for (const n of unread) {
        // Await each individually ~ safety over batch
        await markAsReadMutation.mutateAsync(n.notification_id);
      }
      setMarkAllLoading(false);
    } catch (e: any) {
      setMarkAllLoading(false);
      setPanelError(e.message || "Failed to mark all as read");
    }
  };



  // --- Notification list to display ---
  const notifList = notificationsData?.notifications ?? storeNotifs;
  const unreadCount =
    typeof notificationsData?.notifications !== "undefined"
      ? notifList.filter((n) => !n.is_read).length
      : storeUnread;

  // --- Close on background click ---
  const bgClickClose = (e: React.MouseEvent) => {
    // Only close if clicking the backdrop
    if (e.target === e.currentTarget) setShow(false);
  };

  // --- Type to icon map ---
  const typeMeta: Record<
    string,
    { label: string; color: string; icon: React.ReactNode }
  > = {
    order_status: {
      label: "Order",
      color: "bg-blue-100 text-blue-900",
      icon: (
        <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path d="M3 7h18M3 12h18M3 17h18" strokeLinejoin="round" />
        </svg>
      ),
    },
    review: {
      label: "Review",
      color: "bg-green-100 text-green-900",
      icon: (
        <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path d="M7 17l9.2-5.6c.8-.5.8-1.7 0-2.2L7 3" strokeLinejoin="round" />
        </svg>
      ),
    },
    low_inventory: {
      label: "Inventory",
      color: "bg-red-100 text-red-900",
      icon: (
        <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path d="M12 8v4l3 3" strokeLinejoin="round" />
          <circle cx="12" cy="12" r="10" />
        </svg>
      ),
    },
    system: {
      label: "System",
      color: "bg-gray-100 text-gray-800",
      icon: (
        <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 16v-4M12 8h.01" strokeLinejoin="round" />
        </svg>
      ),
    },
    default: {
      label: "Alert",
      color: "bg-yellow-100 text-yellow-900",
      icon: (
        <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 8v4M12 16h.01" strokeLinejoin="round" />
        </svg>
      ),
    },
  };

  // --- Trigger - bell icon in overlay, always available unless explicitly hidden ---
  return (
    <>
      {/* Floating Trigger */}
      <button
        type="button"
        className="fixed top-5 right-8 z-40 bg-white rounded-full shadow-lg p-2 text-gray-700 hover:bg-blue-100 transition focus:outline-none"
        aria-label="Open notifications"
        aria-haspopup="true"
        aria-expanded={show}
        tabIndex={0}
        onClick={() => {
          setShow(true);
          setPanelError(null);
          // Optimistically clear errors on open.
        }}
      >
        <span className="relative">
          {/* Bell */}
          <svg
            className="w-7 h-7"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
          >
            <path
              d="M15 17h5l-1.405-1.405C18.21 15.198 18 14.7 18 14.172V11c0-3.07-1.635-5.64-4.5-6.32V4a1.5 1.5 0 00-3 0v.68C7.635 5.36 6 7.929 6 11v3.172c0 .528-.21 1.026-.595 1.423L4 17h5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          {!!unreadCount && (
            <span className="absolute top-0 right-0 block h-3 w-3 rounded-full ring-2 ring-white bg-red-500" aria-label={`${unreadCount} unread notifications`} />
          )}
        </span>
      </button>

      {/* Modal/Drawer */}
      {show && (
        <div
          className="fixed z-50 inset-0 flex items-start justify-end bg-black bg-opacity-30 transition-opacity"
          role="dialog"
          aria-modal="true"
          tabIndex={-1}
          onClick={bgClickClose}
        >
          <div
            ref={modalRef}
            className="w-full max-w-md bg-white shadow-xl h-full overflow-y-auto rounded-l-2xl flex flex-col focus:outline-none"
            tabIndex={0}
            aria-label="In-app Notifications"
            aria-live="polite"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 sticky top-0 bg-white z-10">
              <div className="flex items-center gap-2">
                <svg
                  className="w-7 h-7 text-blue-600"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  viewBox="0 0 24 24"
                >
                  <path
                    d="M15 17h5l-1.405-1.405C18.21 15.198 18 14.7 18 14.172V11c0-3.07-1.635-5.64-4.5-6.32V4a1.5 1.5 0 00-3 0v.68C7.635 5.36 6 7.929 6 11v3.172c0 .528-.21 1.026-.595 1.423L4 17h5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span className="text-lg font-bold text-gray-900">Notifications</span>
                {!!unreadCount && (
                  <span className="ml-2 bg-red-500 text-white text-xs px-2 py-0.5 rounded-full" aria-label={`${unreadCount} unread`}>
                    {unreadCount}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <button
                  className="p-2 rounded hover:bg-gray-100 text-gray-500 focus:outline-none"
                  aria-label="Refresh"
                  title="Refresh"
                  disabled={notificationsFetching || notificationsLoading}
                  onClick={() => {
                    setPanelError(null);
                    refetchNotifications();
                  }}
                >
                  <svg
                    className={`w-5 h-5 ${notificationsFetching ? "animate-spin" : ""}`}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    viewBox="0 0 24 24"
                  >
                    <path d="M4 4v5h.582M20 20v-5h-.581M5.817 18.144A9 9 0 1121 12.082" />
                  </svg>
                </button>
                <select
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value as "asc" | "desc")}
                  className="text-xs border rounded px-2 py-1 focus:outline-blue-600 bg-white"
                  aria-label="Sort notifications"
                  disabled={notificationsFetching}
                >
                  <option value="desc">Newest First</option>
                  <option value="asc">Oldest First</option>
                </select>
                <button
                  className="p-2 rounded hover:bg-gray-100 text-gray-700 focus:outline-none"
                  aria-label="Mark all as read"
                  onClick={handleMarkAll}
                  disabled={!!markAllLoading || !unreadCount}
                  title="Mark all as read"
                >
                  <svg
                    className={`w-5 h-5 ${markAllLoading ? "animate-pulse" : ""}`}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    viewBox="0 0 24 24"
                  >
                    <path
                      d="M5 13l4 4L19 7"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
                <button
                  className="p-2 ml-3 rounded hover:bg-gray-100 text-gray-500 focus:outline-none"
                  aria-label="Close notifications"
                  onClick={() => setShow(false)}
                  tabIndex={0}
                >
                  <svg className="w-6 h-6" viewBox="0 0 20 20" fill="none">
                    <path
                      d="M6 6l8 8M6 14L14 6"
                      stroke="currentColor"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              </div>
            </div>

            {/* Error or loading state */}
            {(notificationsLoading || notificationsFetching) && (
              <div className="flex-1 flex items-center justify-center py-8">
                <svg className="animate-spin h-8 w-8 text-blue-600" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                <span className="ml-3 text-sm text-gray-600">Loading notifications...</span>
              </div>
            )}

            {panelError && (
              <div
                className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded m-4 text-sm"
                role="alert"
                aria-live="polite"
              >
                {panelError}
              </div>
            )}

            {/* Notifications listing */}
            {!notificationsLoading && !notificationsFetching && !panelError && (
              <>
                {(!notifList || notifList.length === 0) ? (
                  <div className="flex flex-1 flex-col items-center justify-center py-12 px-4 text-center">
                    <svg className="w-12 h-12 mx-auto text-gray-300" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                      <path d="M15 17h5l-1.405-1.405C18.21 15.198 18 14.7 18 14.172V11c0-3.07-1.635-5.64-4.5-6.32V4a1.5 1.5 0 00-3 0v.68C7.635 5.36 6 7.929 6 11v3.172c0 .528-.21 1.026-.595 1.423L4 17h5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <p className="mt-4 text-base text-gray-600">No notifications yet.</p>
                    <p className="text-xs text-gray-500 mt-1">You'll see alerts about orders, reviews, and account activity here.</p>
                  </div>
                ) : (
                  <ul className="divide-y divide-gray-100 min-h-[160px]">
                    {notifList.map((n) => {
                      // Type icon map
                      let meta =
                        typeMeta[n.type as keyof typeof typeMeta] ??
                        typeMeta.default;

                      // Sanitize string for accessibility
                      const safeContent =
                        typeof n.content === "string"
                          ? n.content.replace(/<\/?[^>]+(>|$)/g, "")
                          : "";

                      const createdDate = new Date(n.created_at).toLocaleString(undefined, {
                        hour: "2-digit",
                        minute: "2-digit",
                        month: "short",
                        day: "numeric",
                      });

                      // Route for context/Link wrapping
                      let href: string | null = null;
                      if (n.related_entity_type && n.related_entity_id) {
                        switch (n.related_entity_type) {
                          case "order":
                          case "orders":
                            href = `/orders/${n.related_entity_id}`;
                            break;
                          case "product":
                          case "products":
                            href = `/products/${n.related_entity_id}`;
                            break;
                          case "review":
                          case "reviews":
                            href = "/admin/reviews";
                            break;
                          case "bulk_import":
                            href = "/admin/products";
                            break;
                          default:
                            href = null;
                        }
                      }

                      const notificationInner = (
                        <div
                          className={`flex items-start w-full py-4 px-4 gap-3 cursor-pointer group
                              ${!n.is_read ? "bg-blue-50" : "hover:bg-gray-50"}
                            `}
                          tabIndex={0}
                          aria-label={`Notification: ${safeContent}`}
                          onClick={(e) => {
                            e.preventDefault();
                            if (!n.is_read) markAsReadMutation.mutate(n.notification_id);
                            if (href) window.location.href = href;
                          }}
                        >
                          {/* Type & read/unread */}
                          <div className="pt-1 flex-shrink-0">
                            {meta.icon}
                            {!n.is_read && (
                              <span className="block mt-1 ml-1 h-2 w-2 rounded-full bg-blue-500" aria-label="Unread"></span>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className={`text-xs inline-block ${meta.color} px-2 py-0.5 rounded-full mr-2`}>
                              {meta.label}
                            </span>
                            <span
                              className={`block text-gray-900 text-sm font-medium ${!n.is_read ? "" : "opacity-70"}`}
                            >
                              {safeContent}
                            </span>
                            <span className="block text-xs text-gray-500 font-mono mt-0.5">
                              {createdDate}
                            </span>
                          </div>
                          {/* Mark as read */}
                          {!n.is_read && (
                            <button
                              className="ml-2 px-2 py-1 rounded text-xs font-medium text-blue-600 hover:bg-blue-100 transition"
                              disabled={markAsReadMutation.isPending}
                              aria-label="Mark as read"
                              tabIndex={0}
                              onClick={(e) => {
                                e.stopPropagation();
                                markAsReadMutation.mutate(n.notification_id);
                              }}
                            >
                              Mark read
                            </button>
                          )}
                        </div>
                      );

                      // If has target, wrap in Link, else in div
                      if (href) {
                        return (
                          <li key={n.notification_id}>
                            <Link
                              to={href}
                              tabIndex={0}
                              aria-label={safeContent}
                              className="no-underline"
                              onClick={() => {
                                if (!n.is_read) markAsReadMutation.mutate(n.notification_id);
                              }}
                            >
                              {notificationInner}
                            </Link>
                          </li>
                        );
                      } else {
                        return (
                          <li key={n.notification_id}>
                            {notificationInner}
                          </li>
                        );
                      }
                    })}
                  </ul>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default GV_NotificationCenter;