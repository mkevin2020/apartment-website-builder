import { NextRequest, NextResponse } from 'next/server'
import { sendIntouchSMS } from '@/lib/intouch-sms'
import { requireSession, errorResponse } from '@/lib/auth/session'
import { enforceRateLimit } from '@/lib/auth/rate-limit'
import { parseJson, phoneSchema, z } from '@/lib/auth/validate'

// Sends a booking confirmation SMS via IntouchSMS (Rwanda).
export async function POST(request: NextRequest) {
  try {
    // Every SMS costs real credit, so this must not be an open relay: sign-in
    // required (all callers are tenant/staff pages), plus a per-IP cap.
    await requireSession(request)
    await enforceRateLimit(request, 'sms-send', 10, 60 * 60)

    const { phone_number, client_name, message: customMessage } = await parseJson(
      request,
      z.object({
        phone_number: phoneSchema,
        client_name: z.string().trim().max(120).optional(),
        message: z.string().trim().max(320).optional(),
      }),
    )

    // Use a custom message if provided (e.g. booking accepted), else the default "submitted".
    const message =
      customMessage ||
      `Hello ${client_name || 'there'}! Your apartment booking has been submitted successfully. ` +
        `Our team will contact you shortly to confirm the details.`

    const result = await sendIntouchSMS(phone_number, message)

    if (result.disabled) {
      // IntouchSMS credentials not set yet — don't fail the booking flow.
      return NextResponse.json(
        { success: true, messageId: 'DISABLED', message: 'SMS service not configured yet' },
        { status: 200 }
      )
    }

    if (!result.success) {
      return NextResponse.json(
        { error: 'Failed to send SMS confirmation', details: result.error },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, data: result.data }, { status: 200 })
  } catch (error) {
    return errorResponse(error)
  }
}
