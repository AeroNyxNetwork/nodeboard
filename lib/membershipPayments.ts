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
 * Last Modified: v1.1.1 - [USDT-TOPUP-BINDING 2026-08-09 by Codex]
 *   Clarified that every public payment intent is authorized by its checkout
 *   capability; recipient addresses remain authoritative backend output.
 * Previous: v1.1.0 - [USDT-CAPABILITY-RECOVERY 2026-08-09 by Codex]
 *   Moved checkout capabilities out of URLs/request bodies, added recovery
 *   evidence fields, and exposed the authenticated one-time checkout handoff.
 * Previous: v1.0.0 - [USDT-PAYMENTS 2026-08-07 by Codex] Initial client.
 * ============================================
 */

const MEMBERSHIP_API_BASE =
  process.env.NEXT_PUBLIC_MEMBERSHIP_API_BASE_URL ||
  'https://api.aeronyx.network/api/membership';

const NODEBOARD_API_KEY_STORAGE = 'aeronyx_api_key';

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
  transaction_hint_bound: boolean;
  recovery_until: string;
  can_still_recover: boolean;
  is_terminal: boolean;
}

export interface MembershipTopUpHandoff {
  topup_code: string;
  membership_code: string;
  status: string;
  expires_at: string | null;
  payment_url: string | null;
  payment_enabled: boolean;
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
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
    headers: {
      Accept: 'application/json',
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
  // [USDT-CAPABILITY-RECOVERY 2026-08-09 by Codex] A checkout code is a
  // bearer capability. Headers keep it out of access logs, referrers, and
  // browser history while preserving the legacy backend contract internally.
  const payload = await request<CheckoutSummary>('/payment/checkout/', {
    headers: { 'X-Checkout-Code': code },
  });
  if (!payload.checkout) throw new Error('Missing checkout response');
  return payload.checkout;
}

export async function createPaymentIntent(input: {
  code: string;
  plan: string;
  network: PaymentNetworkId;
}): Promise<{ payment: CryptoPayment; clientToken: string }> {
  // [USDT-TOPUP-BINDING 2026-08-09 by Codex] The checkout capability is the
  // authority for this payment. The browser never supplies a recipient; the
  // backend binds code, plan, network, amount, and address atomically.
  const payload = await request<CryptoPayment>('/payment/intents/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Checkout-Code': input.code,
    },
    body: JSON.stringify({ plan: input.plan, network: input.network }),
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
    `/payment/intents/${encodeURIComponent(input.id)}/`,
    {
      headers: {
        'X-Checkout-Code': input.code,
        'X-Payment-Token': input.clientToken,
      },
    },
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
      headers: {
        'Content-Type': 'application/json',
        'X-Checkout-Code': input.code,
        'X-Payment-Token': input.clientToken,
      },
      body: JSON.stringify({ tx_hash: input.txHash }),
    },
  );
  if (!payload.payment) throw new Error('Missing transaction response');
  return payload.payment;
}

/**
 * Create a short-lived checkout handoff for the currently authenticated
 * Nodeboard wallet. The wallet identity stays on the authenticated API; only
 * the random one-time code crosses into the public checkout page.
 */
export async function createMembershipTopUpHandoff(
  plan: 'premium_monthly' | 'premium_yearly',
): Promise<MembershipTopUpHandoff> {
  const apiKey = typeof window === 'undefined'
    ? null
    : window.localStorage.getItem(NODEBOARD_API_KEY_STORAGE);
  if (!apiKey) {
    throw new MembershipPaymentApiError(
      'authentication_required',
      'Reconnect your wallet before creating a payment.',
      401,
    );
  }

  const response = await fetch(`${MEMBERSHIP_API_BASE}/payment/topup-code/`, {
    method: 'POST',
    cache: 'no-store',
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ plan, currency: 'USDT' }),
  });
  const payload = await response.json().catch(() => null) as
    | (Partial<MembershipTopUpHandoff> & { error?: string; detail?: string })
    | null;
  if (!response.ok || !payload) {
    throw new MembershipPaymentApiError(
      payload?.error || 'checkout_handoff_failed',
      payload?.detail || 'The secure checkout could not be prepared.',
      response.status,
    );
  }
  return payload as MembershipTopUpHandoff;
}
