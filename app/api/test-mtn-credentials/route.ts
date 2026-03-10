import { NextRequest, NextResponse } from 'next/server';

/**
 * Test endpoint to validate MTN MoMo credentials
 * GET /api/test-mtn-credentials
 */
export async function GET(request: NextRequest) {
  try {
    const credentials = {
      primaryKey: process.env.MTN_MOMO_PRIMARY_KEY,
      apiUserId: process.env.MTN_MOMO_API_USER_ID,
      apiKey: process.env.MTN_MOMO_API_KEY,
      subscriptionKey: process.env.MTN_MOMO_SUBSCRIPTION_KEY,
      environment: process.env.MTN_MOMO_ENVIRONMENT,
      countryCode: process.env.MTN_MOMO_COUNTRY_CODE,
    };

    // Check if credentials are loaded
    const missingCredentials: string[] = [];
    
    if (!credentials.primaryKey || credentials.primaryKey.includes('your-')) {
      missingCredentials.push('MTN_MOMO_PRIMARY_KEY');
    }
    if (!credentials.apiUserId || credentials.apiUserId.includes('your-')) {
      missingCredentials.push('MTN_MOMO_API_USER_ID');
    }
    if (!credentials.apiKey || credentials.apiKey.includes('your-')) {
      missingCredentials.push('MTN_MOMO_API_KEY');
    }

    if (missingCredentials.length > 0) {
      return NextResponse.json(
        {
          status: 'error',
          message: 'Missing MTN MoMo credentials',
          missing: missingCredentials,
          credentials: {
            primaryKey: credentials.primaryKey ? '✓ Loaded' : '✗ Missing',
            apiUserId: credentials.apiUserId ? '✓ Loaded' : '✗ Missing',
            apiKey: credentials.apiKey ? '✓ Loaded' : '✗ Missing',
            subscriptionKey: credentials.subscriptionKey ? '✓ Loaded' : '✗ Missing',
            environment: credentials.environment || 'sandbox',
          },
        },
        { status: 400 }
      );
    }

    // Test API connectivity - Using Basic Auth with API User ID and API Key
    try {
      // Create Basic Auth header
      const basicAuth = Buffer.from(
        `${credentials.apiUserId}:${credentials.apiKey}`
      ).toString('base64');

      const response = await fetch(
        'https://sandbox.momodeveloper.mtn.com/v1_0/apiuser',
        {
          method: 'GET',
          headers: {
            'Authorization': `Basic ${basicAuth}`,
            'Ocp-Apim-Subscription-Key': credentials.subscriptionKey || credentials.primaryKey,
          },
        }
      );

      const status = response.status;
      const isSuccess = status >= 200 && status < 300;

      return NextResponse.json(
        {
          status: isSuccess ? 'success' : 'connection_issue',
          message: isSuccess
            ? 'MTN MoMo API is accessible with your credentials!'
            : `MTN MoMo API returned status ${status}`,
          apiStatus: status,
          credentials: {
            primaryKey: `${credentials.primaryKey?.substring(0, 10)}... (loaded)`,
            apiUserId: `${credentials.apiUserId?.substring(0, 10)}... (loaded)`,
            apiKey: `${credentials.apiKey?.substring(0, 10)}... (loaded)`,
            subscriptionKey: `${credentials.subscriptionKey?.substring(0, 10)}... (loaded)`,
            environment: credentials.environment,
          },
          testDetails: {
            endpoint: 'https://sandbox.momodeveloper.mtn.com/v1_0/apiuser',
            method: 'GET',
            headers: {
              'Authorization': 'Basic [USER_ID:API_KEY]',
              'Ocp-Apim-Subscription-Key': '[PRIMARY_KEY]',
            },
            httpStatus: status,
            success: isSuccess,
          },
          nextSteps: isSuccess
            ? [
                '✓ Credentials are valid!',
                '✓ API connection is working!',
                'Try making a payment in the dashboard',
              ]
            : [
                `✗ API returned status ${status} - Authentication failed`,
                'This means:',
                '1. PRIMARY_KEY (Subscription Key) might be incorrect',
                '2. API_KEY might be incorrect',
                '3. API_USER_ID might be incorrect',
                '4. Or you need a different endpoint',
              ],
        },
        { status: isSuccess ? 200 : 400 }
      );
    } catch (apiError: any) {
      return NextResponse.json(
        {
          status: 'error',
          message: 'Failed to connect to MTN MoMo API',
          error: apiError.message,
          credentials: {
            primaryKey: credentials.primaryKey ? '✓ Loaded' : '✗ Missing',
            apiUserId: credentials.apiUserId ? '✓ Loaded' : '✗ Missing',
            apiKey: credentials.apiKey ? '✓ Loaded' : '✗ Missing',
          },
          troubleshooting: [
            'Credentials are loaded but API connection failed',
            'Check:',
            '1. Internet connection',
            '2. All three credentials are correct:',
            '   - PRIMARY_KEY (subscription key from MTN)',
            '   - API_USER_ID (UUID format)',
            '   - API_KEY (your API key)',
            '3. Visit https://momodeveloper.mtn.com/ to verify',
          ],
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    return NextResponse.json(
      {
        status: 'error',
        message: 'Test failed',
        error: error.message,
      },
      { status: 500 }
    );
  }
}
