import React, { useEffect, useState, useMemo } from "react";
import axios from "axios";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAppStore } from "@/store/main";
import { User } from "@schema"; // type, not used for runtime validation
import { Link } from "react-router-dom";

// Constants
const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";
const ROLES = ["admin", "vendor", "customer"] as const;
const STATUS_OPTIONS = [
  { value: undefined, label: "All" },
  { value: false, label: "Active" },
  { value: true, label: "Blocked" },
];
const SORT_COLUMNS = [
  { value: "created_at", label: "Created" },
  { value: "name", label: "Name" },
  { value: "email", label: "Email" },
];
const SORT_ORDERS = [
  { value: "desc", label: "↓ Desc" },
  { value: "asc", label: "↑ Asc" },
];
const PAGE_SIZE = 20;

// --- View Logic ---

const UV_Admin_Users: React.FC = () => {
  // Global store: authentication state selectors (ALWAYS individual selectors)
  const authToken = useAppStore((s) => s.authentication_state.auth_token);
  const currentUser = useAppStore((s) => s.authentication_state.current_user);

  // Local state (table filters, selection, modal, etc)
  const [filters, setFilters] = useState<{
    role?: string;
    is_blocked?: boolean;
    query?: string;
    sort_by: string;
    sort_order: string;
    limit: number;
    offset: number;
  }>({
    role: undefined,
    is_blocked: undefined,
    query: "",
    sort_by: "created_at",
    sort_order: "desc",
    limit: PAGE_SIZE,
    offset: 0,
  });

  const [page, setPage] = useState(1);
  const [bulkSelected, setBulkSelected] = useState<string[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [modalUser, setModalUser] = useState<User | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingUserAction, setPendingUserAction] = useState<{
    user_id: string;
    type: "block" | "unblock" | "role";
    newRole?: string;
  } | null>(null);
  const [pendingBulkType, setPendingBulkType] = useState<"block" | "unblock" | "role" | null>(null);
  const [pendingBulkRole, setPendingBulkRole] = useState<string | undefined>(undefined);

  // Error boundary for action UI
  const [tableError, setTableError] = useState<string | null>(null);

  // REACT-QUERY: QueryClient
  const queryClient = useQueryClient();

  // --- Data fetching: USER TABLE ---
  const {
    data: userData,
    isLoading,
    isFetching,
    error: userListError,
    refetch,
  } = useQuery<{
    users: User[];
    total: number;
  }, Error>({
    queryKey: [
      "admin_users",
      filters.role,
      filters.is_blocked,
      filters.query,
      filters.sort_by,
      filters.sort_order,
      filters.limit,
      filters.offset,
    ],
    queryFn: async () => {
      setTableError(null);
      const params: any = {
        limit: filters.limit,
        offset: filters.offset,
        sort_by: filters.sort_by,
        sort_order: filters.sort_order,
      };
      if (filters.role) params.role = filters.role;
      if (filters.is_blocked !== undefined) params.is_blocked = filters.is_blocked;
      if (filters.query) params.query = filters.query.trim();
      const resp = await axios.get(`${API_BASE}/users`, {
        params,
        headers: { Authorization: `Bearer ${authToken}` },
      });
      return resp.data;
    },
    keepPreviousData: true,
    retry: 1,
    enabled: !!authToken,
    onError: (err: any) => {
      setTableError(
        typeof err?.response?.data?.message === "string"
          ? err.response.data.message
          : "Failed to load users."
      );
    },
  });

  // --- Modal: Load selected user inline quickview ---
  useEffect(() => {
    if (!selectedUserId || !modalOpen) {
      setModalUser(null);
      return;
    }
    let cancelled = false;
    setModalUser(null);
    axios
      .get(`${API_BASE}/users/${selectedUserId}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      })
      .then((resp) => {
        if (!cancelled) setModalUser(resp.data);
      })
      .catch(() => {
        if (!cancelled)
          setModalUser(null);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedUserId, modalOpen, authToken]);

  // --- Pagination: data and logic ---
  const total = userData?.total || 0;
  const users = userData?.users || [];
  const pageCount = Math.ceil(total / PAGE_SIZE);

  // Update filters.offset to match page
  useEffect(() => {
    setFilters((prev) => ({
      ...prev,
      offset: (page - 1) * PAGE_SIZE,
    }));
  }, [page]);

  // When filters change other than page, reset to page 1
  useEffect(() => {
    setPage(1);
  }, [
    filters.role,
    filters.is_blocked,
    filters.query,
    filters.sort_by,
    filters.sort_order,
  ]);

  // --- Mutations: Single User Block/Unblock ---
  const blockUserMutation = useMutation<
    User,
    Error,
    { user_id: string; is_blocked: boolean }
  >(
    async (payload) => {
      const res = await axios.patch(
        `${API_BASE}/users/${payload.user_id}/block`,
        { is_blocked: payload.is_blocked },
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
      return res.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["admin_users"] });
        setPendingUserAction(null);
        setActionError(null);
      },
      onError: (err: any) => {
        setActionError(typeof err?.response?.data?.message === "string"
          ? err.response.data.message
          : "Failed to update user block status.");
      },
    }
  );

  // --- Mutations: Single Role Change ---
  const changeRoleMutation = useMutation<
    User,
    Error,
    { user_id: string; newRole: string }
  >(
    async ({ user_id, newRole }) => {
      const payload = { user_id, role: newRole };
      const res = await axios.put(
        `${API_BASE}/profile`,
        payload,
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
      return res.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["admin_users"] });
        setPendingUserAction(null);
        setActionError(null);
      },
      onError: (err: any) => {
        setActionError(typeof err?.response?.data?.message === "string"
          ? err.response.data.message
          : "Failed to update role.");
      },
    }
  );

  // --- Bulk Mutations: Block/Unblock ---
  const [bulkState, setBulkState] = useState<{
    running: boolean;
    error: string | null;
    completed: number;
    total: number;
  }>({ running: false, error: null, completed: 0, total: 0 });

  const runBulkBlock = async (is_blocked: boolean) => {
    setBulkState({ running: true, error: null, completed: 0, total: bulkSelected.length });
    for (let i = 0; i < bulkSelected.length; ++i) {
      const user_id = bulkSelected[i];
      try {
        await axios.patch(
          `${API_BASE}/users/${user_id}/block`,
          { is_blocked },
          { headers: { Authorization: `Bearer ${authToken}` } }
        );
        setBulkState((prev) => ({ ...prev, completed: prev.completed + 1 }));
      } catch (err: any) {
        setBulkState((prev) => ({
          ...prev,
          error:
            prev.error ||
            (typeof err?.response?.data?.message === "string"
              ? err.response.data.message
              : `Couldn't block/unblock user ${user_id}.`),
        }));
      }
    }
    setBulkState((prev) => ({ ...prev, running: false }));
    setBulkSelected([]);
    queryClient.invalidateQueries({ queryKey: ["admin_users"] });
  };

  const runBulkRole = async (newRole: string) => {
    setBulkState({ running: true, error: null, completed: 0, total: bulkSelected.length });
    for (let i = 0; i < bulkSelected.length; ++i) {
      const user_id = bulkSelected[i];
      try {
        await axios.put(
          `${API_BASE}/profile`,
          { user_id, role: newRole },
          { headers: { Authorization: `Bearer ${authToken}` } }
        );
        setBulkState((prev) => ({ ...prev, completed: prev.completed + 1 }));
      } catch (err: any) {
        setBulkState((prev) => ({
          ...prev,
          error:
            prev.error ||
            (typeof err?.response?.data?.message === "string"
              ? err.response.data.message
              : `Couldn't change role for user ${user_id}.`),
        }));
      }
    }
    setBulkState((prev) => ({ ...prev, running: false }));
    setBulkSelected([]);
    queryClient.invalidateQueries({ queryKey: ["admin_users"] });
  };

  // --- Handler: Table filter input ---
  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFilters((f) => ({ ...f, query: e.target.value }));
  };
  // Handle pressing Enter in search
  const handleQueryEnter = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      refetch();
    }
  };

  // --- Handler: Bulk Selection ---
  const allVisibleUserIds = useMemo(() => users.map((u) => u.user_id), [users]);
  const isAllSelected = allVisibleUserIds.length > 0 && allVisibleUserIds.every(id => bulkSelected.includes(id));

  // --- Role/Block/Unblock Disabled (for self-management) ---
  const isSelf = (user: User) => !!currentUser && currentUser.user_id === user.user_id;

  // --- Modal open logic ---
  const openUserModal = (user_id: string) => {
    setSelectedUserId(user_id);
    setModalOpen(true);
    setActionError(null);
  };

  // -- UI START -- 
  return (
    <>
      {/* Topbar / Header */}
      <div className="max-w-7xl mx-auto px-4 py-6 flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-extrabold text-gray-900">User Management</h1>
          <button
            className="ml-2 p-2 rounded-full border border-gray-200 hover:bg-gray-100 text-gray-500 focus:outline-none"
            aria-label="Refresh"
            onClick={() => refetch()}
            tabIndex={0}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v6h6M20 20v-6h-6M5 19A9 9 0 1 1 12 3v0a9 9 0 0 1 7 16.32"/>
            </svg>
          </button>
        </div>
        <div className="mt-4 sm:mt-0 flex flex-wrap gap-3 items-center">
          <label htmlFor="role-filter" className="sr-only">Role</label>
          <select
            id="role-filter"
            className="border rounded px-2 py-1 text-sm focus:ring-blue-500 focus:border-blue-500"
            value={filters.role || ""}
            onChange={e => setFilters(f => ({ ...f, role: e.target.value || undefined }))}
            aria-label="Filter by role"
            tabIndex={0}
          >
            <option value="">All Roles</option>
            {ROLES.map(r => (
              <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
            ))}
          </select>
          <label htmlFor="status-filter" className="sr-only">Status</label>
          <select
            id="status-filter"
            className="border rounded px-2 py-1 text-sm focus:ring-blue-500 focus:border-blue-500"
            value={filters.is_blocked === undefined ? "" : filters.is_blocked ? "blocked" : "active"}
            onChange={e => {
              if (e.target.value === "") setFilters(f => ({ ...f, is_blocked: undefined }));
              else setFilters(f => ({ ...f, is_blocked: e.target.value === "blocked" ? true : false }));
            }}
            aria-label="Filter by status"
            tabIndex={0}
          >
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="blocked">Blocked</option>
          </select>
          <label htmlFor="search-users" className="sr-only">Search</label>
          <input
            type="search"
            id="search-users"
            className="border rounded px-2 py-1 text-sm w-40 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Search name/email"
            value={filters.query}
            onChange={e => {
              setFilters(f => ({ ...f, query: e.target.value }));
              setPage(1);
            }}
            onKeyDown={handleQueryEnter}
            tabIndex={0}
            aria-label="Search users"
          />
          <select
            id="sort-col"
            className="border rounded px-2 py-1 text-sm focus:ring-blue-500 focus:border-blue-500"
            value={filters.sort_by}
            onChange={e => setFilters(f => ({ ...f, sort_by: e.target.value }))}
            aria-label="Sort by"
            tabIndex={0}
          >
            {SORT_COLUMNS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </select>
          <select
            id="sort-order"
            className="border rounded px-2 py-1 text-sm focus:ring-blue-500 focus:border-blue-500"
            value={filters.sort_order}
            onChange={e => setFilters(f => ({ ...f, sort_order: e.target.value }))}
            aria-label="Sort order"
            tabIndex={0}
          >
            {SORT_ORDERS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </select>
        </div>
      </div>

      {/* Bulk Toolbar */}
      {(bulkSelected.length > 0) && (
        <div className="max-w-7xl mx-auto px-4 pb-2">
          <div className="bg-blue-50 border border-blue-200 p-2 rounded flex items-center gap-3 justify-between">
            <span className="text-sm text-blue-700">{bulkSelected.length} selected</span>
            <div className="flex gap-2 items-center">
              <button
                onClick={() => {
                  setPendingBulkType("block");
                  setBulkState({ running: false, error: null, completed: 0, total: bulkSelected.length });
                }}
                disabled={bulkState.running}
                className="bg-red-700 text-white px-3 py-1 rounded text-sm hover:bg-red-800 focus:outline-none"
              >
                Block
              </button>
              <button
                onClick={() => {
                  setPendingBulkType("unblock");
                  setBulkState({ running: false, error: null, completed: 0, total: bulkSelected.length });
                }}
                disabled={bulkState.running}
                className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700 focus:outline-none"
              >
                Unblock
              </button>
              {/* Bulk role switch */}
              <select
                aria-label="Bulk role change"
                className="border rounded text-sm"
                value={pendingBulkType === "role" ? pendingBulkRole || "" : ""}
                onChange={e => {
                  setPendingBulkType("role");
                  setPendingBulkRole(e.target.value);
                }}
                disabled={bulkState.running}
                tabIndex={0}
              >
                <option value="">Change Role</option>
                {ROLES.map(r =>
                  <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
                )}
              </select>
              <button
                onClick={() => setBulkSelected([])}
                className="ml-4 text-sm text-blue-500 hover:underline"
                aria-label="Clear selection"
              >Clear</button>
            </div>
            {bulkState.running && (
              <span className="inline-flex items-center ml-4 text-blue-600 font-medium">
                <svg className="animate-spin mr-1 w-3 h-3" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={3}></circle>
                  <path className="opacity-60" fill="currentColor" d="M4 12A8 8 0 018 4v2a6 6 0 106 6h2a8 8 0 01-8 8z"/>
                </svg>
                Processing {bulkState.completed}/{bulkState.total}
              </span>
            )}
            {(bulkState.error || (bulkState.completed === bulkState.total && !bulkState.running)) && (
              <p className="text-red-600 text-sm ml-4" aria-live="polite">{bulkState.error || "Bulk action complete"}</p>
            )}
          </div>
        </div>
      )}

      {/* Table error */}
      {tableError && (
        <div className="max-w-7xl mx-auto px-4 pb-2">
          <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm" aria-live="polite">
            {tableError}
          </div>
        </div>
      )}

      {/* Main CONTENT: User TABLE */}
      <div className="max-w-7xl mx-auto px-4 pb-12">
        <div className="overflow-auto bg-white shadow rounded">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-100">
              <tr>
                <th className="pl-4 py-2 w-8">
                  <input
                    type="checkbox"
                    aria-label="Select all users"
                    checked={isAllSelected}
                    onChange={e => {
                      setBulkSelected(e.target.checked ? allVisibleUserIds : []);
                    }}
                    tabIndex={0}
                  />
                </th>
                <th className="py-2 text-left text-xs font-semibold text-gray-500 uppercase">
                  Name
                </th>
                <th className="py-2 text-left text-xs font-semibold text-gray-500 uppercase">Email</th>
                <th className="py-2 text-left text-xs font-semibold text-gray-500 uppercase">Role</th>
                <th className="py-2 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                <th className="py-2 text-left text-xs font-semibold text-gray-500 uppercase">Created</th>
                <th className="py-2 text-center text-xs font-semibold text-gray-500 uppercase w-40">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading || isFetching ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center">
                    <span className="inline-flex items-center gap-2">
                      <svg className="animate-spin h-5 w-5 text-gray-400" viewBox="0 0 24 24">
                        <circle className="opacity-10" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={3}></circle>
                        <path className="opacity-60" fill="currentColor" d="M4 12A8 8 0 018 4v2a6 6 0 106 6h2a8 8 0 01-8 8z"/>
                      </svg>
                      Loading users...
                    </span>
                  </td>
                </tr>
              )
              : users.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-gray-500">
                    No users found for filter/search.
                  </td>
                </tr>
              )
              : users.map(user => (
                <tr key={user.user_id} className="hover:bg-blue-50 group">
                  <td className="pl-4 py-3">
                    <input
                      type="checkbox"
                      checked={bulkSelected.includes(user.user_id)}
                      onChange={e => {
                        if (e.target.checked) {
                          setBulkSelected(bs => bs.includes(user.user_id) ? bs : [...bs, user.user_id]);
                        } else {
                          setBulkSelected(bs => bs.filter(id => id !== user.user_id));
                        }
                      }}
                      aria-label={`Select user ${user.name}`}
                      tabIndex={0}
                    />
                  </td>
                  <td className="py-3 whitespace-nowrap flex items-center gap-2">
                    <button
                      type="button"
                      aria-label={`Open details for ${user.name}`}
                      onClick={() => openUserModal(user.user_id)}
                      className="rounded-full border border-gray-200 p-1 mr-2 focus:outline-none focus:ring-2 focus:ring-blue-600 hover:bg-gray-50"
                      tabIndex={0}
                    >
                      {/* Avatar */}
                      {user.profile_image_url ? (
                        <img src={user.profile_image_url} alt={user.name} className="w-7 h-7 rounded-full object-cover" />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 text-sm font-bold select-none">
                          {user.name?.slice(0, 1).toUpperCase()}
                        </div>
                      )}
                    </button>
                    <span className="font-semibold text-gray-900">{user.name}</span>
                  </td>
                  <td className="py-3 text-gray-700 whitespace-nowrap">{user.email}</td>
                  <td className="py-3 capitalize">
                    <span className={`inline-block px-2 py-1 rounded text-xs bg-gray-100 ${user.role === "admin" ? "text-blue-800 bg-blue-100" : user.role === "vendor" ? "text-violet-700 bg-violet-100" : "text-gray-800"}`}>{user.role}</span>
                  </td>
                  <td className="py-3">
                    <span className={`inline-block px-2 py-1 rounded text-xs ${user.is_blocked ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
                      {user.is_blocked ? "Blocked" : "Active"}
                    </span>
                  </td>
                  <td className="py-3 text-xs text-gray-600 whitespace-nowrap">{new Date(user.created_at).toLocaleDateString()}</td>
                  <td className="py-2 text-center flex gap-2 items-center justify-center">
                    <button
                      className={`rounded px-2 py-1 bg-gray-100 text-gray-600 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs`}
                      aria-label={`View details for ${user.name}`}
                      onClick={() => openUserModal(user.user_id)}
                      tabIndex={0}
                    >
                      Details
                    </button>
                    {/* Role dropdown */}
                    <select
                      value={user.role}
                      disabled={isSelf(user) || user.is_blocked}
                      onChange={e => {
                        setPendingUserAction({ user_id: user.user_id, type: "role", newRole: e.target.value });
                      }}
                      aria-label={`Change role for ${user.name}`}
                      className={`rounded px-1 py-0.5 text-xs border ${isSelf(user) ? "bg-gray-100 text-gray-400" : "bg-white"}`}
                      tabIndex={0}
                    >
                      {ROLES.map(r => (
                        <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
                      ))}
                    </select>
                    {user.is_blocked ? (
                      <button
                        aria-label={`Unblock user ${user.name}`}
                        onClick={() => setPendingUserAction({ user_id: user.user_id, type: "unblock" })}
                        disabled={isSelf(user)}
                        className="rounded px-2 py-1 bg-green-600 text-white hover:bg-green-700 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                        tabIndex={0}
                      >Unblock</button>
                    ) : (
                      <button
                        aria-label={`Block user ${user.name}`}
                        onClick={() => setPendingUserAction({ user_id: user.user_id, type: "block" })}
                        disabled={isSelf(user) || user.role === "admin"}
                        className="rounded px-2 py-1 bg-red-700 text-white hover:bg-red-800 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                        tabIndex={0}
                      >Block</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination Footer */}
      {pageCount > 1 && (
        <div className="max-w-7xl mx-auto px-4 pb-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-sm text-gray-500">{`Showing ${filters.offset + 1}–${Math.min(filters.offset + PAGE_SIZE, total)} of ${total}`}</div>
          <div className="flex gap-1">
            <button
              className="px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 disabled:opacity-45"
              aria-label="Prev page"
              onClick={() => setPage(p => Math.max(p - 1, 1))}
              disabled={page <= 1}
              tabIndex={0}
            >Prev</button>
            <div className="px-2 py-1 text-gray-500">{`Page ${page} / ${pageCount}`}</div>
            <button
              className="px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 disabled:opacity-45"
              aria-label="Next page"
              onClick={() => setPage(p => Math.min(p + 1, pageCount))}
              disabled={page >= pageCount}
              tabIndex={0}
            >Next</button>
          </div>
        </div>
      )}

      {/* --- User QuickView Modal (generic modal in tree, NOT external) --- */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-30 bg-black bg-opacity-30 flex items-center justify-center"
          role="dialog"
          aria-modal="true"
          tabIndex={-1}
          onClick={() => { setModalOpen(false); setModalUser(null); }}
        >
          {/* Trap events to content */}
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md mx-auto p-6 relative"
            onClick={e => e.stopPropagation()}
            tabIndex={0}
          >
            <button
              className="absolute top-3 right-3 text-gray-400 hover:text-gray-600"
              aria-label="Close"
              onClick={() => { setModalOpen(false); setModalUser(null); }}
              tabIndex={0}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
            {!modalUser ? (
              <div className="flex flex-col items-center justify-center min-h-[180px]">
                <svg className="animate-spin h-7 w-7 text-gray-400" viewBox="0 0 24 24">
                  <circle className="opacity-15" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={3}></circle>
                  <path className="opacity-40" fill="currentColor" d="M4 12A8 8 0 018 4v2a6 6 0 106 6h2a8 8 0 01-8 8z"/>
                </svg>
                <span className="mt-2 text-gray-500">Loading user...</span>
              </div>
            ) : (
              <div className="flex flex-col gap-3 items-center text-center">
                {modalUser.profile_image_url ? (
                  <img src={modalUser.profile_image_url} alt={modalUser.name} className="w-16 h-16 rounded-full border object-cover" />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 text-3xl font-bold select-none">
                    {modalUser.name?.slice(0, 1).toUpperCase()}
                  </div>
                )}
                <h2 className="text-xl font-bold text-gray-900">{modalUser.name}</h2>
                <div>
                  <span className="text-sm text-gray-500">{modalUser.email}</span>
                </div>
                <span className={`inline-block mt-0.5 text-xs rounded px-2 py-1 ${modalUser.is_blocked ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
                  {modalUser.is_blocked ? "Blocked" : "Active"}
                </span>
                <span className="inline-block mt-0.5 text-xs bg-gray-100 text-gray-600 rounded px-2 py-1 capitalize">{modalUser.role}</span>
                <div className="w-full border-t my-2"></div>
                <div className="space-y-1 w-full">
                  <div className="text-xs text-gray-400">Joined {new Date(modalUser.created_at).toLocaleDateString()}</div>
                  {/* Additional stats: Optionally add (order/review count) if available */}
                </div>
                <button
                  className="mt-2 px-3 py-1 bg-blue-700 text-white rounded text-sm hover:bg-blue-800"
                  autoFocus
                  onClick={() => setModalOpen(false)}
                  tabIndex={0}
                >Close</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- SINGLE USER ACTION MODALS --- */}
      {(pendingUserAction && (
        <div className="fixed inset-0 z-40 bg-black bg-opacity-30 flex items-center justify-center" role="alertdialog" aria-modal="true">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-sm mx-auto p-6 relative flex flex-col items-center">
            <button
              className="absolute top-3 right-3 text-gray-400 hover:text-gray-600"
              aria-label="Close"
              onClick={() => { setPendingUserAction(null); setActionError(null); }}
              tabIndex={0}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
            {/* Block, Unblock, Role */}
            {pendingUserAction.type === "block" && (
              <>
                <span className="text-xl font-semibold text-gray-900 mb-3">Block User?</span>
                <p className="text-gray-600 mb-4 text-sm">Are you sure you want to <span className="font-bold text-red-700">block</span> this user? They will be logged out immediately.</p>
                {actionError && <div aria-live="polite" className="text-red-700 text-sm mb-2">{actionError}</div>}
                <div className="flex w-full gap-2 justify-end">
                  <button
                    className="bg-gray-100 rounded px-3 py-1 text-gray-500 hover:bg-gray-200"
                    onClick={() => { setPendingUserAction(null); setActionError(null); }}
                    tabIndex={0}
                  >Cancel</button>
                  <button
                    className="bg-red-700 text-white px-3 py-1 rounded hover:bg-red-800"
                    onClick={() => blockUserMutation.mutate({ user_id: pendingUserAction.user_id, is_blocked: true })}
                    disabled={blockUserMutation.isLoading}
                    tabIndex={0}
                  >
                    {blockUserMutation.isLoading ? "Blocking..." : "Confirm"}
                  </button>
                </div>
              </>
            )}
            {pendingUserAction.type === "unblock" && (
              <>
                <span className="text-xl font-semibold text-gray-900 mb-3">Unblock User?</span>
                <p className="text-gray-600 mb-4 text-sm">You are about to <span className="font-bold text-green-700">unblock</span> this user and restore account access.</p>
                {actionError && <div aria-live="polite" className="text-red-700 text-sm mb-2">{actionError}</div>}
                <div className="flex w-full gap-2 justify-end">
                  <button
                    className="bg-gray-100 rounded px-3 py-1 text-gray-500 hover:bg-gray-200"
                    onClick={() => { setPendingUserAction(null); setActionError(null); }}
                    tabIndex={0}
                  >Cancel</button>
                  <button
                    className="bg-green-700 text-white px-3 py-1 rounded hover:bg-green-800"
                    onClick={() => blockUserMutation.mutate({ user_id: pendingUserAction.user_id, is_blocked: false })}
                    disabled={blockUserMutation.isLoading}
                    tabIndex={0}
                  >
                    {blockUserMutation.isLoading ? "Unblocking..." : "Confirm"}
                  </button>
                </div>
              </>
            )}
            {pendingUserAction.type === "role" && (
              <>
                <span className="text-xl font-semibold text-gray-900 mb-3">Change Role</span>
                <p className="text-gray-600 mb-2 text-sm">You are about to change this user's role to <span className="font-semibold">{pendingUserAction.newRole}</span>.</p>
                {actionError && <div aria-live="polite" className="text-red-700 text-sm mb-2">{actionError}</div>}
                <div className="flex w-full gap-2 justify-end">
                  <button
                    className="bg-gray-100 rounded px-3 py-1 text-gray-500 hover:bg-gray-200"
                    onClick={() => { setPendingUserAction(null); setActionError(null); }}
                    tabIndex={0}
                  >Cancel</button>
                  <button
                    className="bg-blue-700 text-white px-3 py-1 rounded hover:bg-blue-800"
                    onClick={() => changeRoleMutation.mutate({ user_id: pendingUserAction.user_id, newRole: pendingUserAction.newRole! })}
                    disabled={changeRoleMutation.isLoading}
                    tabIndex={0}
                  >
                    {changeRoleMutation.isLoading ? "Updating..." : "Confirm"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      ))}

      {/* --- BULK ACTION MODALS --- */}
      {(pendingBulkType === "block" || pendingBulkType === "unblock") && (
        <div className="fixed inset-0 z-40 bg-black bg-opacity-30 flex items-center justify-center" role="alertdialog" aria-modal="true">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-sm mx-auto p-6 flex flex-col items-center">
            <span className="text-xl font-semibold text-gray-900 mb-2">{pendingBulkType === "block" ? "Block Selected Users?" : "Unblock Selected Users?"}</span>
            <p className="text-gray-600 mb-3 text-sm">You are about to {pendingBulkType === "block" ? "block" : "unblock"} <b>{bulkSelected.length}</b> users.</p>
            {bulkState.error && (
              <p className="text-red-700 text-sm mb-2" aria-live="polite">{bulkState.error}</p>
            )}
            <div className="flex w-full gap-2 justify-end">
              <button
                className="bg-gray-100 rounded px-3 py-1 text-gray-500 hover:bg-gray-200"
                onClick={() => { setPendingBulkType(null); setBulkState({ running: false, error: null, completed: 0, total: 0 }); }}
                tabIndex={0}
              >Cancel</button>
              <button
                className={`${pendingBulkType === "block" ? "bg-red-700 hover:bg-red-800" : "bg-green-700 hover:bg-green-800"} text-white px-3 py-1 rounded`}
                onClick={() => {
                  runBulkBlock(pendingBulkType === "block");
                  setPendingBulkType(null);
                }}
                disabled={bulkState.running}
                tabIndex={0}
              >Confirm</button>
            </div>
          </div>
        </div>
      )}
      {pendingBulkType === "role" && pendingBulkRole && (
        <div className="fixed inset-0 z-40 bg-black bg-opacity-30 flex items-center justify-center" role="alertdialog" aria-modal="true">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-sm mx-auto p-6 flex flex-col items-center">
            <span className="text-xl font-semibold text-gray-900 mb-2">Change Role for Selected</span>
            <p className="text-gray-600 mb-3 text-sm">You are about to change <b>{bulkSelected.length}</b> users' role to <b>{pendingBulkRole}</b>.</p>
            {bulkState.error && (
              <p className="text-red-700 text-sm mb-2" aria-live="polite">{bulkState.error}</p>
            )}
            <div className="flex w-full gap-2 justify-end">
              <button
                className="bg-gray-100 rounded px-3 py-1 text-gray-500 hover:bg-gray-200"
                onClick={() => { setPendingBulkType(null); setBulkState({ running: false, error: null, completed: 0, total: 0 }); setPendingBulkRole(undefined); }}
                tabIndex={0}
              >Cancel</button>
              <button
                className="bg-blue-700 hover:bg-blue-800 text-white px-3 py-1 rounded"
                onClick={() => {
                  runBulkRole(pendingBulkRole);
                  setPendingBulkType(null);
                  setPendingBulkRole(undefined);
                }}
                disabled={bulkState.running}
                tabIndex={0}
              >Confirm</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default UV_Admin_Users;