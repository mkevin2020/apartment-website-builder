/**
 * MTN MoMo Credentials Management
 * Handles credential validation, storage, and setup
 */

export interface MTNMoMoCredentials {
  primaryKey: string;
  apiUserId: string;
  apiKey: string;
  secondaryKey?: string;
  subscriptionKey?: string;
  environment: 'sandbox' | 'production';
  currency: string;
  countryCode: string;
  appUrl: string;
}

/**
 * Validate MTN MoMo credentials
 * Checks that all required credentials are present and properly formatted
 */
export function validateMTNMoMoCredentials(): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check Primary Key
  const primaryKey = process.env.MTN_MOMO_PRIMARY_KEY;
  if (!primaryKey || primaryKey.includes('your-')) {
    errors.push('MTN_MOMO_PRIMARY_KEY is missing or invalid. Get it from https://momodeveloper.mtn.com/');
  } else if (primaryKey.length < 20) {
    errors.push('MTN_MOMO_PRIMARY_KEY appears to be invalid (too short)');
  }

  // Check API User ID
  const apiUserId = process.env.MTN_MOMO_API_USER_ID;
  if (!apiUserId || apiUserId.includes('your-')) {
    errors.push('MTN_MOMO_API_USER_ID is missing or invalid. Create an API user at https://momodeveloper.mtn.com/');
  } else if (!apiUserId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
    errors.push('MTN_MOMO_API_USER_ID must be a valid UUID format');
  }

  // Check API Key
  const apiKey = process.env.MTN_MOMO_API_KEY;
  if (!apiKey || apiKey.includes('your-')) {
    errors.push('MTN_MOMO_API_KEY is missing or invalid. Generate it from your API user settings');
  } else if (apiKey.length < 20) {
    errors.push('MTN_MOMO_API_KEY appears to be invalid (too short)');
  }

  // Check Subscription Key (optional, defaults to Primary Key)
  const subscriptionKey = process.env.MTN_MOMO_SUBSCRIPTION_KEY;
  if (subscriptionKey && subscriptionKey.includes('your-')) {
    warnings.push('MTN_MOMO_SUBSCRIPTION_KEY is a placeholder. Will use PRIMARY_KEY instead.');
  }

  // Check Environment
  const environment = process.env.MTN_MOMO_ENVIRONMENT || 'sandbox';
  if (!['sandbox', 'production'].includes(environment)) {
    warnings.push(`MTN_MOMO_ENVIRONMENT "${environment}" is invalid. Using "sandbox".`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Get credentials from environment variables
 */
export function getMTNMoMoCredentials(): MTNMoMoCredentials {
  const validation = validateMTNMoMoCredentials();

  if (!validation.isValid) {
    const errorMsg = `Invalid MTN MoMo credentials:\n${validation.errors.join('\n')}`;
    console.error(errorMsg);
    throw new Error(errorMsg);
  }

  if (validation.warnings.length > 0) {
    console.warn('MTN MoMo Credential Warnings:\n' + validation.warnings.join('\n'));
  }

  return {
    primaryKey: process.env.MTN_MOMO_PRIMARY_KEY!,
    apiUserId: process.env.MTN_MOMO_API_USER_ID!,
    apiKey: process.env.MTN_MOMO_API_KEY!,
    secondaryKey: process.env.MTN_MOMO_SECONDARY_KEY,
    subscriptionKey: process.env.MTN_MOMO_SUBSCRIPTION_KEY,
    environment: (process.env.MTN_MOMO_ENVIRONMENT as 'sandbox' | 'production') || 'sandbox',
    currency: process.env.MTN_MOMO_CURRENCY || 'XOF',
    countryCode: process.env.MTN_MOMO_COUNTRY_CODE || '256',
    appUrl: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  };
}

/**
 * Generate a setup checklist for MTN MoMo configuration
 */
export function generateSetupChecklist(): string {
  const validation = validateMTNMoMoCredentials();

  let checklist = `
╔═══════════════════════════════════════════════════════════════╗
║           MTN MoMo Configuration Checklist                     ║
╚═══════════════════════════════════════════════════════════════╝

STEP 1: Create MTN MoMo Business Account
├─ Go to: https://momodeveloper.mtn.com/
├─ Sign up for a developer account
├─ Create a business application
└─ ✓ You'll get your PRIMARY_KEY (Subscription Key)

STEP 2: Generate API Credentials
├─ In your API settings, create an API User
├─ You'll receive:
│  ├─ API_USER_ID (UUID, 36 characters)
│  └─ API_KEY (40+ character string)
└─ Save these in your .env.local file

STEP 3: Configure Environment Variables
Add to your .env.local:
`;

  if (!process.env.MTN_MOMO_PRIMARY_KEY || process.env.MTN_MOMO_PRIMARY_KEY.includes('your-')) {
    checklist += `
  MTN_MOMO_PRIMARY_KEY=<your-key-from-mtn-portal>  ❌ MISSING
`;
  } else {
    checklist += `
  MTN_MOMO_PRIMARY_KEY=<configured>  ✓
`;
  }

  if (!process.env.MTN_MOMO_API_USER_ID || process.env.MTN_MOMO_API_USER_ID.includes('your-')) {
    checklist += `
  MTN_MOMO_API_USER_ID=<uuid-from-mtn-portal>  ❌ MISSING
`;
  } else {
    checklist += `
  MTN_MOMO_API_USER_ID=<configured>  ✓
`;
  }

  if (!process.env.MTN_MOMO_API_KEY || process.env.MTN_MOMO_API_KEY.includes('your-')) {
    checklist += `
  MTN_MOMO_API_KEY=<key-from-mtn-portal>  ❌ MISSING
`;
  } else {
    checklist += `
  MTN_MOMO_API_KEY=<configured>  ✓
`;
  }

  checklist += `

STEP 4: Test Your Configuration
Run the credential validation:
  await validateMTNMoMoCredentials()

Or in your API:
  POST /api/pay/mtn-momo/validate

STEP 5: Make Your First Payment
Use the payment widget with your phone number

═══════════════════════════════════════════════════════════════

ISSUES & TROUBLESHOOTING:

❌ "Missing or invalid MTN MoMo credentials"
└─ Ensure all three keys are in .env.local
└─ Restart your development server after adding keys
└─ Don't commit .env.local to git

❌ "Failed to get access token"
└─ Verify API_USER_ID and API_KEY are correct
└─ Check that PRIMARY_KEY hasn't expired
└─ Confirm you're using the right environment (sandbox/production)

❌ "Invalid phone number"
└─ Ensure phone numbers include the country code
└─ Example: +256789123456 (Uganda)
└─ Update MTN_MOMO_COUNTRY_CODE if needed

═══════════════════════════════════════════════════════════════

STATUS:
${validation.isValid ? '✓ All credentials configured correctly!' : `✗ Missing credentials:\n${validation.errors.map(e => `  - ${e}`).join('\n')}`}
`;

  return checklist;
}

/**
 * Format credentials for display (with sensitive data masked)
 */
export function formatCredentialsForDisplay(): Record<string, string> {
  const obj: Record<string, string> = {};

  const primaryKey = process.env.MTN_MOMO_PRIMARY_KEY;
  obj['MTN_MOMO_PRIMARY_KEY'] = primaryKey ? 
    primaryKey.substring(0, 8) + '*'.repeat(Math.max(0, primaryKey.length - 8)) :
    'NOT SET';

  const apiUserId = process.env.MTN_MOMO_API_USER_ID;
  obj['MTN_MOMO_API_USER_ID'] = apiUserId ? 
    apiUserId.substring(0, 8) + '****' + apiUserId.substring(apiUserId.length - 4) :
    'NOT SET';

  const apiKey = process.env.MTN_MOMO_API_KEY;
  obj['MTN_MOMO_API_KEY'] = apiKey ? 
    apiKey.substring(0, 4) + '*'.repeat(Math.max(0, apiKey.length - 8)) + apiKey.substring(apiKey.length - 4) :
    'NOT SET';

  obj['MTN_MOMO_ENVIRONMENT'] = process.env.MTN_MOMO_ENVIRONMENT || 'sandbox';
  obj['MTN_MOMO_CURRENCY'] = process.env.MTN_MOMO_CURRENCY || 'XOF';

  return obj;
}
