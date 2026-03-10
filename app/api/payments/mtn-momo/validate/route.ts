import { NextRequest, NextResponse } from 'next/server';
import { validateMTNMoMoCredentials, generateSetupChecklist, formatCredentialsForDisplay } from '@/lib/mtn-momo-credentials';

/**
 * GET /api/payments/mtn-momo/validate
 * Validates MTN MoMo configuration and credentials
 * 
 * Returns comprehensive validation report including:
 * - Configuration status (valid/invalid)
 * - Specific errors and warnings
 * - Setup checklist with next steps
 * - Masked credential display for verification
 */
export async function GET(request: NextRequest) {
  try {
    const validation = validateMTNMoMoCredentials();
    const credentials = formatCredentialsForDisplay();
    const setupGuide = generateSetupChecklist();

    const response = {
      configurationStatus: validation.isValid ? 'valid' : 'invalid',
      timestamp: new Date().toISOString(),
      environment: {
        mode: process.env.MTN_MOMO_ENVIRONMENT || 'sandbox',
        currency: process.env.MTN_MOMO_CURRENCY || 'XOF',
        countryCode: process.env.MTN_MOMO_COUNTRY_CODE || '256',
        appUrl: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      },
      credentials: credentials,
      validation: {
        isValid: validation.isValid,
        errors: validation.errors,
        warnings: validation.warnings,
      },
      setupGuide: setupGuide,
      actions: validation.isValid ? 
        [
          'Configuration is valid',
          'You can now make payments',
          'Test with sandbox environment first',
          'Switch to production when ready',
        ] : 
        [
          'Complete missing credentials',
          'Update .env.local file',
          'Restart development server',
          'Run validation again',
        ],
    };

    const statusCode = validation.isValid ? 200 : 503;

    return NextResponse.json(response, { status: statusCode });
  } catch (error: any) {
    console.error('[MTN MoMo Validation Error]:', error);

    return NextResponse.json(
      {
        configurationStatus: 'error',
        error: error.message || 'Failed to validate configuration',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/payments/mtn-momo/validate
 * Test access token generation with current credentials
 * 
 * This actually attempts to get an access token from MTN MoMo
 * to verify that credentials are valid and working
 */
export async function POST(request: NextRequest) {
  try {
    const validation = validateMTNMoMoCredentials();

    if (!validation.isValid) {
      return NextResponse.json(
        {
          success: false,
          message: 'Configuration is invalid before testing',
          errors: validation.errors,
        },
        { status: 400 }
      );
    }

    // Import the service to test credentials
    const { mtnMomoService } = await import('@/lib/mtn-momo-service');

    try {
      // Try to get an access token - this verifies credentials work
      const token = await mtnMomoService.getAccessToken();
      
      if (!token) {
        throw new Error('No access token returned from MTN MoMo API');
      }

      // Success!
      return NextResponse.json(
        {
          success: true,
          message: 'Access token obtained successfully!',
          tokenStatus: 'valid',
          environment: process.env.MTN_MOMO_ENVIRONMENT || 'sandbox',
          timestamp: new Date().toISOString(),
          nextSteps: [
            'Credentials are valid and working',
            'You can now process payments',
            'Start with sandbox environment',
            'Make a test payment to verify',
          ],
        },
        { status: 200 }
      );
    } catch (tokenError: any) {
      console.error('[Token Generation Error]:', tokenError);

      return NextResponse.json(
        {
          success: false,
          message: 'Failed to generate access token',
          error: tokenError.message || 'Unknown error',
          debug: {
            hasApiUserId: !!process.env.MTN_MOMO_API_USER_ID,
            hasApiKey: !!process.env.MTN_MOMO_API_KEY,
            hasPrimaryKey: !!process.env.MTN_MOMO_PRIMARY_KEY,
            environment: process.env.MTN_MOMO_ENVIRONMENT || 'sandbox',
          },
          troubleshooting: [
            'Verify API credentials are correct',
            'Check API User ID format (should be UUID)',
            'Ensure API Key length is sufficient',
            'Confirm Primary Key is valid',
            'Try refreshing your API key from MTN portal',
            'Check network/firewall restrictions',
          ],
        },
        { status: 401 }
      );
    }
  } catch (error: any) {
    console.error('[MTN MoMo Validation Error]:', error);

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Validation failed',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
