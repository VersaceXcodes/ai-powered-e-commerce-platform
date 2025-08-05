import React, { useEffect, useState, useRef } from 'react';
import { useAppStore } from '@/store/main';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { Link } from 'react-router-dom';

// --- ZOD types (for type safety, not actual runtime validation here) ---
import { z } from 'zod';
import { notificationSchema, notificationListResponseSchema } from '@schema'; // pretend these are available like so

// If not available, redefinition for TS usability
export interface Notification {
  notification_id: string;
  user_id: string | null;
  content: string;
  type: string;
  is_read: boolean;
  related_entity_type: string | null;
  related_entity_id: string | null;
  created_at: string;
}

// ---- API interaction ----
const API_BASE = `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}`;

// --- Helpers ---
function getEntityAdminLink(type: string | null, id: string | null): string | null {
  if (!type || !id) return null;
  switch (type) {
    case 'order':
      return `/admin/orders/${id}`;
    case 'product':
      return `/admin/products/${id}`;
    case 'review':
      // We use /admin/reviews?query={review_id} to filter by review (MVP), but no direct row nav.
      return `/admin/reviews?query=${encodeURIComponent(id)}`;
    default:
      return null;
  }
}

function formatDateTime(dt: string): string {
  // e.g. 2024-06-12T03:32:00Z => "Jun 12, 2024 03:32"
  try {
    const dat = new Date(dt);
    return dat.toLocaleString(undefined, { 
      year: 'numeric', month: 'short', day: 'numeric', 
      hour: '2-digit', minute: '2-digit'
    });
  } catch {
    return dt;
  }
}

// ---- Component ----

const UV_Admin_Notifications: React.FC = () => {
  // ------ GLOBAL STATE -----
  const currentUserId = useAppStore(s => s.authentication_state.current_user?.user_id);
  const authToken = useAppStore(s => s.authentication_state.auth_token);
  const realtimeNotifications = useAppStore(s => s.notification_state.notifications);
  const realtimeUnreadCount = useAppStore(s => s.notification_state.unread_count);
  const setNotificationState = useAppStore(s => s.set_notification_state);

  // ------ LOCAL STATE -----
  const [selectedNotificationId, setSelectedNotificationId] = useState<string | null>(null);
  const [notificationsError, setNotificationsError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [isLoadingBulkMark, setIsLoadingBulkMark] = useState(false);
  const [showAll, setShowAll] = useState(false);

  // ---- REACT QUERY -----
  const queryClient = useQueryClient();

  // Fetch notifications
  const {
    data: notifData,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery<{
    notifications: Notification[];
    total: number;
  }, Error>({
    queryKey: ['admin-notifications', currentUserId], // will refetch on user change
    queryFn: async () => {
      if (!authToken || !currentUserId) throw new Error('Missing authentication');
      const resp = await axios.get(
        `${API_BASE}/notifications`,
        {
          params: {
            user_id: currentUserId,
            sort_by: 'created_at',
            sort_order: 'desc',
            limit: 50,
          },
          headers: {
            Authorization: `Bearer ${authToken}`
          }
        }
      );
      // Zod validation for safety (pretend as runtime)
      const parsed = notificationListResponseSchema.safeParse(resp.data);
      if (!parsed.success) throw new Error('Invalid serverside notification data');
      // We sync the global notification_state to newest
      setNotificationState({
        notifications: parsed.data.notifications,
        unread_count: parsed.data.notifications.filter((n: Notification) => !n.is_read).length,
      });
      return parsed.data;
    },
    enabled: !!authToken && !!currentUserId,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: true,
  });

  // Mark as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: async (notification_id: string) => {
      if (!authToken) throw new Error('Missing auth');
      const resp = await axios.patch(
        `${API_BASE}/notifications/${notification_id}/read`,
        { is_read: true },
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
      // Either Zod validation, or trust API response:
      return resp.data as Notification;
    },
    onSuccess: (_data, notification_id) => {
      // Refetch notifications
      queryClient.invalidateQueries({ queryKey: ['admin-notifications', currentUserId] });
    },
    onError: (e: any) => {
      setNotificationsError(e.response?.data?.message || e.message || 'Failed to mark as read');
    }
  });

  // Bulk mark all as read - note, NO batch endpoint, must PATCH each
  const handleBulkMarkAllAsRead = async () => {
    if (!notifData) return;
    setIsLoadingBulkMark(true);
    try {
      // Find all unread notification IDs
      const unreadNotifs = notifData.notifications.filter(n => !n.is_read);
      for (const n of unreadNotifs) {
        // For accessibility: don't hammer server, wait per req. Could optimize with Promise.allSettled but MVP is serial.
        // eslint-disable-next-line no-await-in-loop
        await markAsReadMutation.mutateAsync(n.notification_id);
      }
      // After all, refetch
      queryClient.invalidateQueries({ queryKey: ['admin-notifications', currentUserId] });
    } catch (e: any) {
      setNotificationsError(e.message || "Failed to mark all as read.");
    }
    setIsLoadingBulkMark(false);
  };

  // Real-time sync: If WebSocket delivers updates, show them live. We track the backend as canonical.
  useEffect(() => {
    // If user switches away (or socket pushes new), we want to refetch if counts mismatch.
    // Only trigger if store notifications length > query, i.e. live event
    if (Array.isArray(realtimeNotifications) && notifData && realtimeNotifications.length > notifData.notifications.length) {
      refetch();
    }
    // If unread count changes in realtime and is more recent than query, refetch.
    if (typeof realtimeUnreadCount === 'number' && notifData && realtimeUnreadCount !== notifData.notifications.filter(n => !n.is_read).length) {
      refetch();
    }
  }, [realtimeNotifications, realtimeUnreadCount]);
  
  // ---------- FILTERED LIST -------------
  let notificationsToShow: Notification[] = [];
  if (notifData?.notifications) {
    notificationsToShow = filter === 'all'
      ? notifData.notifications
      : notifData.notifications.filter(n => !n.is_read);
  }

  // --------- PAGING/SHOW MORE ------------
  const SLICE_SIZE = 25;
  const pagedNotifications = showAll
    ? notificationsToShow
    : notificationsToShow.slice(0, SLICE_SIZE);

  // ---------- ERROR BOUNDARY -------------
  const ErrorBoundary: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    // Minimal boundary
    const [hasError, setHasError] = useState(false);
    const [errorInfo, setErrorInfo] = useState<any>(null);
    // useRef to ignore repeated error bounces
    const isMounted = useRef(true);
    useEffect(() => { return () => { isMounted.current = false; }; }, []);
    if (hasError) {
      return (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 mt-4" role="alert" aria-live="polite">
          <h3 className="font-semibold text-red-800 mb-2">Something went wrong</h3>
          <pre className="text-sm text-red-700">{errorInfo?.toString?.() || "Unknown error"}</pre>
        </div>
      );
    }
    // Override child error
    return (
      <React.Suspense fallback={
        <div className="my-10 text-center text-gray-700 animate-pulse">Loading...</div>
      }>
        <ErrorCatcher setHasError={setHasError} setErrorInfo={setErrorInfo}>
          {children}
        </ErrorCatcher>
      </React.Suspense>
    );
  };

  function ErrorCatcher(
    props: { children: React.ReactNode, setHasError: (b: boolean) => void, setErrorInfo: (e: any) => void }
  ) {
    try { return <>{props.children}</>; }
    catch (e) {
      props.setHasError(true);
      props.setErrorInfo(e);
      return null;
    }
  }

  // --- Mark Single Notification as Read ---
  const handleMarkAsRead = (notification_id: string) => {
    setSelectedNotificationId(notification_id);
    setNotificationsError(null);
    markAsReadMutation.mutate(notification_id);
  };

  // --- Handle manual refresh
  const handleManualRefresh = () => {
    setNotificationsError(null);
    refetch();
  };

  // --- Accessibility: aria-live region status ---
  const ariaLiveStatus = notificationsToShow.length === 0
    ? "No notifications."
    : `Showing ${notificationsToShow.length} notification${notificationsToShow.length !== 1 ? 's' : ''}.`;

  // --------- RENDER -----------
  return (
    <>
      <div className="max-w-5xl mx-auto py-8 px-2 sm:px-8">
        <header className="mb-8 flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Admin Notifications Center</h1>
            <p className="text-gray-600 max-w-lg mt-2">Central alert feed for orders, reviews, inventory, and platform events. Real-time, actionable, always up to date.</p>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <button
              type="button"
              className={`flex items-center bg-blue-50 text-blue-700 rounded px-3 py-1 font-medium text-sm border border-blue-200 hover:bg-blue-100 transition focus:outline-none`}
              onClick={handleManualRefresh}
              aria-label="Refresh notifications"
            >
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 20 20"><path d="M4 4v5h.582M19 11A8 8 0 1 1 5 5.197" /></svg>
              Refresh
            </button>
            <button
              type="button"
              onClick={handleBulkMarkAllAsRead}
              disabled={isLoadingBulkMark || !notificationsToShow.some(n => !n.is_read)}
              className={`flex items-center bg-green-50 text-green-700 rounded px-3 py-1 font-medium text-sm border border-green-200 hover:bg-green-100 disabled:opacity-40 transition focus:outline-none`}
              aria-label="Mark all as read"
              tabIndex={0}
            >
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 20 20">
                <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              {isLoadingBulkMark ? "Marking..." : "Mark all as read"}
            </button>
          </div>
        </header>

        <section aria-live="polite" className="mb-4">
          <div className="flex gap-2 mb-2">
            <button
              type="button"
              className={`px-3 py-1 rounded text-sm font-medium ${filter === 'all' ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"} transition`}
              onClick={() => setFilter('all')}
              aria-label="Show all notifications"
              tabIndex={0}
            >All</button>
            <button
              type="button"
              className={`px-3 py-1 rounded text-sm font-medium ${filter === 'unread' ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"} transition`}
              onClick={() => setFilter('unread')}
              aria-label="Show only unread notifications"
              tabIndex={0}
            >
              Unread
              {notifData?.notifications?.some(n => !n.is_read) && (
                <span className="inline-flex items-center ml-1 px-1.5 py-0.5 text-xs font-semibold rounded-full bg-red-50 text-red-800 border border-red-100">
                  {notifData.notifications.filter(n => !n.is_read).length}
                </span>
              )}
            </button>
          </div>
          <div className="text-xs text-gray-500" aria-live="polite">{ariaLiveStatus}</div>
        </section>

        <ErrorBoundary>
          <div className="bg-white rounded shadow border border-gray-200 divide-y divide-gray-100">
            {isError || notificationsError ? (
              <div className="p-8 text-center text-red-700" aria-live="polite">
                <div className="mb-2 font-semibold">Failed to load notifications</div>
                <div>{(error as Error)?.message || notificationsError}</div>
                <button type="button" onClick={handleManualRefresh}
                  className="mt-2 inline-block bg-blue-100 rounded px-3 py-1 text-blue-800 font-medium text-sm hover:bg-blue-200"
                  aria-label="Retry">
                  Retry
                </button>
              </div>
            ) : isLoading || isFetching ? (
              <div className="w-full flex justify-center py-16 text-gray-600 animate-pulse">
                <svg className="animate-spin h-7 w-7 text-blue-600 mr-2" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Loading notifications...
              </div>
            ) : pagedNotifications.length === 0 ? (
              <div className="p-12 text-center text-gray-500">
                <svg className="mx-auto mb-4 w-16 h-16 text-gray-200" viewBox="0 0 40 40" fill="none"><circle cx="20" cy="20" r="20" fill="currentColor"/><path d="M14 20h12M20 14v12" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round"/></svg>
                <div className="font-medium">No {filter === 'unread' ? 'unread ' : ''}notifications found.</div>
                <div className="text-sm mt-1 text-gray-400">You're all caught up! 🎉</div>
              </div>
            ) : (
              <>
                <ul className="divide-y divide-gray-50">
                  {pagedNotifications.map((notif) => {
                    const link = getEntityAdminLink(notif.related_entity_type, notif.related_entity_id);
                    const isUnread = !notif.is_read;
                    return (
                      <li key={notif.notification_id} className="flex items-start justify-between px-5 py-4 hover:bg-blue-50/30 transition shadow-none">
                        <div className={`flex flex-col sm:flex-row sm:items-center flex-1 gap-2`}>
                          {/* ICON by notif type */}
                          <span className="mr-2 mt-1 sm:mt-0">
                            {notif.type === 'order' ? (
                              <svg className="w-7 h-7 text-blue-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 40 40"><rect x="5" y="13" width="30" height="18" rx="4" stroke="currentColor" strokeWidth="2" /><path d="M10 13v-2a5 5 0 015-5h10a5 5 0 015 5v2" stroke="currentColor" strokeWidth="2" /></svg>
                            ) : notif.type === 'review' ? (
                              <svg className="w-7 h-7 text-yellow-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 40 40"><path d="M20 32l-6.16 3.24 1.18-6.88-5-4.87 6.92-1 3.09-6.26 3.09 6.26 6.92 1-5 4.87 1.18 6.88z" stroke="currentColor" strokeWidth="2"/></svg>
                            ) : notif.type === 'inventory' ? (
                              <svg className="w-7 h-7 text-orange-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 40 40"><rect x="9" y="9" width="22" height="22" rx="3" stroke="currentColor" strokeWidth="2"/><path d="M13 27v-4a4 4 0 014-4h6a4 4 0 014 4v4" stroke="currentColor" strokeWidth="2"/></svg>
                            ) : (
                              <svg className="w-7 h-7 text-gray-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 40 40"><circle cx="20" cy="20" r="16" stroke="currentColor" strokeWidth="2"/><path d="M20 12v8l4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                            )}
                          </span>
                          {/* Content details */}
                          <div className={`flex-1 min-w-0 ${isUnread ? 'font-semibold text-gray-900' : 'text-gray-600'}`}>
                            {link
                              ? <Link 
                                  to={link}
                                  className={`hover:underline focus:outline-none`}
                                >
                                  <span>{notif.content}</span>
                                  {notif.related_entity_type && notif.related_entity_id && (
                                    <span className="sr-only">{` Open ${notif.related_entity_type} ${notif.related_entity_id}`}</span>
                                  )}
                                </Link>
                              : <span>{notif.content}</span>
                            }
                            <div className="text-xs text-gray-400 mt-1">
                              {formatDateTime(notif.created_at)}
                            </div>
                          </div>
                        </div>
                        {/* Action buttons/group */}
                        <div className="ml-3 flex flex-col items-end justify-center gap-y-1">
                          {isUnread && (
                            <button
                              type="button"
                              className={`inline-flex items-center px-2 py-1 rounded-md bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 focus:outline-none transition shadow-sm mt-1`}
                              aria-label="Mark notification as read"
                              onClick={() => handleMarkAsRead(notif.notification_id)}
                              disabled={markAsReadMutation.isLoading && selectedNotificationId === notif.notification_id}
                              tabIndex={0}
                            >
                              {markAsReadMutation.isLoading && selectedNotificationId === notif.notification_id ? (
                                <svg className="animate-spin w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                              ) : (
                                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 20 20"><path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round"/></svg>
                              )}
                              Mark as read
                            </button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
                {/* Show more button for >SLICE_SIZE */}
                {notificationsToShow.length > SLICE_SIZE && (
                  <div className="flex justify-center py-4">
                    {!showAll ? (
                      <button
                        type="button"
                        className="px-5 py-2 rounded-md bg-blue-100 text-blue-700 hover:bg-blue-200 text-sm font-medium shadow-sm transition"
                        onClick={() => setShowAll(true)}
                        aria-label="Show all notifications"
                        tabIndex={0}
                      >
                        Show all ({notificationsToShow.length})
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="px-5 py-2 rounded-md bg-gray-100 text-gray-600 hover:bg-gray-200 text-sm font-medium shadow-sm transition"
                        onClick={() => setShowAll(false)}
                        aria-label="Show less notifications"
                        tabIndex={0}
                      >
                        Show less
                      </button>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </ErrorBoundary>
      </div>
    </>
  );
};

export default UV_Admin_Notifications;