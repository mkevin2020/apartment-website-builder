import { v4 as uuidv4 } from 'uuid';

/**
 * MTN MoMo API Service
 * Handles all interactions with MTN MoMo Collections API
 * 
 * REQUIRED CREDENTIALS:
 * - MTN_MOMO_PRIMARY_KEY: Subscription key from MTN developer portal
 * - MTN_MOMO_API_USER_ID: UUID of your API user
 * - MTN_MOMO_API_KEY: API key generated for your API user
 */

const MOMO_BASE_URL = 'https://sandbox.momodeveloper.mtn.com'; // Change to production URL for live
const MOMO_PRODUCTION_URL = 'https://api.mtn.com';
const MOMO_API_VERSION = 'v1_0';

interface CreateAccessTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface RequestToPayResponse {
  transaction_id: string;
}

interface GetTransactionStatusResponse {
  financial_transaction_id: string;
  status: string;
  reason?: {
    code: string;
    message: string;
  };
}

interface CredentialsConfig {
  primaryKey: string;
  apiUserId: string;
  apiKey: string;
  secondaryKey?: string;
  subscriptionKey?: string;
  environment?: 'sandbox' | 'production';
  currency?: string;
  countryCode?: string;
}

export class MTNMoMoService {
  private primaryKey: string;
  private secondaryKey: string;
  private apiUserId: string;
  private apiKey: string;
  private subscriptionKey: string;
  private environment: 'sandbox' | 'production';
  private currency: string;
  private countryCode: string;

  constructor(config?: CredentialsConfig) {
    // Load from environment or provided config
    this.primaryKey = config?.primaryKey || process.env.MTN_MOMO_PRIMARY_KEY || '';
    this.secondaryKey = config?.secondaryKey || process.env.MTN_MOMO_SECONDARY_KEY || '';
    this.apiUserId = config?.apiUserId || process.env.MTN_MOMO_API_USER_ID || '';
    this.apiKey = config?.apiKey || process.env.MTN_MOMO_API_KEY || '';
    this.subscriptionKey = config?.subscriptionKey || process.env.MTN_MOMO_SUBSCRIPTION_KEY || this.primaryKey;
    this.environment = config?.environment || (process.env.MTN_MOMO_ENVIRONMENT as any) || 'sandbox';
    this.currency = config?.currency || process.env.MTN_MOMO_CURRENCY || 'XOF';
    this.countryCode = config?.countryCode || process.env.MTN_MOMO_COUNTRY_CODE || '256';

    // Validate required credentials
    this.validateCredentials();
  }

  /**
   * Validate that all required credentials are present
   */
  private validateCredentials(): void {
    const missingCredentials: string[] = [];

    if (!this.primaryKey || this.primaryKey.includes('your-')) {
      missingCredentials.push('MTN_MOMO_PRIMARY_KEY');
    }
    if (!this.apiUserId || this.apiUserId.includes('your-')) {
      missingCredentials.push('MTN_MOMO_API_USER_ID');
    }
    if (!this.apiKey || this.apiKey.includes('your-')) {
      missingCredentials.push('MTN_MOMO_API_KEY');
    }

    if (missingCredentials.length > 0) {
      const error = `Missing or invalid MTN MoMo credentials: ${missingCredentials.join(', ')}. ` +
        `Please configure these in your .env.local file. ` +
        `Get them from https://momodeveloper.mtn.com/`;
      console.error(error);
      throw new Error(error);
    }

    // Validate format
    if (!this.apiUserId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      throw new Error('MTN_MOMO_API_USER_ID must be a valid UUID (e.g., 550e8400-e29b-41d4-a716-446655440000)');
    }

    if (this.primaryKey.length < 20) {
      throw new Error('MTN_MOMO_PRIMARY_KEY appears to be invalid (too short)');
    }

    if (this.apiKey.length < 20) {
      throw new Error('MTN_MOMO_API_KEY appears to be invalid (too short)');
    }
  }

  /**
   * Get the appropriate base URL based on environment
   */
  private getBaseUrl(): string {
    return this.environment === 'production' ? MOMO_PRODUCTION_URL : MOMO_BASE_URL;
  }

  /**
   * Get current configuration for debugging
   */
  getConfig(): Omit<CredentialsConfig, 'apiKey' | 'primaryKey'> {
    return {
      environment: this.environment,
      currency: this.currency,
      countryCode: this.countryCode,
      subscriptionKey: this.subscriptionKey?.substring(0, 8) + '****' || 'not-set',
      apiUserId: this.apiUserId?.substring(0, 8) + '****' || 'not-set',
    };
  }

  /**
   * Create API User (one-time setup)
   * Run this once to get your API User ID
   */
  async createApiUser(): Promise<{ api_user: string; api_key: string }> {
    const apiUserId = uuidv4();
    const baseUrl = this.getBaseUrl();

    try {
      const response = await fetch(
        `${baseUrl}/v1_0/apiuser`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Ocp-Apim-Subscription-Key': this.primaryKey,
            'X-Reference-Id': apiUserId,
          },
          body: JSON.stringify({
            providerCallbackHost: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
          }),
        }
      );

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Failed to create API user: ${response.statusText} - ${text}`);
      }

      // Now create API key for this user
      const apiKey = await this.createApiKey(apiUserId);

      console.log(`\n✓ API User created successfully!`);
      console.log(`Save these values in your .env.local:`);
      console.log(`  MTN_MOMO_API_USER_ID=${apiUserId}`);
      console.log(`  MTN_MOMO_API_KEY=${apiKey}`);
      console.log(`\n`);

      return {
        api_user: apiUserId,
        api_key: apiKey,
      };
    } catch (error) {
      console.error('Error creating API user:', error);
      throw error;
    }
  }

  /**
   * Create API Key for an API User
   */
  private async createApiKey(apiUserId: string): Promise<string> {
    const baseUrl = this.getBaseUrl();

    try {
      const response = await fetch(
        `${baseUrl}/v1_0/apiuser/${apiUserId}/apikey`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Ocp-Apim-Subscription-Key': this.primaryKey,
          },
        }
      );

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Failed to create API key: ${response.statusText} - ${text}`);
      }

      const data: any = await response.json();
      return data.apiKey;
    } catch (error) {
      console.error('Error creating API key:', error);
      throw error;
    }
  }

  /**
   * Get Access Token
   * Required before making payment requests
   * Uses Basic Authentication with base64(API_USER_ID:API_KEY)
   */
  async getAccessToken(): Promise<string> {
    try {
      // Create Basic Auth header: base64(API_USER_ID:API_KEY)
      const auth = Buffer.from(
        `${this.apiUserId}:${this.apiKey}`
      ).toString('base64');

      const baseUrl = this.getBaseUrl();

      const response = await fetch(
        `${baseUrl}/collection/${MOMO_API_VERSION}/token/`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${auth}`,
            'Ocp-Apim-Subscription-Key': this.subscriptionKey,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Failed to get access token (${response.status}): ${text}`);
      }

      const data: CreateAccessTokenResponse = await response.json();
      
      if (!data.access_token) {
        throw new Error('No access token returned from MTN MoMo API');
      }

      return data.access_token;
    } catch (error) {
      console.error('Error getting access token:', error);
      throw error;
    }
  }

  /**
   * Request to Pay (initiate payment)
   * Sends payment request to user's phone
   * 
   * Headers:
   * - Authorization: Bearer <ACCESS_TOKEN>
   * - Ocp-Apim-Subscription-Key: <PRIMARY_KEY>
   * - X-Reference-Id: <UUID> for transaction tracking
   * - X-Target-Environment: sandbox|production
   * - Content-Type: application/json
   */
  async requestToPay(
    phoneNumber: string,
    amount: number,
    externalId: string,
    payerMessage: string = 'Apartment rent payment',
    payeeNote: string = 'Payment received'
  ): Promise<string> {
    try {
      // Validate inputs
      if (!phoneNumber || phoneNumber.trim() === '') {
        throw new Error('Phone number is required');
      }
      if (amount <= 0) {
        throw new Error('Amount must be greater than 0');
      }
      if (!externalId) {
        throw new Error('External ID is required for tracking');
      }

      // Get access token
      const accessToken = await this.getAccessToken();
      const transactionId = uuidv4();
      const baseUrl = this.getBaseUrl();

      console.log(`[MTN MoMo] Initiating payment: ${amount} ${this.currency} to ${phoneNumber}`);

      const response = await fetch(
        `${baseUrl}/collection/${MOMO_API_VERSION}/requesttopay`,
        {
          method: 'POST',
          headers: {
            // Authorization header with Bearer token (access token)
            'Authorization': `Bearer ${accessToken}`,
            // Subscription key for API rate limiting and authentication
            'Ocp-Apim-Subscription-Key': this.subscriptionKey,
            // Unique reference ID for this transaction (must be UUID)
            'X-Reference-Id': transactionId,
            // Target environment: sandbox or production
            'X-Target-Environment': this.environment,
            // Content type for request body
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            // Amount in the specified currency
            amount: amount.toString(),
            // ISO 4217 currency code
            currency: this.currency,
            // External reference for your system
            externalId: externalId,
            // Payer information
            payer: {
              partyIdType: 'MSISDN', // Phone number identifier type
              partyId: this.formatPhoneNumber(phoneNumber),
            },
            // Messages for the payment request
            payerMessage: payerMessage,
            payeeNote: payeeNote,
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        const errorMsg = `MTN MoMo request failed (${response.status}): ${errorText}`;
        console.error(errorMsg);
        throw new Error(errorMsg);
      }

      console.log(`[MTN MoMo] Payment request sent. Transaction ID: ${transactionId}`);

      return transactionId;
    } catch (error) {
      console.error('Error requesting payment:', error);
      throw error;
    }
  }

  /**
   * Get Transaction Status
   * Check if payment was completed, failed, or is pending
   * 
   * Returns:
   * - SUCCESSFUL: Payment completed
   * - FAILED: Payment failed
   * - PENDING: Payment pending (in progress)
   */
  async getTransactionStatus(transactionId: string): Promise<GetTransactionStatusResponse> {
    try {
      if (!transactionId) {
        throw new Error('Transaction ID is required');
      }

      // Get access token for authorization
      const accessToken = await this.getAccessToken();
      const baseUrl = this.getBaseUrl();

      const response = await fetch(
        `${baseUrl}/collection/${MOMO_API_VERSION}/requesttopay/${transactionId}`,
        {
          method: 'GET',
          headers: {
            // Authorization header with Bearer token
            'Authorization': `Bearer ${accessToken}`,
            // Subscription key for API authentication
            'Ocp-Apim-Subscription-Key': this.subscriptionKey,
            // Target environment
            'X-Target-Environment': this.environment,
          },
        }
      );

      if (!response.ok) {
        // 404 might mean transaction is still processing
        if (response.status === 404) {
          return {
            financial_transaction_id: transactionId,
            status: 'PENDING',
          };
        }
        const text = await response.text();
        throw new Error(`Failed to get transaction status (${response.status}): ${text}`);
      }

      const data: GetTransactionStatusResponse = await response.json();
      
      console.log(`[MTN MoMo] Transaction ${transactionId} status: ${data.status}`);

      return data;
    } catch (error) {
      console.error('Error getting transaction status:', error);
      throw error;
    }
  }

  /**
   * Check Payment Status with Retry Logic
   * Polls the transaction status with automatic retry
   */
  async checkPaymentStatusWithRetry(
    transactionId: string,
    maxAttempts: number = 10,
    delayMs: number = 2000
  ): Promise<GetTransactionStatusResponse> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const status = await this.getTransactionStatus(transactionId);
        
        // Stop polling if we get a definitive result
        if (status.status === 'SUCCESSFUL' || status.status === 'FAILED') {
          return status;
        }

        // For PENDING status, continue polling
        if (attempt < maxAttempts) {
          console.log(`[MTN MoMo] Payment still pending... retrying (${attempt}/${maxAttempts})`);
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      } catch (error) {
        lastError = error as Error;
        if (attempt < maxAttempts) {
          console.log(`[MTN MoMo] Retry attempt ${attempt} failed, retrying...`);
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      }
    }

    // After all retries, return the last known state
    throw new Error(
      lastError ? 
      `Failed to check payment status after ${maxAttempts} attempts: ${lastError.message}` :
      `Payment status check timed out after ${maxAttempts} attempts`
    );
  }

  /**
   * Format phone number to international format
   * Converts local format (e.g., 0789123456) to international (e.g., +256789123456)
   */
  private formatPhoneNumber(phoneNumber: string): string {
    // Remove any non-digit characters
    let cleaned = phoneNumber.replace(/\D/g, '');

    // If it starts with 0, replace with country code
    if (cleaned.startsWith('0')) {
      cleaned = this.countryCode + cleaned.substring(1);
    } else if (!cleaned.startsWith(this.countryCode)) {
      // If it doesn't have country code, add it
      cleaned = this.countryCode + cleaned;
    }

    // Ensure it starts with +
    if (!cleaned.startsWith('+')) {
      cleaned = '+' + cleaned;
    }

    console.log(`[MTN MoMo] Formatted phone number: ${phoneNumber} -> ${cleaned}`);

    return cleaned;
  }

  /**
   * Validate phone number format
   */
  private isValidPhoneNumber(phoneNumber: string): boolean {
    // Remove non-digit characters
    const cleaned = phoneNumber.replace(/\D/g, '');
    // Should be between 9 and 15 digits
    return cleaned.length >= 9 && cleaned.length <= 15;
  }
}

export const mtnMomoService = new MTNMoMoService();
