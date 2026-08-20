"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { safeJsonResponse } from "@/lib/safe-fetch-json"
import styles from "./login.module.css"

// ─── SVG Icon Components ──────────────────────────────────────────
function BuildingIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="2" width="16" height="20" rx="2" />
      <path d="M9 22V12h6v10" />
      <path d="M8 6h.01M16 6h.01M12 6h.01M8 10h.01M16 10h.01M12 10h.01" />
    </svg>
  )
}

function MailIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="20" height="16" x="2" y="4" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  )
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  )
}

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function EyeOffIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49" />
      <path d="M14.084 14.158a3 3 0 0 1-4.242-4.242" />
      <path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143" />
      <path d="m2 2 20 20" />
    </svg>
  )
}

function AlertCircleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" x2="12" y1="8" y2="12" />
      <line x1="12" x2="12.01" y1="16" y2="16" />
    </svg>
  )
}

function CheckCircleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <path d="m9 11 3 3L22 4" />
    </svg>
  )
}

function ShieldCheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  )
}

function ArrowLeftIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m12 19-7-7 7-7" />
      <path d="M19 12H5" />
    </svg>
  )
}

// ─── Email validation helper ───────────────────────────────────────
function validateEmail(email: string): { valid: boolean; message: string } {
  if (!email) return { valid: false, message: "" }
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!regex.test(email)) {
    return { valid: false, message: "Please enter a valid email address" }
  }
  return { valid: true, message: "Looks good!" }
}

// ─── Main Component ────────────────────────────────────────────────
export default function LoginPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  // Populated when one identifier belongs to more than one account. Rendering a
  // choice IS the fix: the server no longer silently picks a portal for you.
  const [choices, setChoices] = useState<
    Array<{ accountType: string; label: string; name: string }>
  >([])
  const [error, setError] = useState("")
  const [credentials, setCredentials] = useState({ username: "", password: "" })
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [touched, setTouched] = useState({ email: false, password: false })

  // Trigger mount animation
  useEffect(() => {
    requestAnimationFrame(() => setMounted(true))
  }, [])

  // Supabase client

  // Inline validation
  const emailValidation = useMemo(
    () => (touched.email ? validateEmail(credentials.username) : { valid: false, message: "" }),
    [credentials.username, touched.email]
  )

  const passwordTooShort = touched.password && credentials.password.length > 0 && credentials.password.length < 3

  // Form validity check — both fields must be non-empty
  const isFormValid = credentials.username.trim().length > 0 && credentials.password.trim().length > 0

  // ─── Unified Login Handler (preserves original multi-role logic) ──
  const handleUnifiedLogin = useCallback(
    async (e: React.FormEvent, chosenType?: string) => {
      e.preventDefault()
      setError("")
      setLoading(true)

      try {
        if (!credentials.username || !credentials.password) {
          setError("Please enter your email/username and password.")
          setLoading(false)
          return
        }

        // Authenticate server-side. Passwords are verified (and hashed) on the server;
        // the password column is never sent to the browser.
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: credentials.username.trim(),
            password: credentials.password.trim(),
            // Sent only on the second attempt, after the server told us this
            // identifier belongs to more than one account.
            ...(chosenType ? { accountType: chosenType } : {}),
          }),
        })

        const data = await safeJsonResponse<any>(res, "Unable to reach the authentication service.")

        // 300: this identifier matches accounts in more than one table and the
        // password verified against several of them. The server refuses to guess
        // which portal was meant, so ask rather than sending them to the wrong one.
        if (res.status === 300 && data?.needsChoice) {
          setChoices(data.choices || [])
          setError("")
          setLoading(false)
          return
        }

        if (!res.ok) {
          setError(data?.error || "Invalid email/username or password. Please try again.")
          setLoading(false)
          return
        }

        setChoices([])

        // Clear any previous sessions, then store the one returned by the server
        localStorage.removeItem("admin_session")
        localStorage.removeItem("manager_session")
        localStorage.removeItem("employee_session")
        localStorage.removeItem("tenant_session")
        localStorage.setItem(`${data.role}_session`, JSON.stringify(data.session))

        setCredentials({ username: "", password: "" })
        router.push(data.redirect)
      } catch (err) {
        console.error("Login error:", err)
        setError("An unexpected error occurred. Please check your connection and try again.")
        setLoading(false)
      }
    },
    [credentials, router]
  )

  // ─── Particle data (computed once) ───────────────────────────────
  const particles = useMemo(
    () =>
      Array.from({ length: 8 }, (_, i) => ({
        id: i,
        size: 2 + (i % 4),
        left: 8 + i * 11,
        duration: 10 + i * 3,
        delay: i * 1.8,
        opacity: 0.15 + (i % 3) * 0.1,
      })),
    []
  )

  return (
    <div className={styles.pageContainer}>
      {/* Back to Home */}
      <Link href="/" className={styles.backLink} aria-label="Back to homepage">
        <ArrowLeftIcon />
        <span>Home</span>
      </Link>

      {/* Background Image with Ken Burns */}
      <div className={styles.backgroundImage} role="presentation" />

      {/* Gradient Overlay */}
      <div className={styles.gradientOverlay} role="presentation" />

      {/* Floating Particles */}
      {particles.map((p) => (
        <div
          key={p.id}
          className={styles.particle}
          role="presentation"
          style={{
            width: `${p.size}px`,
            height: `${p.size}px`,
            left: `${p.left}%`,
            bottom: "-10px",
            opacity: p.opacity,
            animationDuration: `${p.duration}s`,
            animationDelay: `${p.delay}s`,
          }}
        />
      ))}

      {/* ─── Login Card ───────────────────────────────── */}
      <div className={`${styles.loginCard} ${mounted ? styles.mounted : ""}`}>
        {/* Header */}
        <div className={styles.cardHeader}>
          {/* Logo */}
          <div className={styles.logoContainer}>
            <div className={styles.logoIcon}>
              <BuildingIcon />
            </div>
            <span className={styles.brandName}>Cielo Vista</span>
          </div>

          {/* Heading */}
          <h1 className={styles.heading}>Welcome Back</h1>
          <p className={styles.subtitle}>
            Sign in to manage your bookings and rentals
          </p>
        </div>

        {/* Body */}
        <div className={styles.cardBody}>
          {/* Error Banner */}
          {error && (
            <div className={styles.errorBanner} role="alert" aria-live="assertive">
              <AlertCircleIcon />
              <p className={styles.errorText}>{error}</p>
            </div>
          )}

          {/* One identifier, more than one account. The server verified the
              password against several and will not guess which portal was
              meant — so the choice is made here, explicitly, once. */}
          {choices.length > 0 && (
            <div
              role="group"
              aria-label="Choose which account to open"
              style={{
                border: "1px solid #C6C1B5",
                borderRadius: 10,
                padding: "14px",
                marginBottom: "16px",
                background: "#FDFCFA",
              }}
            >
              <p style={{ margin: "0 0 10px", fontSize: 14, color: "#4A524B" }}>
                This email is used by more than one account. Which would you like to open?
              </p>
              {choices.map((c) => (
                <button
                  key={c.accountType}
                  type="button"
                  onClick={(ev) => {
                    setLoading(true)
                    void handleUnifiedLogin(ev as unknown as React.FormEvent, c.accountType)
                  }}
                  disabled={loading}
                  style={{
                    display: "flex",
                    width: "100%",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                    minHeight: 52,
                    padding: "12px 14px",
                    marginBottom: 8,
                    border: "1px solid #DEDAD1",
                    borderRadius: 6,
                    background: "#F5F3EE",
                    cursor: loading ? "wait" : "pointer",
                    font: "inherit",
                    textAlign: "left",
                    color: "#1E241F",
                  }}
                >
                  <span>
                    <strong style={{ display: "block", fontSize: 14 }}>{c.label}</strong>
                    {c.name && (
                      <span style={{ fontSize: 12, color: "#767E77" }}>{c.name}</span>
                    )}
                  </span>
                  <span aria-hidden="true" style={{ color: "#35543C" }}>&rarr;</span>
                </button>
              ))}
            </div>
          )}

          <form
            onSubmit={handleUnifiedLogin}
            className={styles.loginForm}
            noValidate
            aria-label="Login form"
          >
            {/* Email / Username Field */}
            <div
              className={`${styles.inputGroup} ${styles.animated}`}
              style={{ animationDelay: "0.4s" }}
            >
              <label htmlFor="login-email" className={styles.inputLabel}>
                Email or Username
              </label>
              <div className={styles.inputWrapper}>
                <MailIcon />
                <input
                  id="login-email"
                  type="text"
                  className={`${styles.inputField} ${
                    touched.email && !emailValidation.valid && emailValidation.message
                      ? styles.hasError
                      : ""
                  }`}
                  value={credentials.username}
                  onChange={(e) =>
                    setCredentials({ ...credentials, username: e.target.value })
                  }
                  onBlur={() => setTouched((t) => ({ ...t, email: true }))}
                  placeholder="example@email.com"
                  disabled={loading}
                  required
                  autoComplete="off"
                  aria-describedby="email-validation"
                  aria-invalid={touched.email && !emailValidation.valid && !!emailValidation.message}
                />
              </div>
              {/* Inline Validation */}
              {touched.email && emailValidation.message && (
                <div
                  id="email-validation"
                  className={`${styles.validationMessage} ${
                    emailValidation.valid ? styles.success : styles.error
                  }`}
                >
                  {emailValidation.valid ? <CheckCircleIcon /> : <AlertCircleIcon />}
                  <span>{emailValidation.message}</span>
                </div>
              )}
            </div>

            {/* Password Field */}
            <div
              className={`${styles.inputGroup} ${styles.animated}`}
              style={{ animationDelay: "0.5s" }}
            >
              <label htmlFor="login-password" className={styles.inputLabel}>
                Password
              </label>
              <div className={styles.inputWrapper}>
                <LockIcon />
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  className={`${styles.inputField} ${passwordTooShort ? styles.hasError : ""}`}
                  value={credentials.password}
                  onChange={(e) =>
                    setCredentials({ ...credentials, password: e.target.value })
                  }
                  onBlur={() => setTouched((t) => ({ ...t, password: true }))}
                  placeholder="Enter your password"
                  disabled={loading}
                  required
                  autoComplete="new-password"
                  aria-describedby="password-validation"
                  style={{ paddingRight: "3rem" }}
                />
                {/* Show/Hide Toggle */}
                <button
                  type="button"
                  className={styles.passwordToggle}
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  tabIndex={0}
                >
                  {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
              {/* Password Validation */}
              {passwordTooShort && (
                <div id="password-validation" className={`${styles.validationMessage} ${styles.error}`}>
                  <AlertCircleIcon />
                  <span>Password is too short</span>
                </div>
              )}
            </div>

            {/* Remember Me + Forgot Password */}
            <div className={styles.rowActions}>
              <label className={styles.rememberMe}>
                <input
                  type="checkbox"
                  className={styles.checkbox}
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  aria-label="Remember me"
                />
                <span className={styles.rememberLabel}>Remember me</span>
              </label>
              <Link href="/forgot-password" className={styles.forgotLink}>
                Forgot Password?
              </Link>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              className={styles.submitButton}
              disabled={loading || !isFormValid}
              aria-busy={loading}
            >
              {loading ? (
                <>
                  <span className={styles.spinner} aria-hidden="true" />
                  <span>Signing in…</span>
                </>
              ) : (
                <span>Login</span>
              )}
            </button>
          </form>

          {/* Sign Up Link */}
          <div className={styles.footerLinks}>
            <p className={styles.footerText}>
              Don&apos;t have an account?{" "}
              <Link href="/tenant/register" className={styles.signupLink}>
                Create an Account
              </Link>
            </p>
            <p className={styles.footerText}>
              Just want to reserve a place?{" "}
              <Link href="/booking" className={styles.signupLink}>
                Book as a Guest
              </Link>
            </p>
          </div>

          {/* Trust Badge */}
          <div className={styles.trustBadge}>
            <ShieldCheckIcon />
            <span className={styles.trustText}>Your data is secure and encrypted</span>
          </div>
        </div>
      </div>
    </div>
  )
}
