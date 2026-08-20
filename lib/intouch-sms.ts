// IntouchSMS sender (Rwanda). Replaces the old Twilio integration.
//
// Verified against the live API (mirrors the working PHP/cURL example):
//   POST https://www.intouchsms.co.rw/api/sendsms/.json
//   Auth: HTTP Basic (username:password)   <-- NOT body fields
//   Content-Type: application/x-www-form-urlencoded
//   Body: sender, recipients, message
//
// Required env (.env.local):
//   INTOUCH_USERNAME, INTOUCH_PASSWORD, INTOUCH_SENDER_ID
//   INTOUCH_SMS_API_URL (defaults to the correct www URL)
//
// Until those are set, sending is a safe no-op (returns disabled) so nothing breaks.

export interface IntouchSmsResult {
  success: boolean
  disabled?: boolean
  data?: any
  error?: string
  message?: string
}

function isPlaceholder(v?: string) {
  return !v || v.startsWith("your_") || v.includes("your-")
}

// Normalise a Rwandan number to 2507XXXXXXXX (no +, no spaces).
function normalizePhone(raw: string): string {
  let p = raw.trim().replace(/[\s()-]/g, "").replace(/^\+/, "")
  if (p.startsWith("0")) p = "250" + p.slice(1)
  else if (p.length === 9 && p.startsWith("7")) p = "250" + p
  return p
}

export async function sendIntouchSMS(phoneNumber: string, message: string): Promise<IntouchSmsResult> {
  const apiUrl = process.env.INTOUCH_SMS_API_URL || "https://www.intouchsms.co.rw/api/sendsms/.json"
  const username = process.env.INTOUCH_USERNAME
  const password = process.env.INTOUCH_PASSWORD
  const sender = process.env.INTOUCH_SENDER_ID

  // Not fully configured yet — don't crash, just skip.
  if (isPlaceholder(username) || isPlaceholder(password) || !sender || !phoneNumber) {
    console.warn("IntouchSMS not fully configured (need username, password, sender) — SMS skipped.")
    return { success: true, disabled: true, message: "IntouchSMS not configured yet" }
  }

  const body = new URLSearchParams()
  body.set("sender", sender)
  body.set("recipients", normalizePhone(phoneNumber))
  body.set("message", message)

  // HTTP Basic Auth, exactly like CURLOPT_USERPWD = "username:password"
  const auth = Buffer.from(`${username}:${password}`).toString("base64")

  try {
    const res = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${auth}`,
      },
      body: body.toString(),
    })

    const data = await res.json().catch(() => ({}))

    // Success: { success: true, details: [...] }
    // Error:   { success: false, response: [{ errors: { error: "..." } }] } or { detail: "..." }
    if (data?.success === false || res.status >= 400) {
      const err = data?.response?.[0]?.errors?.error || data?.detail || `IntouchSMS error ${res.status}`
      return { success: false, error: err }
    }
    return { success: true, data }
  } catch (err: any) {
    return { success: false, error: err?.message || "IntouchSMS request failed" }
  }
}
