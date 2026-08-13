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
 * Last Modified: v1.3.0 - [USDT-CHECKOUT-SESSION 2026-08-13 by Codex]
 *   Centralized checkout-code routing and recoverable browser-session storage
 *   so authenticated handoff and public checkout cannot drift apart.
 * Previous: v1.2.0 - [USDT-CHECKOUT-LIFECYCLE 2026-08-13 by Codex]
 *   Centralized payment lifecycle policy, added abortable status reads, and
 *   distinguished invalid recovery credentials from transient API failures.
 * Previous: v1.1.1 - [USDT-TOPUP-BINDING 2026-08-09 by Codex]
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
const PAYMENT_SESSION_STORAGE_KEY = 'aeronyx.membership.payment.current';
const CHECKOUT_CODE_PATTERN = /^(?:TOP-)?NYX-[A-Z0-9-]{8,40}$/;

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

/** Browser-held capability required to recover one authoritative payment. */
export interface MembershipPaymentSession {
  code: string;
  id: string;
  token: string;
}

/** Product-safe lifecycle phases shared by checkout presentation surfaces. */
export type PaymentLifecyclePhase =
  | 'transfer'
  | 'verification'
  | 'fulfilled'
  | 'review'
  | 'closed';

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

function browserSessionStorage(storage?: Storage | null): Storage | null {
  if (storage !== undefined) return storage;
  if (typeof window === 'undefined') return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function isBoundedOpaqueValue(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 512;
}

/** Normalize a checkout bearer capability without exposing it in a query. */
export function normalizeMembershipCheckoutCode(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const normalized = raw.trim().toUpperCase();
  return CHECKOUT_CODE_PATTERN.test(normalized) ? normalized : null;
}

/** Build the only allowed in-app checkout route for a validated capability. */
export function membershipCheckoutHref(rawCode: unknown): string | null {
  const code = normalizeMembershipCheckoutCode(rawCode);
  return code ? `/topup#code=${encodeURIComponent(code)}` : null;
}

/**
 * Read the current recoverable payment session without throwing.
 *
 * [USDT-CHECKOUT-SESSION 2026-08-13 by Codex] A malformed browser value is
 * removed, while a valid session for another checkout is preserved. Merely
 * opening a second link must never destroy recovery for an already-funded one.
 */
export function readMembershipPaymentSession(
  expectedCode?: string,
  storage?: Storage | null,
): MembershipPaymentSession | null {
  const target = browserSessionStorage(storage);
  if (!target) return null;
  try {
    const raw = target.getItem(PAYMENT_SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<MembershipPaymentSession>;
    const code = normalizeMembershipCheckoutCode(parsed.code);
    if (!code || !isBoundedOpaqueValue(parsed.id) || !isBoundedOpaqueValue(parsed.token)) {
      target.removeItem(PAYMENT_SESSION_STORAGE_KEY);
      return null;
    }
    const expected = expectedCode
      ? normalizeMembershipCheckoutCode(expectedCode)
      : null;
    if (expectedCode && expected !== code) return null;
    return { code, id: parsed.id, token: parsed.token };
  } catch {
    try { target.removeItem(PAYMENT_SESSION_STORAGE_KEY); } catch { /* no-op */ }
    return null;
  }
}

/** Persist a recovery capability only after the backend creates an intent. */
export function writeMembershipPaymentSession(
  session: MembershipPaymentSession,
  storage?: Storage | null,
): boolean {
  const target = browserSessionStorage(storage);
  const code = normalizeMembershipCheckoutCode(session.code);
  if (!target || !code || !isBoundedOpaqueValue(session.id) || !isBoundedOpaqueValue(session.token)) {
    return false;
  }
  try {
    target.setItem(PAYMENT_SESSION_STORAGE_KEY, JSON.stringify({
      code,
      id: session.id,
      token: session.token,
    }));
    return true;
  } catch {
    return false;
  }
}

/** Remove the local recovery capability after explicit lifecycle closure. */
export function clearMembershipPaymentSession(storage?: Storage | null): void {
  const target = browserSessionStorage(storage);
  if (!target) return;
  try { target.removeItem(PAYMENT_SESSION_STORAGE_KEY); } catch { /* no-op */ }
}

const TRANSFER_OPEN_STATUSES = new Set<PaymentStatus>([
  'created',
  'awaiting_payment',
]);

const POLLING_STATUSES = new Set<PaymentStatus>([
  ...TRANSFER_OPEN_STATUSES,
  'detected',
  'confirming',
  'paid',
]);

const REVIEW_STATUSES = new Set<PaymentStatus>([
  'underpaid',
  'overpaid',
  'wrong_asset',
  'needs_review',
]);

/** Whether the backend-authored receiving instructions may still be used. */
export function isPaymentTransferOpen(payment: CryptoPayment): boolean {
  return TRANSFER_OPEN_STATUSES.has(payment.status);
}

/** Whether an expired intent remains eligible for a pre-expiry transaction. */
export function isPaymentRecoverable(
  payment: CryptoPayment,
  now = Date.now(),
): boolean {
  const recoveryDeadline = Date.parse(payment.recovery_until);
  return payment.status === 'expired'
    && payment.can_still_recover
    && Number.isFinite(recoveryDeadline)
    && recoveryDeadline > now;
}

/** Whether the browser should continue asking for authoritative chain state. */
export function shouldPollPayment(
  payment: CryptoPayment,
  now = Date.now(),
): boolean {
  return POLLING_STATUSES.has(payment.status)
    || isPaymentRecoverable(payment, now);
}

/**
 * Whether a transaction hint remains useful.
 *
 * [USDT-CHECKOUT-LIFECYCLE 2026-08-13 by Codex] Once a transfer is detected,
 * showing another submission control implies that the user should pay again.
 * Recovery keeps the control only for a transaction broadcast before expiry.
 */
export function canSubmitPaymentTransactionHint(
  payment: CryptoPayment,
  now = Date.now(),
): boolean {
  return !payment.transaction_hint_bound
    && (isPaymentTransferOpen(payment) || isPaymentRecoverable(payment, now));
}

/** Stable presentation phase derived only from authoritative payment state. */
export function paymentLifecyclePhase(
  payment: CryptoPayment,
  now = Date.now(),
): PaymentLifecyclePhase {
  if (payment.status === 'fulfilled') return 'fulfilled';
  if (REVIEW_STATUSES.has(payment.status)) return 'review';
  if (isPaymentTransferOpen(payment)) return 'transfer';
  if (
    payment.status === 'detected'
    || payment.status === 'confirming'
    || payment.status === 'paid'
    || isPaymentRecoverable(payment, now)
  ) return 'verification';
  return 'closed';
}

/** True only when a stored status capability is definitively unusable. */
export function isPaymentRecoveryCredentialRejected(error: unknown): boolean {
  return error instanceof MembershipPaymentApiError
    && [401, 403, 404, 410].includes(error.httpStatus);
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

export async function loadCheckout(
  code: string,
  signal?: AbortSignal,
): Promise<CheckoutSummary> {
  // [USDT-CAPABILITY-RECOVERY 2026-08-09 by Codex] A checkout code is a
  // bearer capability. Headers keep it out of access logs, referrers, and
  // browser history while preserving the legacy backend contract internally.
  const payload = await request<CheckoutSummary>('/payment/checkout/', {
    signal,
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
  signal?: AbortSignal;
}): Promise<CryptoPayment> {
  const payload = await request<CryptoPayment>(
    `/payment/intents/${encodeURIComponent(input.id)}/`,
    {
      signal: input.signal,
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
