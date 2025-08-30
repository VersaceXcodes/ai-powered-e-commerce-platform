import React, { useState, useRef, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import axios, { AxiosError } from "axios";
import { Link } from "react-router-dom";
import { z } from "zod";
import { useAppStore } from "@/store/main";

// Type import for visual verification; not directly used for field validation, but provided as model
// import { userSchema } from "@schema"; // Already informed: zod in this scope

const emailSchema = z.string().email();

const API_BASE =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";

// This matches OpenAPI: POST /auth/password-reset/request
interface PasswordResetRequestPayload {
  email: string;
}

interface PasswordResetRequestResponse {
  message: string; // Always present (success/failure are indistinguishable for privacy)
}

const UV_Auth_PasswordResetRequest: React.FC = () => {
  // Local states (do not use Zustand for local-only, per analysis)
  const [email, setEmail] = useState<string>("");
  const [submitted, setSubmitted] = useState<boolean>(false);
  const [inputTouched, setInputTouched] = useState<boolean>(false); // to avoid error showing before edit
  const [error_message, setErrorMessage] = useState<string | null>(null);
  const [is_loading, setIsLoading] = useState<boolean>(false);

  // Global store, for auth error clearance ONLY (for safety UX: clear stale errors)
  const global_auth_error = useAppStore(
    (state) => state.authentication_state.error_message
  );
  const clearAuthError = useAppStore((state) => state.clear_auth_error);

  // Ref for input auto-focus
  const emailInputRef = useRef<HTMLInputElement>(null);

  // On mount: focus input, clear any global auth error
  useEffect(() => {
    emailInputRef.current?.focus();
    if (global_auth_error) clearAuthError();
    // eslint-disable-next-line
  }, []);

  // -- Email validation --
  const emailValidation = emailSchema.safeParse(email);

  // React Query mutation for reset request
  const resetMutation = useMutation<
    PasswordResetRequestResponse,
    AxiosError,
    PasswordResetRequestPayload
  >({
    mutationFn: async (payload) => {
      setIsLoading(true);
      setErrorMessage(null);
      const { data } = await axios.post(
        `${API_BASE}/auth/password-reset/request`,
        payload,
        { headers: { "Content-Type": "application/json" } }
      );
      // The backend *always* returns { message } 200, regardless of presence, per spec
      return data;
    },
    onSuccess: () => {
      setSubmitted(true);
      setErrorMessage(null);
      setIsLoading(false);
    },
    onError: (error) => {
      // Should not happen (API always returns 200, but fall back for network failures)
      let msg =
        (error as any).response?.data?.message ||
        error.message ||
        "Error sending reset email.";
      setErrorMessage(msg);
      setSubmitted(false);
      setIsLoading(false);
    },
  });

  // Handlers
  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
    setInputTouched(true);
    setErrorMessage(null);
    setSubmitted(false);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setInputTouched(true);
    setErrorMessage(null);

    if (!emailValidation.success) {
      setErrorMessage("Please enter a valid email address.");
      return;
    }

    resetMutation.mutate({ email: email.trim() });
  };

  // Keyboard nav enhancement: allow pressing ENTER to submit if focused
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      // Only submit if button enabled
      if (canSubmit) {
        handleSubmit((e as any) as React.FormEvent<HTMLFormElement>); // Trick: simulate submit
      }
    }
  };

  // Validation
  const isEmailValid = emailValidation.success;
  const canSubmit =
    !is_loading && !submitted && isEmailValid && email.length > 2;

  return (
    <>
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 py-12">
        <div className="max-w-md w-full bg-white border border-gray-200 shadow rounded-xl p-8">
          <h2 className="text-center text-2xl font-bold text-gray-900 mb-6">
            Password Reset
          </h2>
          {!submitted ? (
            <form className="space-y-6" onSubmit={handleSubmit} noValidate>
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-gray-700"
                >
                  Email address
                </label>
                <input
                  ref={emailInputRef}
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  tabIndex={1}
                  value={email}
                  onChange={handleEmailChange}
                  onKeyDown={handleKeyDown}
                  disabled={is_loading}
                  placeholder="Enter your email"
                  className={`mt-2 block w-full rounded-md border px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-50 ${
                    inputTouched && !isEmailValid
                      ? "border-red-400"
                      : "border-gray-300"
                  }`}
                  aria-invalid={inputTouched && !isEmailValid}
                  aria-describedby="email-error"
                  spellCheck="false"
                />
              </div>
              {/* Error/Validation/Feedback */}
              <div
                id="email-error"
                className="min-h-[22px] flex items-center"
                aria-live="polite"
              >
                {error_message ? (
                  <span className="text-sm text-red-600">{error_message}</span>
                ) : inputTouched && !isEmailValid ? (
                  <span className="text-sm text-red-500">
                    Please enter a valid email address.
                  </span>
                ) : null}
              </div>
              <div>
                <button
                  type="submit"
                  className="w-full flex items-center justify-center px-4 py-2 text-white font-medium rounded-md bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                  disabled={!canSubmit}
                  tabIndex={2}
                  aria-disabled={!canSubmit}
                >
                  {is_loading ? (
                    <span className="inline-flex items-center">
                      <svg
                        className="animate-spin h-4 w-4 mr-2 text-white"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                      Sending...
                    </span>
                  ) : (
                    "Request Password Reset"
                  )}
                </button>
              </div>
              <div className="text-center pt-3">
                <Link
                  to="/login"
                  className="text-blue-600 hover:text-blue-500 text-sm font-medium"
                  tabIndex={3}
                >
                  &larr; Back to Login
                </Link>
              </div>
            </form>
          ) : (
            // Success State: "Email sent" message, disables further action
            <div className="space-y-6 text-center">
              <div
                className="rounded-sm bg-green-50 border border-green-200 text-green-800 py-4 px-3 font-medium"
                aria-live="polite"
              >
                <svg
                  className="inline mr-2 h-5 w-5 text-green-500"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                If this email is registered, you will receive a password reset
                link. Please check your inbox.
              </div>
              <div>
                <Link
                  to="/login"
                  className="text-blue-600 hover:text-blue-500 text-sm font-medium"
                  tabIndex={4}
                >
                  &larr; Back to Login
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default UV_Auth_PasswordResetRequest;