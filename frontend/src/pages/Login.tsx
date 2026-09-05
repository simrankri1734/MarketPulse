import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
} from "firebase/auth";

import { auth } from "../lib/firebase";
import { apiFetch } from "../lib/api";
import "../styles/login.css";

export default function Login() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignup, setIsSignup] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const trimmedEmail = email.trim();

      if (isSignup) {
        await createUserWithEmailAndPassword(
          auth,
          trimmedEmail,
          password
        );
      } else {
        await signInWithEmailAndPassword(
          auth,
          trimmedEmail,
          password
        );
      }

      /*
       * Synchronize the authenticated Firebase user
       * with our backend/MongoDB user record.
       */
      const result = await apiFetch("/auth/me");

      console.log("Backend user:", result.user);

      /*
       * Authentication + backend synchronization succeeded.
       * Now move the user to the protected dashboard.
       */
      navigate("/dashboard", { replace: true });
    } catch (err) {
      if (err instanceof Error) {
        setError(getAuthErrorMessage(err.message));
      } else {
        setError("Authentication failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotPassword() {
    setError("");
    setSuccess("");

    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      setError("Enter your email address first.");
      return;
    }

    setResetLoading(true);

    try {
      await sendPasswordResetEmail(auth, trimmedEmail);

      setSuccess(
        "Password reset email sent. Check your inbox."
      );
    } catch (err) {
      if (err instanceof Error) {
        setError(getAuthErrorMessage(err.message));
      } else {
        setError("Unable to send password reset email.");
      }
    } finally {
      setResetLoading(false);
    }
  }

  function switchMode() {
    setIsSignup((current) => !current);
    setError("");
    setSuccess("");
    setPassword("");
  }

  return (
    <div className="auth-page">

      {/* Background decoration */}
      <div className="auth-glow auth-glow-one" />
      <div className="auth-glow auth-glow-two" />

      <div className="auth-container">

        {/* ================= BRAND ================= */}

        <div className="brand">
          <div className="brand-mark">
            <svg
              viewBox="0 0 32 32"
              width="24"
              height="24"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M5 23L11 16L16 20L26 8"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              <path
                d="M21 8H26V13"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>

          <span>MarketPulse</span>
        </div>

        {/* ================= AUTH CARD ================= */}

        <div className="auth-card">

          {/* Header */}
          <div className="auth-header">

            <div className="live-badge">
              <span className="live-dot" />
              MARKET INTELLIGENCE
            </div>

            <h1>
              {isSignup
                ? "Build your watchlist."
                : "Welcome back."}
            </h1>

            <p>
              {isSignup
                ? "Track what matters and understand meaningful market changes."
                : "See what meaningfully changed since your last check."}
            </p>

          </div>

          {/* ================= FORM ================= */}

          <form onSubmit={handleSubmit}>

            {/* Email */}
            <div className="field">

              <label htmlFor="email">
                Email
              </label>

              <div className="input-wrapper">

                <svg
                  viewBox="0 0 24 24"
                  width="19"
                  height="19"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M4 5H20C21.1 5 22 5.9 22 7V17C22 18.1 21.1 19 20 19H4C2.9 19 2 18.1 2 17V7C2 5.9 2.9 5 4 5Z"
                    stroke="currentColor"
                    strokeWidth="1.7"
                  />

                  <path
                    d="M3 7L12 13L21 7"
                    stroke="currentColor"
                    strokeWidth="1.7"
                  />
                </svg>

                <input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    setError("");
                    setSuccess("");
                  }}
                  autoComplete={
                    isSignup ? "email" : "username"
                  }
                  required
                />

              </div>

            </div>

            {/* Password */}
            <div className="field">

              <div className="field-label-row">

                <label htmlFor="password">
                  Password
                </label>

                {!isSignup && (
                  <button
                    type="button"
                    className="forgot-button"
                    onClick={handleForgotPassword}
                    disabled={resetLoading}
                  >
                    {resetLoading
                      ? "Sending..."
                      : "Forgot password?"}
                  </button>
                )}

              </div>

              <div className="input-wrapper">

                <svg
                  viewBox="0 0 24 24"
                  width="19"
                  height="19"
                  fill="none"
                  aria-hidden="true"
                >
                  <rect
                    x="4"
                    y="10"
                    width="16"
                    height="11"
                    rx="2"
                    stroke="currentColor"
                    strokeWidth="1.7"
                  />

                  <path
                    d="M8 10V7C8 4.8 9.8 3 12 3C14.2 3 16 4.8 16 7V10"
                    stroke="currentColor"
                    strokeWidth="1.7"
                  />
                </svg>

                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    setError("");
                    setSuccess("");
                  }}
                  autoComplete={
                    isSignup
                      ? "new-password"
                      : "current-password"
                  }
                  required
                />

                <button
                  type="button"
                  className="password-toggle"
                  onClick={() =>
                    setShowPassword((value) => !value)
                  }
                  aria-label={
                    showPassword
                      ? "Hide password"
                      : "Show password"
                  }
                >
                  {showPassword ? "Hide" : "Show"}
                </button>

              </div>

            </div>

            {/* Error */}
            {error && (
              <div
                className="error-message"
                role="alert"
              >
                <span>!</span>

                <p>{error}</p>
              </div>
            )}

            {/* Success */}
            {success && (
              <div
                className="success-message"
                role="status"
              >
                <span>✓</span>

                <p>{success}</p>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              className="auth-submit"
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="spinner" />
                  Please wait...
                </>
              ) : (
                <>
                  {isSignup
                    ? "Create MarketPulse account"
                    : "Sign in"}

                  <span>→</span>
                </>
              )}
            </button>

          </form>

          {/* ================= SECURITY ================= */}

          <div className="auth-divider">
            <span />
            <p>SECURE ACCESS</p>
            <span />
          </div>

          <div className="security-note">

            <div className="security-icon">
              ✓
            </div>

            <div>
              <strong>
                Your data stays protected
              </strong>

              <p>
                Authentication is securely handled by Firebase.
              </p>
            </div>

          </div>

          {/* ================= SWITCH ================= */}

          <div className="auth-switch">

            <span>
              {isSignup
                ? "Already have an account?"
                : "New to MarketPulse?"}
            </span>

            <button
              type="button"
              onClick={switchMode}
            >
              {isSignup
                ? "Sign in"
                : "Create account"}
            </button>

          </div>

        </div>

        {/* ================= PRODUCT STATEMENT ================= */}

        <div className="product-points">

          <div>
            <strong>01</strong>
            <span>Build watchlists</span>
          </div>

          <div>
            <strong>02</strong>
            <span>Detect meaningful changes</span>
          </div>

          <div>
            <strong>03</strong>
            <span>Know what deserves attention</span>
          </div>

        </div>

        <p className="copyright">
          MarketPulse · Market intelligence, simplified.
        </p>

      </div>
    </div>
  );
}

/*
 * Convert Firebase's technical error messages
 * into cleaner messages for the user.
 */
function getAuthErrorMessage(message: string): string {
  if (
    message.includes("auth/invalid-credential") ||
    message.includes("auth/invalid-login-credentials")
  ) {
    return "Incorrect email or password.";
  }

  if (message.includes("auth/email-already-in-use")) {
    return "An account with this email already exists.";
  }

  if (message.includes("auth/weak-password")) {
    return "Password should be at least 6 characters.";
  }

  if (message.includes("auth/invalid-email")) {
    return "Please enter a valid email address.";
  }

  if (message.includes("auth/user-not-found")) {
    return "No account was found with this email.";
  }

  if (message.includes("auth/too-many-requests")) {
    return "Too many attempts. Please try again later.";
  }

  if (message.includes("auth/network-request-failed")) {
    return "Network error. Please check your connection.";
  }

  return message;
}