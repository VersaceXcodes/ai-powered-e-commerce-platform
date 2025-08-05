import React, { useState, useRef, useEffect } from 'react';
import { useAppStore } from '@/store/main';
import { Link, useNavigate } from 'react-router-dom';
import { z } from 'zod';

// Use Zod to mirror CreateUserInput constraints
const registrationSchema = z.object({
  name: z.string().min(1, "Full name is required").max(255, "Full name too long"),
  email: z.string().email("Please enter a valid email"),
  password_hash: z.string().min(8, "Password must be at least 8 characters").max(255, "Password too long"),
  confirm_password: z.string(),
}).refine((data) => data.password_hash === data.confirm_password, {
  message: "Passwords do not match",
  path: ["confirm_password"]
});

const UV_Auth_Register: React.FC = () => {
  // Controlled form states
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password_hash, setPasswordHash] = useState('');
  const [confirm_password, setConfirmPassword] = useState('');

  // Inline validation state
  const [validationError, setValidationError] = useState<{ [k: string]: string } | null>(null);

  // Zustand global selectors: use individual selectors only!
  const is_loading = useAppStore(state => state.authentication_state.authentication_status.is_loading);
  const error_message = useAppStore(state => state.authentication_state.error_message);
  const register_user = useAppStore(state => state.register_user);
  const clear_auth_error = useAppStore(state => state.clear_auth_error);
  const is_authenticated = useAppStore(state => state.authentication_state.authentication_status.is_authenticated);
  const navigate = useNavigate();

  // Refs for better a11y error focus
  const nameInputRef = useRef<HTMLInputElement>(null);
  const emailInputRef = useRef<HTMLInputElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);
  const confirmPasswordInputRef = useRef<HTMLInputElement>(null);

  // If already authenticated (race/redirect), bounce out
  useEffect(() => {
    if (is_authenticated) {
      navigate('/', { replace: true });
    }
  }, [is_authenticated, navigate]);

  // Clear errors on unmount or on input change
  useEffect(() => {
    return () => clear_auth_error();
    // eslint-disable-next-line
  }, []);

  // Focus first invalid field on validation error
  useEffect(() => {
    if (validationError) {
      if (validationError.name && nameInputRef.current) nameInputRef.current.focus();
      else if (validationError.email && emailInputRef.current) emailInputRef.current.focus();
      else if (validationError.password_hash && passwordInputRef.current) passwordInputRef.current.focus();
      else if (validationError.confirm_password && confirmPasswordInputRef.current) confirmPasswordInputRef.current.focus();
    }
  }, [validationError]);

  // Input handlers: clear inline + global (store) errors on change
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setName(e.target.value);
    setValidationError(null);
    clear_auth_error();
  };
  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
    setValidationError(null);
    clear_auth_error();
  };
  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPasswordHash(e.target.value);
    setValidationError(null);
    clear_auth_error();
  };
  const handleConfirmPasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setConfirmPassword(e.target.value);
    setValidationError(null);
    clear_auth_error();
  };

  // Submit handler with Zod client-side validation
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);
    clear_auth_error();
    // Zod validation
    const result = registrationSchema.safeParse({
      name,
      email,
      password_hash,
      confirm_password
    });

    if (!result.success) {
      // Map zod errors for each field
      const fieldErrs: { [k: string]: string } = {};
      for (let issue of result.error.issues) {
        fieldErrs[issue.path[0]] = issue.message;
      }
      setValidationError(fieldErrs);
      return;
    }

    // Call store register_user (auto sets loading / handles error)
    try {
      await register_user(name, email, password_hash);
      // Success will cause global auth to log in & redirect via effect above
    } catch (err) {
      // Error is set in global state
    }
  };

  return (
    <>
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-gray-100 px-4 py-8">
        <div className="w-full max-w-md space-y-6 rounded-lg shadow-xl bg-white px-8 py-10 border border-gray-100">
          <h2 className="text-2xl font-bold text-center text-gray-900">Create your account</h2>
          <form
            className="space-y-5"
            onSubmit={handleSubmit}
            noValidate
            aria-describedby={error_message ? "register-server-error" : undefined}
          >
            {/* ERROR MSGS */}
            <div aria-live="polite">
              {(validationError || error_message) && (
                <div
                  className="mb-3 bg-red-50 border border-red-200 rounded-md px-4 py-2 text-red-700 text-sm font-medium"
                  id="register-server-error"
                  tabIndex={-1}
                >
                  {validationError &&
                    Object.entries(validationError).map(([k, v]) => (
                      <div key={k}>{v}</div>
                    ))}
                  {error_message && <div>{error_message}</div>}
                </div>
              )}
            </div>

            {/* FULL NAME */}
            <div>
              <label htmlFor="register-name" className="block text-sm font-medium text-gray-700">
                Full name
              </label>
              <input
                type="text"
                id="register-name"
                ref={nameInputRef}
                autoFocus
                maxLength={255}
                autoComplete="name"
                className={`mt-1 block w-full px-3 py-2 border ${
                  (validationError?.name ? "border-red-500" : "border-gray-300")
                } rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-base`}
                placeholder="Enter your full name"
                value={name}
                onChange={handleNameChange}
                aria-invalid={!!validationError?.name}
                required
                tabIndex={1}
              />
            </div>
            {/* EMAIL */}
            <div>
              <label htmlFor="register-email" className="block text-sm font-medium text-gray-700">
                Email address
              </label>
              <input
                type="email"
                id="register-email"
                ref={emailInputRef}
                autoComplete="email"
                maxLength={255}
                className={`mt-1 block w-full px-3 py-2 border ${
                  (validationError?.email ? "border-red-500" : "border-gray-300")
                } rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-base`}
                placeholder="you@example.com"
                value={email}
                onChange={handleEmailChange}
                aria-invalid={!!validationError?.email}
                required
                tabIndex={2}
              />
            </div>
            {/* PASSWORD */}
            <div>
              <label htmlFor="register-password" className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <input
                type="password"
                id="register-password"
                ref={passwordInputRef}
                minLength={8}
                maxLength={255}
                autoComplete="new-password"
                className={`mt-1 block w-full px-3 py-2 border ${
                  (validationError?.password_hash ? "border-red-500" : "border-gray-300")
                } rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-base`}
                placeholder="Enter a strong password"
                value={password_hash}
                onChange={handlePasswordChange}
                aria-invalid={!!validationError?.password_hash}
                required
                tabIndex={3}
              />
              <span className="text-xs text-gray-400 mt-1 block">
                At least 8 characters (no spaces)
              </span>
            </div>
            {/* CONFIRM PASSWORD */}
            <div>
              <label htmlFor="register-confirm-password" className="block text-sm font-medium text-gray-700">
                Confirm password
              </label>
              <input
                type="password"
                id="register-confirm-password"
                ref={confirmPasswordInputRef}
                minLength={8}
                maxLength={255}
                autoComplete="new-password"
                className={`mt-1 block w-full px-3 py-2 border ${
                  (validationError?.confirm_password ? "border-red-500" : "border-gray-300")
                } rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-base`}
                placeholder="Re-enter password"
                value={confirm_password}
                onChange={handleConfirmPasswordChange}
                aria-invalid={!!validationError?.confirm_password}
                required
                tabIndex={4}
              />
            </div>
            {/* SUBMIT BUTTON */}
            <div>
              <button
                type="submit"
                disabled={
                  is_loading ||
                  !name ||
                  !email ||
                  !password_hash ||
                  !confirm_password ||
                  password_hash.length < 8 ||
                  password_hash !== confirm_password
                }
                className="relative w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-base font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-150 disabled:opacity-60 disabled:cursor-not-allowed"
                tabIndex={5}
                aria-busy={is_loading}
              >
                {is_loading ? (
                  <span className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Creating account...
                  </span>
                ) : (
                  'Create account'
                )}
              </button>
            </div>
            {/* LOGIN LINK */}
            <div className="text-center pt-2">
              <Link
                to="/login"
                className="text-blue-700 hover:underline transition-colors duration-100 text-sm"
                tabIndex={6}
                onClick={() => clear_auth_error()}
              >
                Already have an account? Log in
              </Link>
            </div>
          </form>
        </div>
      </div>
    </>
  );
};

export default UV_Auth_Register;