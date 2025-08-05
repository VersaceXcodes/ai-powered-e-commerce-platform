import React, { useEffect, useState, useCallback, useRef } from "react";
import { useAppStore } from "@/store/main";
import { Link } from "react-router-dom";

type NotificationEntity = {
  notification_id: string;
  user_id: string | null;
  content: string;
  type: string;
  is_read: boolean;
  created_at: string;
  related_entity_type?: string | null;
  related_entity_id?: string | null;
};

// Mapping entity types to routes (expand as needed)
function getNotificationLink(
  notification: NotificationEntity,
  userRole: string | undefined
): string | null {
  if (
    notification.related_entity_type === "order" &&
    notification.related_entity_id
  ) {
    // User orders or Admin/Vendor orders (conservative; link to user order for now)
    return `/orders/${notification.related_entity_id}`;
  }
  if (
    notification.related_entity_type === "product" &&
    notification.related_entity_id
  ) {
    return `/products/${notification.related_entity_id}`;
  }
  if (
    notification.related_entity_type === "review" &&
    userRole === "admin"
  ) {
    // Admin review moderation goes to reviews page (optionally could scroll/focus)
    return `/admin/reviews`;
  }
  if (
    notification.related_entity_type === "bulk_import" &&
    userRole === "admin"
  ) {
    return `/admin/notifications`; // Or a more specific admin imports/notifications view
  }
  // fallback: no link
  return null;
}

// Max number of toasts at a time
const MAX_TOASTS = 4;
const TOAST_TIMEOUT = 6000; // 6s

const GV_NotificationToasts: React.FC = () => {
  // --- Global selectors (CRITICAL: individual selectors only!) ---
  const notifications = useAppStore(
    (state) => state.notification_state.notifications
  );
  const currentUser = useAppStore(
    (state) => state.authentication_state.current_user
  );

  // --- Local UI state for queue/visible toasts ---
  const [toastQueue, setToastQueue] = useState<string[]>([]);
  const timersRef = useRef<{ [nid: string]: NodeJS.Timeout }>({});

  // On notifications update: add newest notifications to queue
  useEffect(() => {
    // Only show up to the most recent MAX_TOASTS toasts
    const toShow: string[] = [];
    for (let i = 0, shown = 0; i < notifications.length && shown < MAX_TOASTS; i++) {
      const nid = notifications[i].notification_id;
      if (!toShow.includes(nid)) {
        toShow.push(nid);
        shown++;
      }
    }
    setToastQueue((q) => {
      // If a new notification appeared that's not in queue, append to front.
      // Always trim to MAX_TOASTS
      if (
        JSON.stringify(q.slice(0, MAX_TOASTS)) !== JSON.stringify(toShow.slice(0, MAX_TOASTS))
      ) {
        return toShow.slice(0, MAX_TOASTS);
      }
      return q;
    });
    // eslint-disable-next-line
  }, [notifications]);

  // Set up individual timers for each toast
  useEffect(() => {
    // Remove any timer for toasts that have fallen out of the queue
    for (const key of Object.keys(timersRef.current)) {
      if (!toastQueue.includes(key)) {
        clearTimeout(timersRef.current[key]);
        delete timersRef.current[key];
      }
    }
    // For each toast in the queue, set a dismissal timer if not already set
    toastQueue.forEach((nid) => {
      if (!timersRef.current[nid]) {
        timersRef.current[nid] = setTimeout(() => {
          setToastQueue((q) => q.filter((id) => id !== nid));
        }, TOAST_TIMEOUT);
      }
    });
    // Cleanup on component unmount
    return () => {
      Object.values(timersRef.current).forEach((t) => clearTimeout(t));
      timersRef.current = {};
    };
    // eslint-disable-next-line
  }, [toastQueue]);

  // Dismiss toast manually (click X or ESC)
  const dismissToast = useCallback((notification_id: string) => {
    setToastQueue((q) => q.filter((id) => id !== notification_id));
    if (timersRef.current[notification_id]) {
      clearTimeout(timersRef.current[notification_id]);
      delete timersRef.current[notification_id];
    }
  }, []);

  // ESC to dismiss topmost
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && toastQueue.length > 0) {
        dismissToast(toastQueue[0]);
      }
    };
    window.addEventListener("keydown", onKeyDown, { passive: true });
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [toastQueue, dismissToast]);

  // Pause auto-dismiss on hover/focus (Mouse events per-toast)
  const [pauseTimers, setPauseTimers] = useState<{ [k: string]: boolean }>({});

  // Find notification entity (from global state, never rely on stale objects)
  const getNotification = (nid: string): NotificationEntity | undefined =>
    notifications.find((n) => n.notification_id === nid);

  // Utility: format date/time for accessibility (optional)
  function timeAgo(time: string) {
    // seconds/mins/hours ago
    const now = Date.now();
    const t = new Date(time).getTime();
    const delta = Math.round((now - t) / 1000);
    if (delta < 60) return `${delta}s ago`;
    if (delta < 3600) return `${Math.floor(delta / 60)}m ago`;
    if (delta < 86400) return `${Math.floor(delta / 3600)}h ago`;
    return new Date(time).toLocaleDateString();
  }

  // Type-based style mapping (success/info/error/warning/other)
  function getToastStyle(type?: string) {
    if (!type) {
      return "bg-gray-900 text-white border-gray-600";
    }
    if (
      ["order_status", "success", "info"].includes(type) ||
      type.startsWith("order")
    ) {
      return "bg-green-600 text-white border-green-700";
    }
    if (
      ["error", "fail", "failure"].includes(type) ||
      type.includes("error")
    ) {
      return "bg-red-600 text-white border-red-700";
    }
    if (
      ["warning", "low_inventory", "warn"].includes(type) ||
      type.includes("warning")
    ) {
      return "bg-yellow-500 text-black border-yellow-700";
    }
    // fallback: blue info
    return "bg-blue-600 text-white border-blue-700";
  }

  return (
    <>
      <div
        className="fixed z-[100] right-4 top-4 sm:top-6 max-w-sm space-y-2 sm:space-y-3 pointer-events-none"
        aria-live="polite"
        aria-atomic="true"
        style={{ minWidth: "288px" }}
      >
        {toastQueue.map((nid) => {
          const notif = getNotification(nid);
          if (!notif) return null;

          const linkTo =
            getNotificationLink(notif, currentUser?.role) ?? undefined;
          const typeStyle = getToastStyle(notif.type);

          return (
            <div
              key={nid}
              tabIndex={0}
              role="status"
              aria-live="polite"
              className={`pointer-events-auto shadow-lg overflow-hidden border-2 rounded-lg transition transform-gpu duration-300 ease-in-out
                ${typeStyle} animate-fadein
                focus:ring-2 focus:ring-blue-400 outline-none`}
              style={{
                opacity: pauseTimers[nid] ? 1 : 1,
                transition: "opacity .25s",
                animation: "fade-in .4s cubic-bezier(.21,1.02,.73,1) both",
              }}
              onMouseEnter={() => {
                setPauseTimers((p) => ({ ...p, [nid]: true }));
                if (timersRef.current[nid]) {
                  clearTimeout(timersRef.current[nid]);
                  delete timersRef.current[nid];
                }
              }}
              onMouseLeave={() => {
                setPauseTimers((p) => ({ ...p, [nid]: false }));
                // set timer from now if not already scheduled
                if (!timersRef.current[nid]) {
                  timersRef.current[nid] = setTimeout(() => {
                    dismissToast(nid);
                  }, TOAST_TIMEOUT);
                }
              }}
              onFocus={() => {
                setPauseTimers((p) => ({ ...p, [nid]: true }));
                if (timersRef.current[nid]) {
                  clearTimeout(timersRef.current[nid]);
                  delete timersRef.current[nid];
                }
              }}
              onBlur={() => {
                setPauseTimers((p) => ({ ...p, [nid]: false }));
                if (!timersRef.current[nid]) {
                  timersRef.current[nid] = setTimeout(() => {
                    dismissToast(nid);
                  }, TOAST_TIMEOUT);
                }
              }}
            >
              <div className="flex items-start justify-between px-4 py-3 relative">
                <div className="flex-1 min-w-0 pr-2">
                  <div className="flex items-center gap-2">
                    {/* Icon based on type */}
                    <span
                      className="inline-flex flex-shrink-0"
                      aria-hidden="true"
                    >
                      {notif.type.includes("error") ? (
                        <svg
                          className="h-5 w-5 text-white"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          viewBox="0 0 24 24"
                          aria-hidden="true"
                        >
                          <circle
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="2"
                            fill="#ef4444"
                          />
                          <path
                            d="M8 12h8M12 8v8"
                            stroke="white"
                            strokeWidth="2"
                            strokeLinecap="round"
                          />
                        </svg>
                      ) : notif.type.includes("warning") ? (
                        <svg
                          className="h-5 w-5 text-black"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          viewBox="0 0 24 24"
                          aria-hidden="true"
                        >
                          <polygon
                            points="12,2 2,22 22,22"
                            fill="#fbbf24"
                            stroke="#b45309"
                            strokeWidth="2"
                          />
                          <circle cx="12" cy="16" r="1" fill="#b45309" />
                          <rect
                            x="11"
                            y="8"
                            width="2"
                            height="5"
                            fill="#b45309"
                          />
                        </svg>
                      ) : notif.type.includes("success") ||
                        notif.type === "order_status" ? (
                        <svg
                          className="h-5 w-5 text-white"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          aria-hidden="true"
                        >
                          <circle
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="2"
                            fill="#16a34a"
                          />
                          <path
                            d="M8 12l2 2 4-4"
                            stroke="white"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      ) : (
                        <svg
                          className="h-5 w-5 text-white"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          aria-hidden="true"
                        >
                          <circle
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="2"
                            fill="#2563eb"
                          />
                          <path
                            d="M12 16v-4m0-4h.01"
                            stroke="white"
                            strokeWidth="2"
                            strokeLinecap="round"
                          />
                        </svg>
                      )}
                    </span>
                    {/* Toast message (sanitize before display) */}
                    <div className="text-base font-medium leading-snug break-words text-white">
                      {linkTo ? (
                        <Link
                          to={linkTo}
                          className="underline font-semibold hover:text-blue-100 focus:text-blue-200 outline-none"
                          tabIndex={0}
                          aria-label="View details"
                        >
                          {notif.content}
                        </Link>
                      ) : (
                        notif.content
                      )}
                    </div>
                  </div>
                  {/* Timestamp */}
                  <div className="text-xs text-white/80 mt-1 font-mono">
                    {timeAgo(notif.created_at)}
                  </div>
                </div>
                <button
                  className="ml-2 p-1 rounded hover:bg-white/10 focus:bg-white/20 focus:outline-none transition"
                  aria-label="Dismiss notification"
                  tabIndex={0}
                  onClick={() => dismissToast(nid)}
                  style={{ pointerEvents: "auto" }} // Enable in stacking toasts
                >
                  <svg
                    className="h-4 w-4 text-white"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      d="M6 18L18 6M6 6l12 12"
                      stroke="white"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
              </div>
            </div>
          );
        })}
      </div>
      {/* Fade-in animation (inline for strictness) */}
      <style>
        {`
          @keyframes fade-in {
            0% { opacity:0; transform: translateY(-12px);}
            100% { opacity:1; transform: none;}
          }
        `}
      </style>
    </>
  );
};

export default GV_NotificationToasts;