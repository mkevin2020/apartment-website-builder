import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { mtnMomoService } from '@/lib/mtn-momo-service';
import { validateMTNMoMoCredentials, generateSetupChecklist } from '@/lib/mtn-momo-credentials';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

/**
 * POST /api/payments/mtn-momo
 * Initiates a payment request via MTN MoMo
 * 
 * Request body:
 * {
 *   paymentId: number,
 *   phoneNumber: string,
 *   amount: number,
 *   tenantId: string
 * }
 * 
 * Headers:
 * - Authorization: Bearer <ACCESS_TOKEN>
 * - Ocp-Apim-Subscription-Key: <PRIMARY_KEY>
 * - X-Reference-Id: <UUID>
 * - X-Target-Environment: sandbox|production
 */
export async function POST(request: NextRequest) {
  try {
    const { paymentId, phoneNumber, amount, tenantId } = await request.json();

    // Validate request body
    if (!paymentId || !phoneNumber || !amount || !tenantId) {
      return NextResponse.json(
        { error: 'Missing required fields: paymentId, phoneNumber, amount, tenantId' },
        { status: 400 }
      );
    }

    // Validate amount
    if (typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json(
        { error: 'Amount must be a positive number' },
        { status: 400 }
      );
    }

    // Validate phone number format
    const phoneRegex = /^[\d+ -()]+$/;
    if (!phoneRegex.test(phoneNumber)) {
      return NextResponse.json(
        { error: 'Invalid phone number format' },
        { status: 400 }
      );
    }

    // Validate credentials before making request
    const validation = validateMTNMoMoCredentials();
    if (!validation.isValid) {
      console.error('Credential validation failed:', validation.errors);
      return NextResponse.json(
        { 
          error: 'MTN MoMo is not properly configured',
          details: validation.errors,
          setupGuide: generateSetupChecklist(),
        },
        { status: 503 }
      );
    }

    console.log(`[MTN MoMo Payment] Initiating payment for tenant ${tenantId}`);
    console.log(`[MTN MoMo Payment] Amount: ${amount}, Phone: ${phoneNumber}`);

    // Request payment from MTN MoMo
    // This internally:
    // 1. Gets access token using Basic Auth (base64(API_USER_ID:API_KEY))
    // 2. Sends request-to-pay with Bearer token
    const transactionId = await mtnMomoService.requestToPay(
      phoneNumber,
      amount,
      `PAYMENT-${paymentId}`,
      `Apartment rent payment (Ref: ${paymentId})`,
      'Payment received'
    );

    // Update payment record with transaction ID
    const { error: updateError } = await supabase
      .from('tenant_payments')
      .update({
        transaction_id: transactionId,
        phone_number: phoneNumber,
        payment_gateway: 'mtn_momo',
        status: 'pending',
        initiated_at: new Date().toISOString(),
      })
      .eq('id', paymentId);

    if (updateError) {
      throw new Error(`Failed to update payment: ${updateError.message}`);
    }

    // Log the request
    await logTransaction(paymentId, 'request_to_pay', {
      phoneNumber,
      amount,
      transactionId,
      currency: process.env.MTN_MOMO_CURRENCY || 'XOF',
      environment: process.env.MTN_MOMO_ENVIRONMENT || 'sandbox',
    }, null);

    return NextResponse.json({
      success: true,
      transactionId,
      message: 'Payment request sent to phone. User will receive a prompt to confirm.',
      amount,
      currency: process.env.MTN_MOMO_CURRENCY || 'XOF',
      status: 'pending',
      externalId: `PAYMENT-${paymentId}`,
    });
  } catch (error: any) {
    console.error('[MTN MoMo Payment Error]:', error);

    // Provide specific error messages for common issues
    let errorMessage = error.message || 'Failed to initiate payment';
    let statusCode = 500;

    if (error.message.includes('access token')) {
      errorMessage = 'Authentication failed. Check your API credentials.';
      statusCode = 401;
    } else if (error.message.includes('phone number')) {
      errorMessage = 'Invalid phone number format.';
      statusCode = 400;
    } else if (error.message.includes('credentials')) {
      errorMessage = 'MTN MoMo credentials are not configured.';
      statusCode = 503;
    }

    return NextResponse.json(
      { error: errorMessage },
      { status: statusCode }
    );
  }
}

/**
 * GET /api/payments/mtn-momo?transactionId=xxx&paymentId=yyy
 * Check payment status
 * 
 * Query Parameters:
 * - transactionId: UUID returned from request-to-pay
 * - paymentId: Optional, used to update payment record
 * 
 * Headers Used:
 * - Authorization: Bearer <ACCESS_TOKEN>
 * - Ocp-Apim-Subscription-Key: <PRIMARY_KEY>
 * - X-Target-Environment: sandbox|production
 * 
 * Returns:
 * {
 *   transactionId: string,
 *   status: "SUCCESSFUL" | "FAILED" | "PENDING",
 *   financial_transaction_id: string,
 *   reason?: { code: string, message: string }
 * }
 */
export async function GET(request: NextRequest) {
  try {
    const transactionId = request.nextUrl.searchParams.get('transactionId');
    const paymentId = request.nextUrl.searchParams.get('paymentId');

    if (!transactionId) {
      return NextResponse.json(
        { error: 'Missing required query parameter: transactionId' },
        { status: 400 }
      );
    }

    console.log(`[MTN MoMo Status Check] Checking status for transaction: ${transactionId}`);

    // Get transaction status from MTN MoMo
    // Uses Bearer token for authorization
    const status = await mtnMomoService.getTransactionStatus(transactionId);

    // Update payment status based on response
    if (paymentId) {
      const paymentStatus = status.status === 'SUCCESSFUL' ? 'completed' : 
                           status.status === 'FAILED' ? 'failed' : 'pending';

      const updateData: any = {
        status: paymentStatus,
      };

      if (status.financial_transaction_id) {
        updateData.mtn_reference_code = status.financial_transaction_id;
      }

      if (status.status === 'SUCCESSFUL') {
        updateData.completed_at = new Date().toISOString();
      } else if (status.status === 'FAILED') {
        updateData.failed_at = new Date().toISOString();
        if (status.reason) {
          updateData.failure_reason = `${status.reason.code}: ${status.reason.message}`;
        }
      }

      const { error: updateError } = await supabase
        .from('tenant_payments')
        .update(updateData)
        .eq('id', paymentId);

      if (updateError) {
        console.error('Failed to update payment status:', updateError);
      }
    }

    // Log the status check
    if (paymentId) {
      await logTransaction(
        parseInt(paymentId),
        'get_status',
        { transactionId, timestamp: new Date().toISOString() },
        status
      );
    }

    return NextResponse.json({
      success: true,
      transactionId,
      status: status.status,
      financial_transaction_id: status.financial_transaction_id,
      reason: status.reason || null,
      message: getStatusMessage(status.status),
      environment: process.env.MTN_MOMO_ENVIRONMENT || 'sandbox',
    });
  } catch (error: any) {
    console.error('[MTN MoMo Status Check Error]:', error);

    return NextResponse.json(
      { 
        error: error.message || 'Failed to check payment status',
        transactionId: request.nextUrl.searchParams.get('transactionId'),
      },
      { status: 500 }
    );
  }
}

/**
 * HEAD /api/payments/mtn-momo
 * Validate MTN MoMo configuration
 * Returns 200 if configured, 503 if not
 */
export async function HEAD(request: NextRequest) {
  try {
    const validation = validateMTNMoMoCredentials();
    
    if (!validation.isValid) {
      return new NextResponse(null, {
        status: 503,
        headers: {
          'X-Configuration-Status': 'invalid',
          'X-Errors': validation.errors.join('; '),
        },
      });
    }

    return new NextResponse(null, {
      status: 200,
      headers: {
        'X-Configuration-Status': 'valid',
        'X-Environment': process.env.MTN_MOMO_ENVIRONMENT || 'sandbox',
      },
    });
  } catch (error) {
    return new NextResponse(null, { status: 500 });
  }
}

/**
 * Get human-readable status message
 */
function getStatusMessage(status: string): string {
  const messages: Record<string, string> = {
    'SUCCESSFUL': 'Payment completed successfully! Transaction confirmed.',
    'FAILED': 'Payment failed. Please try again or contact support.',
    'PENDING': 'Payment is pending. Please wait for user confirmation or retry.',
  };
  return messages[status] || `Payment status: ${status}`;
}

/**
 * Log transaction for audit trail
 */
async function logTransaction(
  paymentId: number,
  requestType: string,
  requestBody: any,
  responseBody: any
) {
  try {
    await supabase.from('mtn_momo_logs').insert({
      payment_id: paymentId,
      request_type: requestType,
      request_body: requestBody,
      response_body: responseBody,
      created_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[MTN MoMo Logging Error]:', error);
    // Don't throw error for logging failures, just log to console
  }
}
