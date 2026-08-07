/**
 * ============================================
 * File: lib/membershipPayments.ts
 * ============================================
 * Creation Reason:
 *   Provide a narrow, typed API client for privacy-preserving USDT membership
 *   checkout without coupling public payment pages to operator APIs.
 * Main Functionality:
 *   1. Validate a random checkout capability.
 *   2. Create Solana/BSC/TRON payment intents.
 *   3. Poll capability-protected payment state.
 *   4. Submit an optional untrusted transaction hint.
 * Dependencies:
 *   - Django /api/membership/payment/* contract
 *   - app/topup/page.tsx
 *
 * Important Note for Next Developer:
 *   The browser never sends token contracts, decimals, recipient addresses, or
 *   paid status. Those are authoritative only when returned by the backend.
 *
 * Last Modified: v1.0.0 - [USDT-PAYMENTS 2026-08-07 by Codex] Initial client.
 * ============================================
 */

const MEMBERSHIP_API_BASE =
  process.env.NEXT_PUBLIC_MEMBERSHIP_API_BASE_URL ||
  'https://api.aeronyx.network/api/membership';

export type PaymentNetworkId = 'solana' | 'bsc' | 'tron';
export type PaymentStatus =
  | 'created'
  | 'awaiting_payment'
  | 'detected'
  | 'confirming'
  | 'paid'
  | 'fulfilled'
  | 'expired'
  | 'underpaid'
  | 'overpaid'
  | 'wrong_asset'
  | 'needs_review'
  | 'failed'
  | 'cancelled';

export interface MembershipPlan {
  id: string;
  tier: string;
  billing_cycle: 'monthly' | 'yearly';
  amount_usd: string;
  grants_days: number;
}

export interface PaymentNetwork {
  id: PaymentNetworkId;
  display_name: string;
  asset_code: string;
  asset_name: string;
  token_contract: string;
  token_decimals: number;
  gas_symbol: string;
  available: boolean;
  asset_notice: string;
}

export interface CheckoutSummary {
  payment_enabled: boolean;
  code_type: 'one_time' | 'membership_alias';
  code: string;
  expires_at: string | null;
  plans: MembershipPlan[];
  networks: PaymentNetwork[];
}

export interface CryptoPayment {
  id: string;
  status: PaymentStatus;
  plan: string;
  tier: string;
  billing_cycle: string;
  amount_usd: string;
  quoted_amount: string;
  reference_adjustment: string;
  asset_code: string;
  asset_name: string;
  network: PaymentNetworkId;
  network_name: string;
  gas_symbol: string;
  token_contract: string;
  token_decimals: number;
  recipient_address: string;
  confirmations: number;
  required_confirmations: number;
  tx_hash: string | null;
  explorer_url: string | null;
  failure_code: string | null;
  expires_at: string;
  detected_at: string | null;
  confirmed_at: string | null;
  fulfilled_at: string | null;
  is_terminal: boolean;
}

interface ApiEnvelope<T> {
  success: boolean;
  server_time?: string;
  error?: string;
  message?: string;
  checkout?: CheckoutSummary;
  payment?: CryptoPayment;
  client_token?: string;
  details?: unknown;
}

export class MembershipPaymentApiError extends Error {
  readonly code: string;
  readonly httpStatus: number;

  constructor(code: string, message: string, httpStatus: number) {
    super(message);
    this.name = 'MembershipPaymentApiError';
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

async function request<T>(
  path: string,
  init: RequestInit = {},
): Promise<ApiEnvelope<T>> {
  const response = await fetch(`${MEMBERSHIP_API_BASE}${path}`, {
    ...init,
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      ...init.headers,
    },
  });
  let payload: ApiEnvelope<T>;
  try {
    payload = (await response.json()) as ApiEnvelope<T>;
  } catch {
    throw new MembershipPaymentApiError(
      'invalid_server_response',
      'The payment service returned an invalid response.',
      response.status,
    );
  }
  if (!response.ok || !payload.success) {
    throw new MembershipPaymentApiError(
      payload.error || 'payment_request_failed',
      payload.message || 'The payment request could not be completed.',
      response.status,
    );
  }
  return payload;
}

export async function loadCheckout(code: string): Promise<CheckoutSummary> {
  const payload = await request<CheckoutSummary>(
    `/payment/checkout/?code=${encodeURIComponent(code)}`,
  );
  if (!payload.checkout) throw new Error('Missing checkout response');
  return payload.checkout;
}

export async function createPaymentIntent(input: {
  code: string;
  plan: string;
  network: PaymentNetworkId;
}): Promise<{ payment: CryptoPayment; clientToken: string }> {
  const payload = await request<CryptoPayment>('/payment/intents/', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  if (!payload.payment || !payload.client_token) {
    throw new Error('Missing payment intent response');
  }
  return { payment: payload.payment, clientToken: payload.client_token };
}

export async function loadPaymentStatus(input: {
  id: string;
  code: string;
  clientToken: string;
}): Promise<CryptoPayment> {
  const payload = await request<CryptoPayment>(
    `/payment/intents/${encodeURIComponent(input.id)}/?code=${encodeURIComponent(input.code)}`,
    { headers: { 'X-Payment-Token': input.clientToken } },
  );
  if (!payload.payment) throw new Error('Missing payment status response');
  return payload.payment;
}

export async function submitTransactionHint(input: {
  id: string;
  code: string;
  clientToken: string;
  txHash: string;
}): Promise<CryptoPayment> {
  const payload = await request<CryptoPayment>(
    `/payment/intents/${encodeURIComponent(input.id)}/transaction-hint/`,
    {
      method: 'POST',
      headers: { 'X-Payment-Token': input.clientToken },
      body: JSON.stringify({ code: input.code, tx_hash: input.txHash }),
    },
  );
  if (!payload.payment) throw new Error('Missing transaction response');
  return payload.payment;
}
