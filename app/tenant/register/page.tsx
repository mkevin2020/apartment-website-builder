"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useRouter } from "next/navigation"
import bcrypt from "bcryptjs"
import Link from "next/link"
import OTPVerificationModal from "@/components/OTPVerificationModal"
import { sanitizePhone } from "@/lib/utils"
import styles from "./register.module.css"

// ─── SVG Icon Components (small, inline) ──────────────────────────

function BuildingIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="2" width="16" height="20" rx="2" />
      <path d="M9 22V12h6v10" />
      <path d="M8 6h.01M16 6h.01M12 6h.01M8 10h.01M16 10h.01M12 10h.01" />
    </svg>
  )
}

function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
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

function PhoneIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.362 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.338 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  )
}

function IdCardIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 10h2M16 14h2M6.17 15a3 3 0 0 1 5.66 0" />
      <circle cx="9" cy="11" r="2" />
      <rect x="2" y="5" width="20" height="14" rx="2" />
    </svg>
  )
}

function HeartPulseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
      <path d="M3.22 12H9.5l.5-1 2 4.5 2-7 1.5 3.5h5.27" />
    </svg>
  )
}

function MapPinIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  )
}

function GlobeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
      <path d="M2 12h20" />
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

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  )
}

function CheckCircleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <path d="m9 11 3 3L22 4" />
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

function ArrowRightIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
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

function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8" />
      <path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    </svg>
  )
}

// ─── Password strength helper ──────────────────────────────────────
function getPasswordStrength(pw: string): { level: number; label: string } {
  if (!pw) return { level: 0, label: "" }
  let score = 0
  if (pw.length >= 6) score++
  if (pw.length >= 8) score++
  if (/[A-Z]/.test(pw)) score++
  if (/[0-9]/.test(pw)) score++
  if (/[^A-Za-z0-9]/.test(pw)) score++
  if (score <= 2) return { level: 1, label: "Weak" }
  if (score <= 3) return { level: 2, label: "Medium" }
  return { level: 3, label: "Strong" }
}

// ─── Main Component ────────────────────────────────────────────────
export default function TenantRegisterPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)
  const [step, setStep] = useState(1)
  const [direction, setDirection] = useState<"forward" | "backward">("forward")
  const [mounted, setMounted] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [showOTPModal, setShowOTPModal] = useState(false)
  const [otpEmail, setOtpEmail] = useState("")
  const [otpChannel, setOtpChannel] = useState<"email" | "sms">("email")

  const [formData, setFormData] = useState({
    username: "",
    full_name: "",
    email: "",
    password: "",
    confirm_password: "",
    phone: "",
    id_number: "",
    emergency_contact: "",
    emergency_contact_phone: "",
    address: "",
    city: "",
    country: "",
  })

  useEffect(() => {
    requestAnimationFrame(() => setMounted(true))
  }, [])

  // ─── Input handler ────────────────────────────────────────────
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    // Phone fields accept digits and an optional leading "+" only
    const next = name === "phone" || name === "emergency_contact_phone" ? sanitizePhone(value) : value
    setFormData((prev) => ({ ...prev, [name]: next }))
  }, [])

  const handleBlur = useCallback((field: string) => {
    setTouched((t) => ({ ...t, [field]: true }))
  }, [])

  // ─── Validation ───────────────────────────────────────────────
  const emailValid = useMemo(() => {
    if (!formData.email) return null
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)
  }, [formData.email])

  const passwordStrength = useMemo(() => getPasswordStrength(formData.password), [formData.password])

  const passwordsMatch = useMemo(() => {
    if (!formData.confirm_password) return null
    return formData.password === formData.confirm_password
  }, [formData.password, formData.confirm_password])

  const validateStep1 = useCallback(() => {
    if (!formData.username.trim()) { setError("Username is required"); return false }
    if (formData.username.length < 3) { setError("Username must be at least 3 characters"); return false }
    if (!formData.full_name.trim()) { setError("Full name is required"); return false }
    if (!formData.email.trim() || !emailValid) { setError("A valid email address is required"); return false }
    if (!formData.password || formData.password.length < 6) { setError("Password must be at least 6 characters"); return false }
    if (formData.password !== formData.confirm_password) { setError("Passwords do not match"); return false }
    return true
  }, [formData, emailValid])

  const validateStep2 = useCallback(() => {
    if (!formData.phone.trim()) { setError("Phone number is required"); return false }
    if (!formData.id_number.trim()) { setError("ID number is required"); return false }
    if (!formData.emergency_contact.trim()) { setError("Emergency contact name is required"); return false }
    if (!formData.emergency_contact_phone.trim()) { setError("Emergency contact phone is required"); return false }
    return true
  }, [formData])

  const validateStep3 = useCallback(() => {
    if (!formData.address.trim()) { setError("Address is required"); return false }
    if (!formData.city.trim()) { setError("City is required"); return false }
    if (!formData.country.trim()) { setError("Country is required"); return false }
    return true
  }, [formData])

  const handleNextStep = useCallback(() => {
    setError("")
    if (step === 1 && validateStep1()) {
      setDirection("forward")
      setStep(2)
    } else if (step === 2 && validateStep2()) {
      setDirection("forward")
      setStep(3)
    }
  }, [step, validateStep1, validateStep2])

  const handlePrevStep = useCallback(() => {
    setError("")
    setDirection("backward")
    setStep((s) => s - 1)
  }, [])

  // ─── Registration handler ─────────────────────────────────────
  const handleRegister = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      setError("")
      setLoading(true)

      try {
        if (!validateStep3()) { setLoading(false); return }

        const trimmedEmail = formData.email.trim().toLowerCase()
        const trimmedUsername = formData.username.trim().toLowerCase()

        // Uniqueness is checked server-side. Running these queries from the
        // browser required client read access to `tenants` and gave anyone an
        // oracle for testing whether an email — or a national ID number —
        // belongs to a resident here.
        const availabilityRes = await fetch("/api/tenant/check-availability", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: trimmedUsername,
            email: trimmedEmail,
            idNumber: formData.id_number,
          }),
        })

        if (!availabilityRes.ok) {
          setError("Could not verify your details. Please try again."); setLoading(false); return
        }

        const availability = await availabilityRes.json()
        if (availability.usernameTaken) {
          setError("This username is already taken. Please choose another."); setLoading(false); return
        }
        if (availability.emailTaken) {
          setError("This email is already registered. Try logging in instead."); setLoading(false); return
        }
        if (availability.idNumberTaken) {
          setError("This ID number is already registered."); setLoading(false); return
        }

        // Send OTP on the channel the tenant chose (email or SMS)
        const otpResponse = await fetch("/api/auth/send-otp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: trimmedEmail,
            flowType: "registration",
            phone: formData.phone,
            channel: otpChannel,
          }),
        })

        const otpData = await otpResponse.json()

        if (!otpResponse.ok) {
          setError(otpData.error || "Failed to send OTP. Please try again."); setLoading(false); return
        }

        // OTP sent successfully - show modal
        setOtpEmail(trimmedEmail)
        setShowOTPModal(true)
        setLoading(false)
      } catch (err) {
        console.error("Registration error:", err)
        setError("An unexpected error occurred. Please try again.")
        setLoading(false)
      }
    },
    [formData, validateStep3, otpChannel]
  )

  // ─── Handle OTP Verification ─────────────────────────────────
  const handleOTPVerified = useCallback(
    async () => {
      setLoading(true)
      setError("")

      try {
        // Registration happens on the server: it re-checks the OTP, hashes the
        // password, encrypts the ID number and forces approval_status/is_active
        // — none of which can be trusted to the browser.
        const res = await fetch("/api/tenant/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: formData.username,
            full_name: formData.full_name,
            email: otpEmail, // normalized email from OTP
            password: formData.password,
            phone: formData.phone,
            id_number: formData.id_number,
            emergency_contact: formData.emergency_contact,
            emergency_contact_phone: formData.emergency_contact_phone,
            address: formData.address,
            city: formData.city,
            country: formData.country,
          }),
        })

        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          setError(data?.error || "Registration failed. Please try again.")
          setLoading(false)
          return
        }

        setShowOTPModal(false)
        setSuccess(true)
        setTimeout(() => router.push("/login"), 3500)
      } catch (err) {
        console.error("OTP verification error:", err)
        setError("An unexpected error occurred. Please try again.")
        setLoading(false)
      }
    },
    [formData, otpEmail, router]
  )

  // ─── Handle OTP Cancel ────────────────────────────────────────
  const handleOTPCancel = useCallback(() => {
    setShowOTPModal(false)
    setOtpEmail("")
  }, [])

  // ─── Particles (computed once) ────────────────────────────────
  const particles = useMemo(
    () => Array.from({ length: 6 }, (_, i) => ({
      id: i, size: 2 + (i % 3), left: 10 + i * 14,
      duration: 12 + i * 3, delay: i * 2,
    })),
    []
  )

  // Step metadata
  const steps = [
    { num: 1, label: "Account" },
    { num: 2, label: "Personal" },
    { num: 3, label: "Address" },
  ]

  // ─── Success Screen ───────────────────────────────────────────
  if (success) {
    return (
      <div className={styles.pageContainer}>
        <div className={styles.backgroundImage} role="presentation" />
        <div className={styles.gradientOverlay} role="presentation" />
        <div className={styles.successCard}>
          <div className={styles.successIconWrap}>
            <CheckCircleIcon />
          </div>
          <h2 className={styles.successTitle}>Registration Successful!</h2>
          <p className={styles.successMessage}>
            Your account has been created and is pending admin approval.
            We&apos;ll notify you via email once approved.
          </p>
          <p className={styles.successSub}>Redirecting to login…</p>
          <div className={styles.progressDots}>
            <span className={styles.dot} />
            <span className={styles.dot} />
            <span className={styles.dot} />
          </div>
        </div>
      </div>
    )
  }

  // ─── Main Registration Form ───────────────────────────────────
  return (
    <div className={styles.pageContainer}>
      {/* Navigation Links */}
      <div className={styles.backLinks}>
        <Link href="/" className={styles.backLink} aria-label="Back to homepage">
          <ArrowLeftIcon />
          <span>Home</span>
        </Link>
        <Link href="/login" className={styles.backLink} aria-label="Back to login">
          <LockIcon />
          <span>Login</span>
        </Link>
      </div>

      {/* Background */}
      <div className={styles.backgroundImage} role="presentation" />
      <div className={styles.gradientOverlay} role="presentation" />

      {/* Particles */}
      {particles.map((p) => (
        <div key={p.id} className={styles.particle} role="presentation" style={{
          width: `${p.size}px`, height: `${p.size}px`,
          left: `${p.left}%`, bottom: "-10px",
          animationDuration: `${p.duration}s`, animationDelay: `${p.delay}s`,
        }} />
      ))}

      {/* Card */}
      <div className={`${styles.registerCard} ${mounted ? styles.mounted : ""}`}>
        {/* Header */}
        <div className={styles.cardHeader}>
          <div className={styles.logoContainer}>
            <div className={styles.logoIcon}><BuildingIcon /></div>
            <span className={styles.brandName}>Cielo Vista</span>
          </div>
          <h1 className={styles.heading}>Create Your Account</h1>
          <p className={styles.subtitle}>Join our community of premium apartment residents</p>
        </div>

        {/* Progress Stepper */}
        <div className={styles.stepper}>
          {steps.map((s, i) => (
            <div key={s.num} className={styles.stepItem}>
              <div className={`${styles.stepCircle} ${
                step > s.num ? styles.completed : step === s.num ? styles.active : styles.inactive
              }`}>
                {step > s.num ? <CheckIcon /> : s.num}
              </div>
              {i < steps.length - 1 && (
                <div className={`${styles.stepConnector} ${
                  step > s.num ? styles.completed : styles.inactive
                }`} />
              )}
            </div>
          ))}
        </div>
        <div className={styles.stepLabels}>
          {steps.map((s) => (
            <span key={s.num} className={`${styles.stepLabel} ${
              step > s.num ? styles.completed : step === s.num ? styles.active : styles.inactive
            }`}>
              {s.label}
            </span>
          ))}
        </div>

        {/* Body */}
        <div className={styles.cardBody}>
          {/* Error */}
          {error && (
            <div className={styles.errorBanner} role="alert">
              <AlertCircleIcon />
              <p className={styles.errorText}>{error}</p>
            </div>
          )}

          <form
            onSubmit={step === 3 ? handleRegister : (e) => { e.preventDefault(); handleNextStep() }}
            className={styles.registerForm}
            noValidate
          >
            {/* ─── Step 1: Account Details ─────────────────── */}
            {step === 1 && (
              <div className={direction === "forward" ? styles.stepContent : styles.stepContentReverse} key="step1">
                {/* Username */}
                <div className={styles.inputGroup}>
                  <label htmlFor="reg-username" className={styles.inputLabel}>Username</label>
                  <div className={styles.inputWrapper}>
                    <UserIcon />
                    <input id="reg-username" name="username" type="text"
                      className={styles.inputField} value={formData.username}
                      onChange={handleInputChange} onBlur={() => handleBlur("username")}
                      placeholder="Choose a username" disabled={loading} required
                      autoComplete="username" />
                  </div>
                  {touched.username && formData.username && formData.username.length < 3 && (
                    <div className={`${styles.validationMsg} ${styles.error}`}>
                      <AlertCircleIcon /><span>Must be at least 3 characters</span>
                    </div>
                  )}
                </div>

                {/* Full Name */}
                <div className={styles.inputGroup} style={{ marginTop: "0.75rem" }}>
                  <label htmlFor="reg-fullname" className={styles.inputLabel}>Full Name</label>
                  <div className={styles.inputWrapper}>
                    <UserIcon />
                    <input id="reg-fullname" name="full_name" type="text"
                      className={styles.inputField} value={formData.full_name}
                      onChange={handleInputChange} placeholder="Enter your full name"
                      disabled={loading} required autoComplete="name" />
                  </div>
                </div>

                {/* Email */}
                <div className={styles.inputGroup} style={{ marginTop: "0.75rem" }}>
                  <label htmlFor="reg-email" className={styles.inputLabel}>Email Address</label>
                  <div className={styles.inputWrapper}>
                    <MailIcon />
                    <input id="reg-email" name="email" type="email"
                      className={`${styles.inputField} ${touched.email && emailValid === false ? styles.hasError : ""}`}
                      value={formData.email} onChange={handleInputChange}
                      onBlur={() => handleBlur("email")}
                      placeholder="example@email.com" disabled={loading}
                      required autoComplete="email" />
                  </div>
                  {touched.email && formData.email && emailValid === false && (
                    <div className={`${styles.validationMsg} ${styles.error}`}>
                      <AlertCircleIcon /><span>Please enter a valid email</span>
                    </div>
                  )}
                </div>

                {/* Password */}
                <div className={styles.inputGroup} style={{ marginTop: "0.75rem" }}>
                  <label htmlFor="reg-password" className={styles.inputLabel}>Password</label>
                  <div className={styles.inputWrapper}>
                    <LockIcon />
                    <input id="reg-password" name="password" type={showPassword ? "text" : "password"}
                      className={styles.inputField} value={formData.password}
                      onChange={handleInputChange} onBlur={() => handleBlur("password")}
                      placeholder="Min 6 characters" disabled={loading}
                      required autoComplete="new-password"
                      style={{ paddingRight: "2.5rem" }} />
                    <button type="button" className={styles.passwordToggle}
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? "Hide password" : "Show password"}>
                      {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                    </button>
                  </div>
                  {/* Password Strength */}
                  {formData.password && (
                    <>
                      <div className={styles.passwordStrength}>
                        {[1, 2, 3].map((n) => (
                          <div key={n} className={`${styles.strengthBar} ${
                            passwordStrength.level >= n
                              ? passwordStrength.level === 1 ? styles.weak
                              : passwordStrength.level === 2 ? styles.medium
                              : styles.strong : ""
                          }`} />
                        ))}
                      </div>
                      <span className={`${styles.strengthText} ${
                        passwordStrength.level === 1 ? styles.weak
                        : passwordStrength.level === 2 ? styles.medium
                        : styles.strong
                      }`}>
                        {passwordStrength.label} password
                      </span>
                    </>
                  )}
                </div>

                {/* Confirm Password */}
                <div className={styles.inputGroup} style={{ marginTop: "0.75rem" }}>
                  <label htmlFor="reg-confirm" className={styles.inputLabel}>Confirm Password</label>
                  <div className={styles.inputWrapper}>
                    <LockIcon />
                    <input id="reg-confirm" name="confirm_password" type={showConfirm ? "text" : "password"}
                      className={`${styles.inputField} ${touched.confirm_password && passwordsMatch === false ? styles.hasError : ""}`}
                      value={formData.confirm_password} onChange={handleInputChange}
                      onBlur={() => handleBlur("confirm_password")}
                      placeholder="Re-enter your password" disabled={loading}
                      required autoComplete="new-password"
                      style={{ paddingRight: "2.5rem" }} />
                    <button type="button" className={styles.passwordToggle}
                      onClick={() => setShowConfirm(!showConfirm)}
                      aria-label={showConfirm ? "Hide password" : "Show password"}>
                      {showConfirm ? <EyeOffIcon /> : <EyeIcon />}
                    </button>
                  </div>
                  {touched.confirm_password && formData.confirm_password && (
                    <div className={`${styles.validationMsg} ${passwordsMatch ? styles.success : styles.error}`}>
                      {passwordsMatch ? <CheckIcon /> : <AlertCircleIcon />}
                      <span>{passwordsMatch ? "Passwords match" : "Passwords do not match"}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ─── Step 2: Personal Details ────────────────── */}
            {step === 2 && (
              <div className={direction === "forward" ? styles.stepContent : styles.stepContentReverse} key="step2">
                {/* Phone */}
                <div className={styles.inputGroup}>
                  <label htmlFor="reg-phone" className={styles.inputLabel}>Phone Number</label>
                  <div className={styles.inputWrapper}>
                    <PhoneIcon />
                    <input id="reg-phone" name="phone" type="tel"
                      className={styles.inputField} value={formData.phone}
                      onChange={handleInputChange} placeholder="+250 7XX XXX XXX"
                      disabled={loading} required autoComplete="tel" />
                  </div>
                </div>

                {/* ID Number */}
                <div className={styles.inputGroup} style={{ marginTop: "0.75rem" }}>
                  <label htmlFor="reg-id" className={styles.inputLabel}>National ID Number</label>
                  <div className={styles.inputWrapper}>
                    <IdCardIcon />
                    <input id="reg-id" name="id_number" type="text"
                      className={styles.inputField} value={formData.id_number}
                      onChange={handleInputChange} placeholder="Enter your ID number"
                      disabled={loading} required />
                  </div>
                </div>

                {/* Emergency Contact */}
                <div className={styles.inputGroup} style={{ marginTop: "0.75rem" }}>
                  <label htmlFor="reg-emergency" className={styles.inputLabel}>Emergency Contact Name</label>
                  <div className={styles.inputWrapper}>
                    <HeartPulseIcon />
                    <input id="reg-emergency" name="emergency_contact" type="text"
                      className={styles.inputField} value={formData.emergency_contact}
                      onChange={handleInputChange} placeholder="Contact person name"
                      disabled={loading} required />
                  </div>
                </div>

                {/* Emergency Phone */}
                <div className={styles.inputGroup} style={{ marginTop: "0.75rem" }}>
                  <label htmlFor="reg-emergency-phone" className={styles.inputLabel}>Emergency Contact Phone</label>
                  <div className={styles.inputWrapper}>
                    <PhoneIcon />
                    <input id="reg-emergency-phone" name="emergency_contact_phone" type="tel"
                      className={styles.inputField} value={formData.emergency_contact_phone}
                      onChange={handleInputChange} placeholder="+250 7XX XXX XXX"
                      disabled={loading} required autoComplete="tel" />
                  </div>
                </div>
              </div>
            )}

            {/* ─── Step 3: Address Details ─────────────────── */}
            {step === 3 && (
              <div className={direction === "forward" ? styles.stepContent : styles.stepContentReverse} key="step3">
                {/* Address */}
                <div className={styles.inputGroup}>
                  <label htmlFor="reg-address" className={styles.inputLabel}>Street Address</label>
                  <div className={styles.inputWrapper}>
                    <HomeIcon />
                    <input id="reg-address" name="address" type="text"
                      className={styles.inputField} value={formData.address}
                      onChange={handleInputChange} placeholder="Enter your street address"
                      disabled={loading} required autoComplete="street-address" />
                  </div>
                </div>

                {/* City & Country in a row */}
                <div className={styles.inputRow} style={{ marginTop: "0.75rem" }}>
                  <div className={styles.inputGroup}>
                    <label htmlFor="reg-city" className={styles.inputLabel}>City</label>
                    <div className={styles.inputWrapper}>
                      <MapPinIcon />
                      <input id="reg-city" name="city" type="text"
                        className={styles.inputField} value={formData.city}
                        onChange={handleInputChange} placeholder="e.g. Kigali"
                        disabled={loading} required autoComplete="address-level2" />
                    </div>
                  </div>

                  <div className={styles.inputGroup}>
                    <label htmlFor="reg-country" className={styles.inputLabel}>Country</label>
                    <div className={styles.inputWrapper}>
                      <GlobeIcon />
                      <input id="reg-country" name="country" type="text"
                        className={styles.inputField} value={formData.country}
                        onChange={handleInputChange} placeholder="e.g. Rwanda"
                        disabled={loading} required autoComplete="country-name" />
                    </div>
                  </div>
                </div>

                {/* OTP delivery channel */}
                <div className={styles.inputGroup} style={{ marginTop: "0.75rem" }}>
                  <label className={styles.inputLabel}>Send my verification code by</label>
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    {([
                      { value: "email", label: "✉️ Email" },
                      { value: "sms", label: "💬 SMS" },
                    ] as const).map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setOtpChannel(opt.value)}
                        disabled={loading}
                        style={{
                          flex: 1,
                          padding: "0.6rem 0.5rem",
                          borderRadius: "0.75rem",
                          fontSize: "0.85rem",
                          fontWeight: 600,
                          cursor: "pointer",
                          border: otpChannel === opt.value ? "2px solid #2563eb" : "2px solid #e2e8f0",
                          background: otpChannel === opt.value ? "#eff6ff" : "transparent",
                          color: otpChannel === opt.value ? "#1d4ed8" : "#64748b",
                        }}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ─── Navigation Buttons ──────────────────────── */}
            <div className={styles.buttonRow}>
              {step > 1 && (
                <button type="button" className={styles.btnSecondary}
                  onClick={handlePrevStep} disabled={loading}>
                  <ArrowLeftIcon /><span>Back</span>
                </button>
              )}

              <button type="submit"
                className={`${styles.btnPrimary} ${step === 3 ? styles.green : ""}`}
                disabled={loading} aria-busy={loading}>
                {loading ? (
                  <><span className={styles.spinner} /><span>Processing…</span></>
                ) : step === 3 ? (
                  <><span>Create Account</span></>
                ) : (
                  <><span>Continue</span><ArrowRightIcon /></>
                )}
              </button>
            </div>
          </form>

          {/* Footer */}
          <div className={styles.footer}>
            <p className={styles.footerText}>
              Already have an account?{" "}
              <Link href="/login" className={styles.loginLink}>Sign In</Link>
            </p>
          </div>

          {/* Trust */}
          <div className={styles.trustBadge}>
            <ShieldCheckIcon />
            <span className={styles.trustText}>Your data is secure and encrypted</span>
          </div>
        </div>
      </div>

      {/* OTP Verification Modal */}
      <OTPVerificationModal
        isOpen={showOTPModal}
        email={otpEmail}
        channel={otpChannel}
        phone={formData.phone}
        flowType="registration"
        onVerified={handleOTPVerified}
        onCancel={handleOTPCancel}
        loading={loading}
      />
    </div>
  )
}
