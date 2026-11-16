import { Injectable } from '@angular/core';

export interface XenditCreateInvoiceRequest {
  orderId: string;
  totalAmount: number;
  description: string;
  customerName: string;
  customerPhone: string;
  paymentMethods: string[];
  successUrl: string;
  cancelUrl: string;
}

export interface XenditCreateInvoiceResponse {
  invoiceId: string;
  invoiceUrl: string;
  status: string;
}

export interface XenditVerifyInvoiceResponse {
  paid: boolean;
  invoiceId: string;
  externalId: string;
  paymentChannel: string;
  amountPaid: number;
  status: string;
}

@Injectable({
  providedIn: 'root'
})
export class XenditService {
  // Change to your deployed server URL for production or mobile testing
  private readonly apiBaseUrl = 'http://localhost:3000/api/xendit';

  async createInvoice(payload: XenditCreateInvoiceRequest): Promise<XenditCreateInvoiceResponse> {
    const res = await fetch(`${this.apiBaseUrl}/create-invoice`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.error || 'Could not start Xendit checkout.');
    }
    return data;
  }

  async verifyInvoice(invoiceId: string): Promise<XenditVerifyInvoiceResponse> {
    const res = await fetch(`${this.apiBaseUrl}/verify-invoice/${encodeURIComponent(invoiceId)}`, {
      method: 'GET',
      headers: { Accept: 'application/json' }
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.error || 'Could not verify Xendit payment.');
    }
    return data;
  }
}