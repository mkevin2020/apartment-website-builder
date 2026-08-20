"use client"

import { useState, useEffect } from "react"
import styles from "./otp-verification.module.css"

interface OTPVerificationModalProps {
  isOpen: boolean
  email: string
  onVerified: (otp: string) => void
  onCancel: () => void
  loading?: boolean
  /** Where the code was sent: "email" (default) or "sms" */
  channel?: "email" | "sms"
  /** Phone the code went to (shown when channel is sms, used for resend) */
  phone?: string
  flowType?: string
}

export default function OTPVerificationModal({
  isOpen,
  email,
  onVerified,
  onCancel,
  loading = false,
  channel = "email",
  phone = "",
  flowType = "registration",
}: OTPVerificationModalProps) {
  const [otp, setOtp] = useState("")
  const [error, setError] = useState("")
  const [verifying, setVerifying] = useState(false)
  // Use 60 seconds for development (can be changed to 900 for production)
  const OTP_TIMEOUT = parseInt(process.env.NEXT_PUBLIC_OTP_TIMEOUT || "60", 10)
  const [timeLeft, setTimeLeft] = useState(OTP_TIMEOUT)
  const [canResend, setCanResend] = useState(false)
  const [resendLoading, setResendLoading] = useState(false)

  // Countdown timer
  useEffect(() => {
    if (!isOpen) {
      setTimeLeft(OTP_TIMEOUT)
      setCanResend(false)
      return
    }

    setTimeLeft(OTP_TIMEOUT)
    setCanResend(false)

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        const newTime = prev - 1
        if (newTime <= 0) {
          setCanResend(true)
          return 0
        }
        return newTime
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [isOpen, OTP_TIMEOUT])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  const handleOTPChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, "").slice(0, 6)
    setOtp(value)
    setError("")
  }

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (!otp || otp.length !== 6) {
      setError("Please enter a valid 6-digit OTP")
      return
    }

    setVerifying(true)

    try {
      const response = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.message || data.error || "Failed to verify OTP")
        setOtp("")
        setVerifying(false)
        return
      }

      // OTP verified successfully. The code is handed to the parent so the
      // final step can be authorised server-side — a client-side "we already
      // checked" flag is not something the server can trust.
      onVerified(otp)
    } catch (err) {
      setError("An error occurred. Please try again.")
      setVerifying(false)
    }
  }

  const handleResend = async () => {
    setResendLoading(true)
    setError("")

    try {
      const response = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Resend on the same channel the tenant originally chose
        body: JSON.stringify({ email, flowType, phone, channel }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || "Failed to resend OTP")
        setResendLoading(false)
        return
      }

      setCanResend(false)
      setTimeLeft(OTP_TIMEOUT)
      setOtp("")
      setResendLoading(false)
    } catch (err) {
      setError("Failed to resend OTP")
      setResendLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContent}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerIcon}>{channel === "sms" ? "💬" : "✉️"}</div>
          <h2 className={styles.title}>
            {channel === "email" ? "Verify Your Email" : "Verify Your Account"}
          </h2>
          <p className={styles.subtitle}>
            We've sent a 6-digit code {channel === "sms" ? "by SMS" : ""} to <br />
            <strong>{channel === "email" ? email : phone || email}</strong>
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className={styles.errorBanner}>
            <span className={styles.errorIcon}>⚠️</span>
            <p className={styles.errorText}>{error}</p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleVerify} className={styles.form}>
          {/* OTP Input */}
          <div className={styles.inputGroup}>
            <label htmlFor="otp" className={styles.label}>
              Enter OTP Code
            </label>
            <input
              id="otp"
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={otp}
              onChange={handleOTPChange}
              placeholder="000000"
              className={styles.otpInput}
              disabled={verifying || loading}
              autoComplete="off"
            />
            <div className={styles.inputHint}>
              Enter the 6-digit code sent to your {channel === "sms" ? "phone" : "email"}
            </div>
          </div>

          {/* Timer */}
          <div className={styles.timerSection}>
            <span className={styles.timerLabel}>Code expires in:</span>
            <span
              className={`${styles.timer} ${
                timeLeft < 300 ? styles.timerWarning : ""
              }`}
            >
              {formatTime(timeLeft)}
            </span>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            className={styles.submitButton}
            disabled={verifying || loading || otp.length !== 6}
          >
            {verifying || loading ? (
              <>
                <span className={styles.spinner} />
                Verifying...
              </>
            ) : (
              "Verify OTP"
            )}
          </button>
        </form>

        {/* Resend OTP */}
        <div className={styles.resendSection}>
          {canResend ? (
            <button
              type="button"
              className={styles.resendButton}
              onClick={handleResend}
              disabled={resendLoading}
            >
              {resendLoading ? "Sending..." : "Resend OTP"}
            </button>
          ) : (
            <p className={styles.resendText}>
              Didn't receive the code?{" "}
              <span className={styles.resendWait}>
                Resend in {formatTime(timeLeft)}
              </span>
            </p>
          )}
        </div>

        {/* Footer Info */}
        <div className={styles.footerInfo}>
          <p>
            🔒 Your email is secure. We'll never share your information with
            third parties.
          </p>
        </div>

        {/* Cancel Button */}
        <button
          type="button"
          className={styles.cancelButton}
          onClick={onCancel}
          disabled={verifying || loading}
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
