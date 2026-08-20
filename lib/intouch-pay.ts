/**
 * IntouchPay Service - Client-side service for payment operations
 */

interface PaymentRequest {
  amount: number;
  phone_number: string;
  tenant_id: string;
  apartment_id: string;
  month: string;
  description?: string;
  send_sms?: boolean;
}

interface SMSRequest {
  phone_number: string;
  message: string;
}

interface PaymentConfirmationSMS {
  phone_number: string;
  tenant_name: string;
  amount: number;
  apartment: string;
  month: string;
  reference_id: string;
}

export class IntouchPayService {
  private baseUrl = "/api/intouch";

  /**
   * Request payment from tenant
   */
  async requestPayment(paymentData: PaymentRequest) {
    const response = await fetch(`${this.baseUrl}/payment`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(paymentData),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Payment request failed");
    }

    return response.json();
  }

  /**
   * Check payment status
   */
  async checkPaymentStatus(
    requestTransactionId: string,
    transactionId: string
  ) {
    const params = new URLSearchParams({
      request_transaction_id: requestTransactionId,
      transaction_id: transactionId,
    });

    const response = await fetch(`${this.baseUrl}/status?${params}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Status check failed");
    }

    return response.json();
  }

  /**
   * Send SMS message
   */
  async sendSMS(smsData: SMSRequest) {
    const response = await fetch(`${this.baseUrl}/sms/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(smsData),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "SMS send failed");
    }

    return response.json();
  }

  /**
   * Send payment confirmation SMS
   */
  async sendPaymentConfirmationSMS(smsData: PaymentConfirmationSMS) {
    const response = await fetch(`${this.baseUrl}/sms/confirmation`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(smsData),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Confirmation SMS send failed");
    }

    return response.json();
  }

  /**
   * Send payment reminder SMS
   */
  async sendPaymentReminderSMS(
    phoneNumber: string,
    tenantName: string,
    amount: number,
    apartment: string,
    dueDate: string
  ) {
    const response = await fetch(`${this.baseUrl}/sms/reminder`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        phone_number: phoneNumber,
        tenant_name: tenantName,
        amount,
        apartment,
        due_date: dueDate,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Reminder SMS send failed");
    }

    return response.json();
  }
}

// Export singleton instance
export const intouchPayService = new IntouchPayService();
