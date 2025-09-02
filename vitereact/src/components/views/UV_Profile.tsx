import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '@/store/main';
import { Link, useNavigate } from 'react-router-dom';

// --- Types from Zod (schema already matches backend types) ---
interface User {
  user_id: string;
  name: string;
  email: string;
  password_hash?: string; // not surfaced, but present
  role: 'customer' | 'vendor' | 'admin';
  profile_image_url: string | null;
  is_blocked: boolean;
  created_at: string;
  updated_at: string;
}

// ---- Constants ----
const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

// ---- Main Component ----

const UV_Profile: React.FC = () => {
  // Global store selectors
  const currentUser = useAppStore(state => state.authentication_state.current_user);
  const authToken = useAppStore(state => state.authentication_state.auth_token);
  const logoutUser = useAppStore(state => state.logout_user);
  const updateUserProfile = useAppStore(state => state.update_user_profile);

  // Navigation
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Local state for edits
  const [localUser, setLocalUser] = useState<User | null>(null); // shadow, for edits
  const [editMode, setEditMode] = useState<'name' | 'email' | 'profile_image_url' | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [editSuccess, setEditSuccess] = useState<string | null>(null);

  // Password change state
  const [cpOld, setCpOld] = useState('');
  const [cpNew, setCpNew] = useState('');
  const [cpConfirm, setCpConfirm] = useState('');
  const [cpShow, setCpShow] = useState(false);
  const [cpLoading, setCpLoading] = useState(false);
  const [cpSuccess, setCpSuccess] = useState<string | null>(null);
  const [cpError, setCpError] = useState<string | null>(null);
  const [pwFormOpen, setPwFormOpen] = useState(false);

  // Focus ref for accessibility
  const nameInputRef = useRef<HTMLInputElement>(null);
  const emailInputRef = useRef<HTMLInputElement>(null);

  // --- Fetch profile (on mount/if currentUser) ---
  const {

    isLoading: profileLoading,
    isError: profileError,

  } = useQuery<User>({
    queryKey: ['profile'],
    queryFn: async () => {
      if (!authToken) throw new Error('Missing auth');
      const { data } = await axios.get(`${API_BASE}/profile`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      return data as User;
    },
    enabled: !!authToken,
    staleTime: 0
  });

  // Handle profile error separately
  React.useEffect(() => {
    if (profileError) {
      // If error is 401/403, logout (session expired / blocked)
      if (axios.isAxiosError(profileError) && (profileError.response?.status === 401 || profileError.response?.status === 403)) {
        logoutUser();
        navigate('/login', { replace: true });
      }
    }
  }, [profileError, logoutUser, navigate]);

  // --- Synchronize localUser with currentUser (e.g. if store updates) ---
  useEffect(() => {
    if (currentUser && (!localUser || currentUser.user_id !== localUser.user_id)) {
      setLocalUser(currentUser);
    }
  }, [currentUser]);

  // --- Profile Update Mutation ---
  const updateProfileMutation = useMutation({
    mutationFn: async (payload: { field: 'name' | 'email' | 'profile_image_url', value: string | null }) => {
      setEditError(null);
      setEditSuccess(null);
      if (!authToken || !localUser) throw new Error('Missing user or auth');
      const updateBody: any = { user_id: localUser.user_id };
      // Validate field (no empty/invalid email/etc)
      if (payload.field === 'name') {
        if (!payload.value?.trim() || payload.value.length > 255) throw new Error('Name must be between 1 and 255 characters.');
        updateBody.name = payload.value.trim();
      } else if (payload.field === 'email') {
        if (!payload.value?.match(/^[^@\s]+@[^@\s]+\.[^@\s]+$/)) throw new Error('Invalid email format.');
        updateBody.email = payload.value.trim();
      } else if (payload.field === 'profile_image_url') {
        if (payload.value && !/^https?:\/\/.+/i.test(payload.value)) throw new Error('Profile image URL must be absolute.');
        updateBody.profile_image_url = payload.value;
      }
      const { data } = await axios.put(`${API_BASE}/profile`, updateBody, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      return data as User;
    },
    onSuccess: (data) => {
      setEditSuccess('Profile updated successfully.');
      setEditError(null);
      setLocalUser(data);
      updateUserProfile(data);
      setEditMode(null);
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
    onError: (err: any) => {
      setEditSuccess(null);
      setEditError(err.response?.data?.message || err.message || 'Failed to update profile.');
    }
  });

  // --- Password Change Mutation ---
  const changePasswordMutation = useMutation({
    mutationFn: async (payload: { old_password: string; new_password: string }) => {
      if (!authToken) throw new Error('Not authenticated');
      if (!payload.old_password || !payload.new_password) throw new Error('All password fields are required.');
      // API expects { old_password, new_password }
      return await axios.post(
        `${API_BASE}/profile/change-password`,
        payload,
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
    },
    onSuccess: () => {
      setCpSuccess('Password changed successfully.');
      setCpError(null);
      setCpOld('');
      setCpNew('');
      setCpConfirm('');
      setPwFormOpen(false);
    },
    onError: (err: any) => {
      setCpSuccess(null);
      setCpError(err?.response?.data?.message || err.message || 'Password change failed.');
      setCpLoading(false);
    }
  });

  // --- Logout Handler ---
  const handleLogout = async () => {
    await logoutUser();
    navigate('/login', { replace: true });
  };

  // --- Edit handlers ---
  const handleFieldEdit = (field: 'name' | 'email' | 'profile_image_url') => {
    setEditMode(field);
    setEditError(null);
    setEditSuccess(null);
    // Autofocus
    setTimeout(() => {
      if (field === 'name' && nameInputRef.current) nameInputRef.current.focus();
      if (field === 'email' && emailInputRef.current) emailInputRef.current.focus();
    }, 100);
  };

  const handleFieldCancel = () => {
    // Reset local value to stored if cancel
    setLocalUser(currentUser || null);
    setEditMode(null);
    setEditError(null);
    setEditSuccess(null);
  };

  const handleFieldSave = async (field: 'name' | 'email' | 'profile_image_url') => {
    if (!localUser) return;
    setEditError(null);
    setEditSuccess(null);
    try {
      await updateProfileMutation.mutateAsync({ field, value: (localUser as any)[field] });
    } catch (e) {
      // Error state handled in mutation
    }
  };

  // --- Password change submit ---
  const handlePwdChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setCpError(null);
    setCpSuccess(null);
    if (!cpOld.trim() || !cpNew.trim() || !cpConfirm.trim()) {
      setCpError('All password fields are required.');
      return;
    }
    if (cpNew.length < 8) {
      setCpError('Password must be at least 8 characters.');
      return;
    }
    if (cpNew !== cpConfirm) {
      setCpError('Passwords do not match.');
      return;
    }
    setCpLoading(true);
    try {
      await changePasswordMutation.mutateAsync({ old_password: cpOld, new_password: cpNew });
    } catch (err) {
      // Error already set in onError
    } finally {
      setCpLoading(false);
    }
  };

  // --- Utility: role display ---
  const formatRole = (role: string) => {
    switch (role) {
      case 'admin': return 'Admin';
      case 'vendor': return 'Vendor';
      case 'customer': return 'Customer';
      default: return role.charAt(0).toUpperCase() + role.slice(1);
    }
  };

  // --- UI Fallback: Avatar (Initials Circle if no image) ---
  const renderAvatar = () => {
    const url = localUser?.profile_image_url;
    if (url) {
      return (
        <img
          src={url}
          alt="Profile"
          className="h-20 w-20 rounded-full border-2 border-gray-300 object-cover shadow"
        />
      );
    }
    if(localUser?.name) {
      const initials = localUser.name.split(' ').slice(0,2).map(x => x[0]).join('').toUpperCase();
      return (
        <div className="h-20 w-20 rounded-full flex items-center justify-center bg-blue-200 text-2xl font-bold text-blue-700 border-2 border-gray-300">
          {initials}
        </div>
      );
    }
    return (
      <div className="h-20 w-20 rounded-full flex items-center justify-center bg-gray-200 text-2xl font-bold text-gray-500 border-2 border-gray-300">
        ?
      </div>
    );
  };

  // --- SkeletonLoader ---
  const SkeletonLoader = () => (
    <div className="animate-pulse flex flex-col items-center space-y-3 mt-8">
      <div className="h-20 w-20 rounded-full bg-gray-200" />
      <div className="h-6 w-1/2 bg-gray-200 rounded" />
      <div className="h-5 w-1/3 bg-gray-100 rounded" />
      <div className="h-4 w-1/4 bg-gray-100 rounded" />
    </div>
  );

  // --- No user state check ---
  if (profileLoading) return <SkeletonLoader />;
  if (profileError) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md max-w-md mt-8" aria-live="polite">
        <p className="text-lg font-bold">Profile could not be loaded.</p>
        <p className="text-sm">{(profileError as any)?.message || "Please refresh or log in again."}</p>
      </div>
    </div>
  );
  if (!localUser) return null;

  return (
    <>
      <main className="max-w-2xl mx-auto pt-12 pb-20 px-4 sm:px-6 lg:px-8 flex flex-col">
        <section className="flex flex-col items-center">
          {renderAvatar()}
          <span className="mt-4 inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700 uppercase tracking-wide">
            {formatRole(localUser.role)}
          </span>
        </section>

        <section className="mt-10 w-full">
          <h1 className="text-3xl font-bold text-gray-900 mb-4 text-center">My Account</h1>
          <div className="divide-y divide-gray-100 max-w-xl mx-auto bg-white rounded-lg shadow border">
            {/* --- Name --- */}
            <div className="flex flex-col sm:flex-row items-center justify-between px-6 py-5">
              <div className="flex-1 w-full">
                <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                  Full Name
                </label>
                {editMode === 'name' ? (
                  <input
                    id="name"
                    type="text"
                    ref={nameInputRef}
                    value={localUser.name}
                    maxLength={255}
                    onChange={e => {
                      setEditError(null);
                      setEditSuccess(null);
                      setLocalUser(prev => prev ? { ...prev, name: e.target.value } : null);
                    }}
                    onBlur={() => {}}
                    className="mt-1 w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  />
                ) : (
                  <span className="block mt-1 text-gray-900">{localUser.name}</span>
                )}
              </div>
              <div className="flex space-x-2 mt-2 sm:mt-0 ml-0 sm:ml-4">
                {editMode === 'name' ? (
                  <>
                    <button
                      className="inline-flex items-center px-3 py-1.5 bg-blue-600 text-white rounded-md font-medium hover:bg-blue-700 transition disabled:opacity-50"
                      onClick={() => handleFieldSave('name')}
                      disabled={updateProfileMutation.isPending}
                      tabIndex={0}
                    >
                      Save
                    </button>
                    <button
                      className="inline-flex items-center px-3 py-1.5 bg-gray-200 text-gray-700 rounded-md font-medium hover:bg-gray-300 transition"
                      onClick={handleFieldCancel}
                      tabIndex={0}
                      aria-label="Cancel"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    className="p-2 rounded-full text-gray-400 hover:text-blue-600 focus:ring-2 focus:ring-blue-600"
                    onClick={() => handleFieldEdit('name')}
                    aria-label="Edit name"
                    tabIndex={0}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232a2.5 2.5 0 113.536 3.536L7.5 20.036a2 2 0 01-1.414.586H4v-2.086c0-.53.21-1.04.586-1.414L15.232 5.232z"/>
                    </svg>
                  </button>
                )}
              </div>
            </div>
            {/* --- Email --- */}
            <div className="flex flex-col sm:flex-row items-center justify-between px-6 py-5">
              <div className="flex-1 w-full">
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                  Email
                </label>
                {editMode === 'email' ? (
                  <input
                    id="email"
                    type="email"
                    ref={emailInputRef}
                    value={localUser.email}
                    maxLength={255}
                    onChange={e => {
                      setEditError(null);
                      setEditSuccess(null);
                      setLocalUser(prev => prev ? { ...prev, email: e.target.value } : null);
                    }}
                    className="mt-1 w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  />
                ) : (
                  <span className="block mt-1 text-gray-900">{localUser.email}</span>
                )}
              </div>
              <div className="flex space-x-2 mt-2 sm:mt-0 ml-0 sm:ml-4">
                {editMode === 'email' ? (
                  <>
                    <button
                      className="inline-flex items-center px-3 py-1.5 bg-blue-600 text-white rounded-md font-medium hover:bg-blue-700 transition disabled:opacity-50"
                      onClick={() => handleFieldSave('email')}
                      disabled={updateProfileMutation.isPending}
                      tabIndex={0}
                    >
                      Save
                    </button>
                    <button
                      className="inline-flex items-center px-3 py-1.5 bg-gray-200 text-gray-700 rounded-md font-medium hover:bg-gray-300 transition"
                      onClick={handleFieldCancel}
                      tabIndex={0}
                      aria-label="Cancel"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    className="p-2 rounded-full text-gray-400 hover:text-blue-600 focus:ring-2 focus:ring-blue-600"
                    onClick={() => handleFieldEdit('email')}
                    aria-label="Edit email"
                    tabIndex={0}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232a2.5 2.5 0 113.536 3.536L7.5 20.036a2 2 0 01-1.414.586H4v-2.086c0-.53.21-1.04.586-1.414L15.232 5.232z"/>
                    </svg>
                  </button>
                )}
              </div>
            </div>
            {/* --- Profile Image (URL input for MVP) --- */}
            <div className="flex flex-col sm:flex-row items-center justify-between px-6 py-5">
              <div className="flex-1 w-full">
                <label htmlFor="profile_image_url" className="block text-sm font-medium text-gray-700">
                  Profile Image URL (optional)
                </label>
                {editMode === 'profile_image_url' ? (
                  <input
                    id="profile_image_url"
                    type="url"
                    value={localUser.profile_image_url || ''}
                    placeholder="https://..."
                    maxLength={255}
                    onChange={e => {
                      setEditError(null);
                      setEditSuccess(null);
                      setLocalUser(prev => prev ? { ...prev, profile_image_url: e.target.value } : null);
                    }}
                    className="mt-1 w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  />
                ) : (
                  <span className="block mt-1 text-gray-900">{localUser.profile_image_url || <em className="text-gray-400">Not set</em>}</span>
                )}
              </div>
              <div className="flex space-x-2 mt-2 sm:mt-0 ml-0 sm:ml-4">
                {editMode === 'profile_image_url' ? (
                  <>
                    <button
                      className="inline-flex items-center px-3 py-1.5 bg-blue-600 text-white rounded-md font-medium hover:bg-blue-700 transition disabled:opacity-50"
                      onClick={() => handleFieldSave('profile_image_url')}
                      disabled={updateProfileMutation.isPending}
                      tabIndex={0}
                    >
                      Save
                    </button>
                    <button
                      className="inline-flex items-center px-3 py-1.5 bg-gray-200 text-gray-700 rounded-md font-medium hover:bg-gray-300 transition"
                      onClick={handleFieldCancel}
                      aria-label="Cancel"
                      tabIndex={0}
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    className="p-2 rounded-full text-gray-400 hover:text-blue-600 focus:ring-2 focus:ring-blue-600"
                    onClick={() => handleFieldEdit('profile_image_url')}
                    aria-label="Edit profile image"
                    tabIndex={0}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232a2.5 2.5 0 113.536 3.536L7.5 20.036a2 2 0 01-1.414.586H4v-2.086c0-.53.21-1.04.586-1.414L15.232 5.232z"/>
                    </svg>
                  </button>
                )}
              </div>
            </div>
          </div>
          <div className="mt-2 min-h-[32px] px-2">
            {(editError || editSuccess) && (
              <div
                className={
                  "rounded-md px-4 py-2 mt-1 " +
                  (editError
                    ? "bg-red-50 border border-red-200 text-red-700"
                    : "bg-green-50 border border-green-200 text-green-700")
                }
                aria-live="polite"
              >
                {editError || editSuccess}
              </div>
            )}
          </div>
        </section>

        {/* --- Change Password Section --- */}
        <section className="mt-10 w-full max-w-xl mx-auto">
          <div className="flex items-center justify-between border-b pb-2">
            <h2 className="text-lg font-semibold text-gray-800">Change Password</h2>
            <button
              className="inline-flex items-center px-2 py-1 text-blue-600 rounded hover:bg-blue-50 focus:ring-2 focus:ring-blue-500"
              onClick={() => {
                setPwFormOpen(open => !open);
                setCpError(null);
                setCpSuccess(null);
                setCpOld('');
                setCpNew('');
                setCpConfirm('');
              }}
              aria-label={pwFormOpen ? "Hide password change form" : "Show password change form"}
              tabIndex={0}
            >
              {pwFormOpen ? 'Cancel' : 'Change'}
            </button>
          </div>
          {pwFormOpen && (
            <form className="space-y-4 mt-6" onSubmit={handlePwdChange}>
              <div>
                <label htmlFor="old_password" className="block text-sm font-medium text-gray-700">
                  Old password
                </label>
                <input
                  id="old_password"
                  type={cpShow ? "text" : "password"}
                  value={cpOld}
                  onChange={e => {
                    setCpOld(e.target.value);
                    setCpError(null);
                    setCpSuccess(null);
                  }}
                  minLength={8}
                  autoComplete="current-password"
                  className="mt-1 w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                />
              </div>
              <div>
                <label htmlFor="new_password" className="block text-sm font-medium text-gray-700">
                  New password
                </label>
                <input
                  id="new_password"
                  type={cpShow ? "text" : "password"}
                  value={cpNew}
                  onChange={e => {
                    setCpNew(e.target.value);
                    setCpError(null);
                    setCpSuccess(null);
                  }}
                  minLength={8}
                  autoComplete="new-password"
                  className="mt-1 w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                />
              </div>
              <div>
                <label htmlFor="confirm_password" className="block text-sm font-medium text-gray-700">
                  Confirm new password
                </label>
                <input
                  id="confirm_password"
                  type={cpShow ? "text" : "password"}
                  value={cpConfirm}
                  onChange={e => {
                    setCpConfirm(e.target.value);
                    setCpError(null);
                    setCpSuccess(null);
                  }}
                  minLength={8}
                  autoComplete="new-password"
                  className="mt-1 w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                />
              </div>
              <div className="flex items-center">
                <input
                  id="show_password"
                  type="checkbox"
                  checked={cpShow}
                  onChange={e => setCpShow(e.target.checked)}
                  className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500 rounded"
                  aria-label="Show password fields"
                />
                <label htmlFor="show_password" className="ml-2 text-sm text-gray-600">
                  Show passwords
                </label>
              </div>
              {(cpError || cpSuccess) && (
                <div
                  className={
                    "rounded-md px-3 py-2 " +
                    (cpError
                      ? "bg-red-50 border border-red-200 text-red-700"
                      : "bg-green-50 border border-green-200 text-green-700")
                  }
                  aria-live="polite"
                >
                  {cpError || cpSuccess}
                </div>
              )}
              <div>
                <button
                  type="submit"
                  disabled={cpLoading}
                  className="w-full inline-flex justify-center items-center px-4 py-2 bg-blue-600 text-white rounded-md font-semibold hover:bg-blue-700 transition disabled:opacity-50"
                >
                  {cpLoading ? (
                    <span className="flex items-center">
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Changing...
                    </span>
                  ) : (
                    "Change Password"
                  )}
                </button>
              </div>
            </form>
          )}
        </section>

        {/* --- Order/Wishlist Links --- */}
        <section className="mt-10 flex flex-col items-center space-y-3">
          <Link to="/orders" className="inline-flex items-center px-6 py-2 rounded-md bg-blue-50 hover:bg-blue-100 text-blue-700 font-medium transition w-full text-center justify-center">
            View My Orders
          </Link>
          <Link to="/wishlists" className="inline-flex items-center px-6 py-2 rounded-md bg-green-50 hover:bg-green-100 text-green-700 font-medium transition w-full text-center justify-center">
            My Wishlists
          </Link>
        </section>

        {/* --- Danger Zone or Delete Account (None in API, so info only) --- */}
        <section className="mt-12 max-w-xl mx-auto">
          <div className="p-4 border-l-4 border-yellow-400 bg-yellow-50 rounded flex flex-col items-start">
            <div className="font-bold text-yellow-900 mb-1">Danger Zone</div>
            <div className="text-yellow-700 text-sm">
              Account deletion is not available in this version.
            </div>
          </div>
        </section>

        {/* --- Logout --- */}
        <section className="mt-10 flex flex-col items-center">
          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex items-center justify-center px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-md transition-colors text-lg w-full max-w-xs"
            tabIndex={0}
            aria-label="Logout"
          >
            Logout
          </button>
        </section>
      </main>
    </>
  );
};

export default UV_Profile;