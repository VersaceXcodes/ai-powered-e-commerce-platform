import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAppStore } from '@/store/main';

/**
 * UV_Auth_Login: Login page for all user roles.
 * - No global nav/footer appears.
 * - Uses Zustand global store for authentication actions/state.
 * - Shows errors, disables submit/spinner during loading.
 * - Links to Register and Forgot Password.
 */
const UV_Auth_Login: React.FC = () => {
  // Local form state
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  // For focusing the first input field for accessibility
  const emailInputRef = useRef<HTMLInputElement | null>(null);

  // Zustand global state/actions (always individual selectors)
  const isLoading = useAppStore(state => state.authentication_state.authentication_status.is_loading);
  const isAuthenticated = useAppStore(state => state.authentication_state.authentication_status.is_authenticated);
  const errorMessage = useAppStore(state => state.authentication_state.error_message);
  const loginUser = useAppStore(state => state.login_user);
  const clearAuthError = useAppStore(state => state.clear_auth_error);

  // Router hooks
  const navigate = useNavigate();
  const location = useLocation();

  // On page mount, clear error and focus email field
  useEffect(() => {
    clearAuthError();
    if (emailInputRef.current) {
      emailInputRef.current.focus();
    }
    // eslint-disable-next-line
  }, []);

  // If already authenticated, redirect away (guard: only guests can see this view)
  useEffect(() => {
    if (isAuthenticated) {
      // If redirected here by route guard for unauthenticated, go to "/"
      // else use location.state.from if set (role guards, session expiry)
      const from = (location.state as any)?.from;
      navigate(from && typeof from === 'string' ? from : "/", { replace: true });
    }
    // eslint-disable-next-line
  }, [isAuthenticated, navigate, location.state]);

  // Handles login form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Clear prior errors
    clearAuthError();

    // Sanitized trimmed input
    const cleanEmail = email.trim();
    const cleanPassword = password.trim();

    // Basic inline client validation
    if (!cleanEmail) {
      setEmail('');
      if (emailInputRef.current) emailInputRef.current.focus();
      return;
    }
    if (!cleanPassword) {
      setPassword('');
      return;
    }

    try {
      await loginUser(cleanEmail, cleanPassword);
      // Successful: store will mark as authenticated, which triggers redirect above
      // Form can remain filled (store resets error/loading)
    } catch (_e) {
      // Error display is handled by Zustand store's error_message
      // We don't handle here, error surfaced & announced below the form
      // No need to set local error state; do not re-throw to avoid double messages
    }
  };

  // Clears error on email or password change for smooth UX
  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (errorMessage) clearAuthError();
    setEmail(e.target.value);
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (errorMessage) clearAuthError();
    setPassword(e.target.value);
  };

  // Show a context message if redirected here from a guard/session expiry
  const contextMsg = (location.state as any)?.reason === 'expired'
    ? "Your session has expired. Please sign in again."
    : (location.state as any)?.reason === 'unauthorized'
      ? "You must be logged in to access that page."
      : null;

  return (
    <>
      <div className="min-h-screen flex bg-gray-50">
        {/* Left side - Hero Image */}
        <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-blue-600 to-purple-700 relative overflow-hidden">
          <div className="absolute inset-0 bg-black bg-opacity-20"></div>
          <img 
            src="/src/assets/cofounder.webp" 
            alt="Welcome to AIOCart" 
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center text-white p-8">
              <h2 className="text-4xl font-bold mb-4">Welcome to AIOCart</h2>
              <p className="text-xl opacity-90">Your intelligent shopping companion</p>
            </div>
          </div>
        </div>

        {/* Right side - Login Form */}
        <div className="flex-1 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
          <div className="max-w-md w-full bg-white rounded-lg shadow-xl p-8 lg:shadow-2xl">
            <div className="mb-8 text-center">
              <div className="mb-6">
                <img alt="AIOCart Logo" src="https://picsum.photos/seed/aiocartloginlogo/80/80" className="mx-auto rounded-full shadow-lg" />
              </div>
              <h1 className="text-3xl font-bold text-gray-800 mb-2">Sign in to your account</h1>
              <p className="text-gray-500 text-sm">Welcome back! Please sign in to access your shopping dashboard.</p>
            </div>

          {contextMsg && (
            <div className="mb-6 py-2 bg-yellow-100 border border-yellow-300 text-yellow-800 rounded-md text-sm text-center" aria-live="polite">
              {contextMsg}
            </div>
          )}

          {/* Error message block */}
          {errorMessage && (
            <div
              className="mb-6 py-2 bg-red-100 border border-red-300 text-red-800 rounded-md text-sm text-center"
              aria-live="polite"
              id="auth-error-message"
              tabIndex={-1}
            >
              {errorMessage}
            </div>
          )}

          <form className="space-y-5" onSubmit={handleSubmit} autoComplete="on">
            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email address
              </label>
              <input
                ref={emailInputRef}
                type="email"
                id="email"
                name="email"
                autoComplete="email"
                required
                value={email}
                onChange={handleEmailChange}
                disabled={isLoading}
                className="mt-2 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 transition"
                aria-describedby="auth-error-message"
              />
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <input
                type="password"
                id="password"
                name="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={handlePasswordChange}
                disabled={isLoading}
                className="mt-2 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 transition"
              />
            </div>

            {/* Forgot Password & Register links */}
            <div className="flex flex-col sm:flex-row justify-between items-center mt-2 gap-2">
              <Link
                to="/password-reset-request"
                className="text-blue-600 hover:underline text-sm focus:outline-none focus:ring focus:ring-blue-500 rounded"
                tabIndex={0}
              >
                Forgot password?
              </Link>
              <div className="text-sm text-gray-600 mt-2 sm:mt-0">
                No account?
                <Link
                  to="/register"
                  className="ml-1 text-blue-600 hover:underline focus:outline-none focus:ring focus:ring-blue-500 rounded"
                  tabIndex={0}
                >
                  Register now
                </Link>
              </div>
            </div>

            {/* Submit button */}
            <div className="mt-6">
              <button
                type="submit"
                disabled={isLoading || !email.trim() || !password.trim()}
                className={`w-full flex justify-center items-center px-4 py-2 border border-transparent rounded-md text-base font-medium text-white bg-blue-600 hover:bg-blue-700 transition disabled:opacity-50 disabled:pointer-events-none focus:outline-none focus:ring-2 focus:ring-blue-500`}
                aria-disabled={isLoading}
                aria-busy={isLoading}
                aria-label="Sign In"
              >
                {isLoading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.372 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.823 3 7.937l3-2.646z" />
                    </svg>
                    Signing in...
                  </>
                ) : (
                  "Sign in"
                )}
              </button>
            </div>
          </form>

            <div className="mt-8 text-xs text-center text-gray-400">
              © {new Date().getFullYear()} AIOCart. All rights reserved.
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default UV_Auth_Login;