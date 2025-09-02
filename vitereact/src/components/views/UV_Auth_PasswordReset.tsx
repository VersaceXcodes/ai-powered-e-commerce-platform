import React, { useState, useEffect, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import axios from "axios";
import { z } from "zod";

// Zod schemas for type safety, adapted from DB:zodschemas:ts
const PasswordResetTokenSchema = z.object({
  reset_token: z.string(),
  user_id: z.string(),
  expires_at: z.coerce.date(),
  used: z.boolean(),
  created_at: z.coerce.date(),
});


// --- CONSTANTS
const PASSWORD_MIN_LENGTH = 8;
const API_BASE = `${import.meta.env.VITE_API_BASE_URL || "http://localhost:3000"}`;

// --- COMPONENT ---
const UV_Auth_PasswordReset: React.FC = () => {
  // ----- ROUTER: Get reset_token from URL -----
  const params = useParams();


  // params key can be 'token' OR 'reset_token' depending on router/config
  const rawToken = params.reset_token || params.token || "";
  const reset_token = String(rawToken).trim();

  // --- LOCAL STATE ---
  const [password, setPassword] = useState<string>("");
  const [confirmPassword, setConfirmPassword] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [resetCompleted, setResetCompleted] = useState<boolean>(false);
  const [tokenValidated, setTokenValidated] = useState<boolean>(false);

  // For password field refocus after error
  const passwordInputRef = useRef<HTMLInputElement | null>(null);

  // --- TOKEN VALIDATION: on mount ---
  useEffect(() => {
    let ignore = false;
    setIsLoading(true);
    setErrorMessage(null);
    setTokenValidated(false);

    // Only validate if token present and non-empty
    if (!reset_token || reset_token.length < 10) {
      setIsLoading(false);
      setErrorMessage("Password reset token missing or invalid. Try again from your email link.");
      return;
    }

    // Validate token
    axios
      .post(
        `${API_BASE}/auth/password-reset/validate`,
        { reset_token },
        { headers: { "Content-Type": "application/json" } }
      )
      .then((res) => {
        if (ignore) return;
        try {
          const data = PasswordResetTokenSchema.parse(res.data);
          // expired or used
          if (data.used || new Date(data.expires_at) < new Date()) {
            setErrorMessage("This password reset link is expired or already used.");
            setTokenValidated(false);
          } else {
            setErrorMessage(null);
            setTokenValidated(true);
          }
        } catch {
          setErrorMessage("Unexpected response. Please try again.");
        }
      })
      .catch((err) => {
        if (ignore) return;
        // Could be 400, string err, or xhr fail
        const msg =
          err?.response?.data?.message ||
          err?.message ||
          "Invalid or expired reset token. Please request a new link.";
        setErrorMessage(msg);
        setTokenValidated(false);
      })
      .finally(() => {
        if (!ignore) setIsLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [reset_token]);

  // --- PASSWORD RESET MUTATION ---
  type ResetPasswordPayload = {
    reset_token: string;
    password: string;
  };
  type ResetPasswordAPIResponse =
    | { user: any; token: string }
    | { message: string };

  const resetPasswordMutation = useMutation<
    ResetPasswordAPIResponse,
    any,
    ResetPasswordPayload
  >({
    mutationFn: async (payload: ResetPasswordPayload) => {
      const res = await axios.post(`${API_BASE}/auth/password-reset/complete`, payload, {
        headers: { "Content-Type": "application/json" },
      });
      return res.data;
    },
    onMutate: () => {
      setIsLoading(true);
      setErrorMessage(null);
    },
    onSuccess: (data) => {
      // API: If token && user => success, else error
      if (typeof data === "object" && "token" in data && "user" in data) {
        setResetCompleted(true);
        setErrorMessage(null);
      } else if (typeof data === "object" && "message" in data) {
        setResetCompleted(false);
        setErrorMessage(data.message || "Could not reset password. Try again.");
        // Focus password input for retry
        passwordInputRef.current?.focus();
      } else {
        setResetCompleted(false);
        setErrorMessage("Unknown error. Try again.");
        passwordInputRef.current?.focus();
      }
    },
    onError: (err: any) => {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        "Failed to reset password. Please try again.";
      setResetCompleted(false);
      setErrorMessage(msg);
      passwordInputRef.current?.focus();
    },
    onSettled: () => {
      setIsLoading(false);
    },
  });

  // --- HANDLERS ---
  // Realtime validation
  const validatePasswordValue = (val: string): string | null => {
    if (val.length < PASSWORD_MIN_LENGTH) {
      return `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`;
    }
    return null;
  };

  const validateConfirmPassword = (pw: string, conf: string): string | null => {
    if (pw !== conf) return "Passwords do not match.";
    return null;
  };

  // --- INPUT CHANGE HANDLERS (clear errors) ---
  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value);
    setErrorMessage(null);
  };
  const handleConfirmChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setConfirmPassword(e.target.value);
    setErrorMessage(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Frontend validation
    const pwError = validatePasswordValue(password);
    const confError = validateConfirmPassword(password, confirmPassword);
    if (pwError) {
      setErrorMessage(pwError);
      passwordInputRef.current?.focus();
      return;
    }
    if (confError) {
      setErrorMessage(confError);
      return;
    }
    if (!tokenValidated || !reset_token) {
      setErrorMessage("Token is not valid. Try again via the link in your email.");
      return;
    }
    setErrorMessage(null);
    // Trigger mutation
    resetPasswordMutation.mutate({ reset_token, password });
  };

  // --- RENDER ---
  return (
    <>
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-8 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <h2 className="text-center text-3xl font-bold text-gray-900 mb-4">
            Reset your password
          </h2>
          <p className="text-center text-gray-600 text-base">
            Enter a new password for your account below.
          </p>
        </div>
        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-8 px-6 shadow rounded-lg sm:px-10">
            {/* --- Completion state --- */}
            {resetCompleted ? (
              <div className="space-y-6 text-center">
                <div className="flex justify-center">
                  <svg
                    className="h-12 w-12 text-green-500 mx-auto"
                    viewBox="0 0 24 24"
                    fill="none"
                    aria-hidden="true"
                  >
                    <circle cx="12" cy="12" r="12" fill="#D1FAE5" />
                    <path
                      d="M16.3 8.70001C16.1125 8.51244 15.8596 8.40616 15.595 8.40616C15.3304 8.40616 15.0775 8.51244 14.89 8.70001L11.2 12.38L9.10999 10.3C8.92244 10.1125 8.66957 10.0062 8.40499 10.0062C8.14041 10.0062 7.88754 10.1125 7.69999 10.3C7.51244 10.4876 7.40616 10.7404 7.40616 11.005C7.40616 11.2696 7.51244 11.5224 7.69999 11.71L10.48 14.48C10.5738 14.5738 10.6888 14.6471 10.8177 14.6932C10.9467 14.7392 11.085 14.7568 11.2211 14.7446C11.3573 14.7323 11.4877 14.6907 11.6023 14.624C11.7169 14.5573 11.8125 14.4672 11.88 14.36L16.29 9.95001C16.4775 9.76244 16.5837 9.50964 16.5837 9.24501C16.5837 8.98039 16.4775 8.72756 16.3 8.54001V8.70001Z"
                      fill="currentColor"
                    />
                  </svg>
                </div>
                <h3 className="font-semibold text-xl text-green-700">Password reset successful!</h3>
                <p className="text-gray-700">
                  You can now sign in with your new password.
                </p>
                <Link
                  to="/login"
                  className="inline-flex items-center mt-4 px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 focus:outline-none"
                >
                  Return to Login
                </Link>
              </div>
            ) : (
              <form className="space-y-6" onSubmit={handleSubmit} autoComplete="off">
                {/* Error message */}
                {errorMessage && (
                  <div
                    className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-2"
                    aria-live="polite"
                    tabIndex={-1}
                  >
                    <span className="font-semibold">Error:</span>{" "}
                    <span>{errorMessage}</span>
                  </div>
                )}
                {/* Loading spinner on token validation */}
                {isLoading && (
                  <div className="flex justify-center py-2">
                    <svg
                      className="animate-spin h-6 w-6 text-blue-500"
                      viewBox="0 0 24 24"
                      fill="none"
                      aria-label="Loading"
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
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      ></path>
                    </svg>
                  </div>
                )}
                {/* --- Form fields --- */}
                {/* Don't show if token NOT validated */}
                {!isLoading && tokenValidated && (
                  <>
                    <div>
                      <label
                        htmlFor="password"
                        className="block text-sm font-medium text-gray-700"
                      >
                        New Password
                      </label>
                      <input
                        ref={passwordInputRef}
                        id="password"
                        name="password"
                        type="password"
                        autoComplete="new-password"
                        required
                        minLength={PASSWORD_MIN_LENGTH}
                        value={password}
                        onChange={handlePasswordChange}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        placeholder="Enter new password"
                        tabIndex={0}
                        aria-required="true"
                        aria-label="New password"
                      />
                      {password && password.length > 0 && password.length < PASSWORD_MIN_LENGTH && (
                        <p className="text-xs text-red-500 mt-1" aria-live="polite">
                          Password must be at least {PASSWORD_MIN_LENGTH} characters.
                        </p>
                      )}
                    </div>
                    <div>
                      <label
                        htmlFor="confirm_password"
                        className="block text-sm font-medium text-gray-700"
                      >
                        Confirm New Password
                      </label>
                      <input
                        id="confirm_password"
                        name="confirm_password"
                        type="password"
                        autoComplete="new-password"
                        required
                        value={confirmPassword}
                        onChange={handleConfirmChange}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        placeholder="Confirm new password"
                        tabIndex={0}
                        aria-required="true"
                        aria-label="Confirm new password"
                      />
                      {confirmPassword && password !== confirmPassword && (
                        <p className="text-xs text-red-500 mt-1" aria-live="polite">
                          Passwords do not match.
                        </p>
                      )}
                    </div>
                    <div className="pt-2">
                      <button
                        type="submit"
                        disabled={
                          isLoading ||
                          !password ||
                          !confirmPassword ||
                          password.length < PASSWORD_MIN_LENGTH ||
                          password !== confirmPassword
                        }
                        className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 focus:outline-none transition-colors duration-150 
                        ${isLoading ||
                        !password ||
                        !confirmPassword ||
                        password.length < PASSWORD_MIN_LENGTH ||
                        password !== confirmPassword
                          ? "opacity-50 cursor-not-allowed"
                          : ""}`}
                        tabIndex={0}
                        aria-disabled={
                          isLoading ||
                          !password ||
                          !confirmPassword ||
                          password.length < PASSWORD_MIN_LENGTH ||
                          password !== confirmPassword
                        }
                      >
                        {isLoading ? (
                          <span className="flex items-center">
                            <svg
                              className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                              fill="none"
                              viewBox="0 0 24 24"
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
                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                              ></path>
                            </svg>
                            Resetting...
                          </span>
                        ) : (
                          <>Set New Password</>
                        )}
                      </button>
                    </div>
                    <div className="mt-4 text-center">
                      <Link
                        to="/login"
                        className="text-blue-600 hover:text-blue-500 font-medium text-sm"
                        tabIndex={0}
                      >
                        Back to Login
                      </Link>
                    </div>
                  </>
                )}
                {/* If token invalid, show only link back to reset request or login */}
                {!isLoading && !tokenValidated && (
                  <div className="mt-6 text-center">
                    <Link
                      to="/password-reset-request"
                      className="text-blue-600 hover:text-blue-500 font-medium text-sm"
                    >
                      Request a new password reset link
                    </Link>
                    <span className="text-gray-400 mx-2">|</span>
                    <Link
                      to="/login"
                      className="text-blue-600 hover:text-blue-500 font-medium text-sm"
                    >
                      Back to Login
                    </Link>
                  </div>
                )}
              </form>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default UV_Auth_PasswordReset;