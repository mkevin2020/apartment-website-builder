import { NextRequest, NextResponse } from 'next/server'
import twilio from 'twilio'

export async function POST(request: NextRequest) {
  try {
    const { phone_number, client_name } = await request.json()

    // Validate inputs
    if (!phone_number || !client_name) {
      return NextResponse.json(
        { error: 'Phone number and client name are required' },
        { status: 400 }
      )
    }

    // Initialize Twilio client
    const accountSid = process.env.TWILIO_ACCOUNT_SID
    const authToken = process.env.TWILIO_AUTH_TOKEN
    const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER

    if (!accountSid || !authToken || !twilioPhoneNumber) {
      console.warn('SMS service not configured - SMS disabled')
      return NextResponse.json(
        { success: true, messageId: 'DISABLED', message: 'SMS service disabled' },
        { status: 200 }
      )
    }

    const client = twilio(accountSid, authToken)

    // Send SMS
    const message = await client.messages.create({
      body: `Hello ${client_name}! Your apartment booking has been submitted successfully. Our team will contact you shortly to confirm the details.`,
      from: twilioPhoneNumber,
      to: phone_number,
    })

    return NextResponse.json(
      { success: true, messageId: message.sid },
      { status: 200 }
    )
  } catch (error) {
    console.error('SMS sending error:', error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    const errorStack = error instanceof Error ? error.stack : ''
    console.error('Error stack:', errorStack)
    return NextResponse.json(
      { error: 'Failed to send SMS confirmation', details: errorMessage, stack: errorStack },
      { status: 500 }
    )
  }
}
