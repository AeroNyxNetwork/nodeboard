/**
 * ============================================
 * File: app/withdraw/page.tsx
 * ============================================
 * Creation Reason:
 *   [REFERRAL-COMMISSION 2026-10-03 by Claude] Referrers earn 30% of the USDT
 *   their friends pay. Withdrawal (from 100 USDT) is requested here, opened
 *   from the App's referral screen, and paid by a person after review.
 * Main Functionality:
 *   1. Read the App's single-use session from the URL fragment.
 *   2. Show the withdrawable balance, minimum and per-network fee.
 *   3. Collect network + address + amount and submit one withdrawal request.
 * Dependencies:
 *   - lib/i18n/I18nProvider.tsx, components/common/{Logo,LanguageSelector,NetworkMark}
 *   - Backend: /api/membership/referral/withdraw/{summary/,}
 *
 * Main Logical Flow:
 *   #session=WDS_… -> GET summary (X-Withdraw-Session) -> form -> POST
 *   withdraw (same header, idempotent client_request_id) -> "in review".
 *
 * Important Note for Next Developer:
 *   The session is a money capability: it lives in the fragment (never sent
 *   to a server by the browser, never in logs), is removed from the address
 *   bar at once, kept only in sessionStorage for a reload, and is spent by
 *   the first successful request. The server re-validates everything; the
 *   checks here only save the person a round trip.
 *
 * Last Modified: v1.1.0 - [WITHDRAW-LIVE-FEE 2026-10-03 by Claude] The fee is a
 *   live estimate (re-quoted for the typed address); the final fee is the one
 *   actually paid at payout.
 * Previous: v1.0.0 - [REFERRAL-COMMISSION 2026-10-03 by Claude] Initial.
 * ============================================
 */
'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';

import LanguageSelector from '@/components/common/LanguageSelector';
import Logo from '@/components/common/Logo';
import NetworkMark from '@/components/common/NetworkMark';
import { LOCALE_STORAGE_KEY, Locale } from '@/lib/i18n';
import { useI18n } from '@/lib/i18n/I18nProvider';
import type { PaymentNetworkId } from '@/lib/membershipPayments';

const MEMBERSHIP_API_BASE =
  process.env.NEXT_PUBLIC_MEMBERSHIP_API_BASE_URL ||
  'https://api.aeronyx.network/api/membership';
const SESSION_STORAGE_KEY = 'aeronyx.referral.withdraw.session';
const APP_RETURN_URI = 'aeronyx://membership/withdraw-complete';

type WithdrawNetwork = { network: PaymentNetworkId; name: string; fee: string; fee_live?: boolean };
type Withdrawal = {
  id: string;
  amount: string;
  fee: string;
  net_amount: string;
  network: PaymentNetworkId;
  address_short: string;
  status: 'pending' | 'paid' | 'rejected';
  tx_hash: string;
  explorer_url: string | null;
  reject_reason: string;
  requested_at: string;
};
type Summary = {
  available: string;
  pending_withdrawal: string;
  min_withdrawal: string;
  withdrawal_enabled: boolean;
  has_pending_withdrawal: boolean;
  can_withdraw: boolean;
  account: string;
  networks: WithdrawNetwork[];
  expires_at: string;
  withdrawals: Withdrawal[];
};

type Copy = {
  eyebrow: string;
  title: string;
  lede: string;
  available: string;
  account: string;
  minimum: string;
  network: string;
  networkTip: string;
  fee: string;
  feeLabel: string;
  feeNote: string;
  address: string;
  addressPlaceholder: string;
  addressInvalid: string;
  amount: string;
  max: string;
  youReceive: string;
  wrongNetwork: string;
  submit: string;
  submitting: string;
  successTitle: string;
  successNote: string;
  returnToApp: string;
  pendingTitle: string;
  pendingNote: string;
  pausedTitle: string;
  belowMinimum: string;
  linkMissing: string;
  linkExpired: string;
  linkUsed: string;
  openFromApp: string;
  history: string;
  statusPending: string;
  statusPaid: string;
  statusRejected: string;
  viewTx: string;
  errors: Record<string, string>;
  genericError: string;
};

const en: Copy = {
  eyebrow: 'Referral earnings',
  title: 'Withdraw USDT',
  lede: 'Choose the network and paste your USDT address. We review every request and send it by hand.',
  available: 'Available',
  account: 'Account',
  minimum: 'Minimum {min} USDT',
  network: 'Network',
  networkTip: 'Pick the network your receiving wallet or exchange uses for USDT.',
  fee: 'Fee ≈ {fee} USDT',
  feeLabel: 'Network fee (est.)',
  feeNote: 'The fee follows the network at the moment we send. You will see the final amount once it is paid.',
  address: 'USDT address on {network}',
  addressPlaceholder: 'Paste your {network} address',
  addressInvalid: 'This is not a {network} address.',
  amount: 'Amount',
  max: 'Max',
  youReceive: 'You receive ≈',
  wrongNetwork: 'Double-check the address is on {network}. USDT sent to the wrong network cannot be recovered.',
  submit: 'Request withdrawal',
  submitting: 'Sending…',
  successTitle: 'Request received',
  successNote: 'After review we will send {net} USDT to {address} on {network}. The App shows the status.',
  returnToApp: 'Return to AeroNyx',
  pendingTitle: 'A withdrawal is being reviewed',
  pendingNote: 'You can request another one once it is paid.',
  pausedTitle: 'Withdrawals are paused for now.',
  belowMinimum: 'Withdrawals open at {min} USDT. You have {available} USDT.',
  linkMissing: 'Open this page from AeroNyx',
  linkExpired: 'This link has expired',
  linkUsed: 'This link was already used',
  openFromApp: 'In the AeroNyx App, go to Invite friends and tap Withdraw USDT to get a new link.',
  history: 'Recent withdrawals',
  statusPending: 'In review',
  statusPaid: 'Paid',
  statusRejected: 'Returned',
  viewTx: 'View transaction',
  errors: {
    invalid_address: 'This is not a valid address for the network.',
    below_minimum: 'The amount is below the minimum.',
    below_fee: 'The amount does not cover the network fee.',
    insufficient_balance: 'The amount is more than your available balance.',
    invalid_amount: 'Enter an amount with up to 6 decimals.',
    withdrawal_pending: 'A withdrawal is already being reviewed.',
    withdrawal_disabled: 'Withdrawals are paused for now.',
    network_unavailable: 'This network is not available.',
  },
  genericError: 'Something went wrong. Try again.',
};

const copyByLocale: Record<Locale, Copy> = {
  en,
  'zh-CN': {
    eyebrow: '推荐收益',
    title: '提现 USDT',
    lede: '选择网络,粘贴你的 USDT 地址。每笔提现都会人工审核后转出。',
    available: '可提现',
    account: '账户',
    minimum: '最低 {min} USDT',
    network: '网络',
    networkTip: '选择你的收款钱包或交易所接收 USDT 使用的网络。',
    fee: '手续费约 {fee} USDT',
    feeLabel: '手续费(预估)',
    feeNote: '手续费按转出当时的链上实际费用计算,到账后显示最终金额。',
    address: '{network} 上的 USDT 地址',
    addressPlaceholder: '粘贴你的 {network} 地址',
    addressInvalid: '这不是 {network} 地址。',
    amount: '金额',
    max: '全部',
    youReceive: '预计到账',
    wrongNetwork: '请再次确认地址属于 {network}。转到错误网络的 USDT 无法找回。',
    submit: '申请提现',
    submitting: '提交中…',
    successTitle: '申请已提交',
    successNote: '审核通过后,我们会在 {network} 上把 {net} USDT 转到 {address}。进度可以在 App 里查看。',
    returnToApp: '返回 AeroNyx',
    pendingTitle: '有一笔提现正在审核',
    pendingNote: '到账后可以再次申请。',
    pausedTitle: '提现暂时关闭。',
    belowMinimum: '满 {min} USDT 可提现,你目前有 {available} USDT。',
    linkMissing: '请从 AeroNyx App 打开此页面',
    linkExpired: '链接已过期',
    linkUsed: '链接已使用过',
    openFromApp: '在 AeroNyx App 的「邀请好友」里点「提现 USDT」获取新链接。',
    history: '最近提现',
    statusPending: '审核中',
    statusPaid: '已到账',
    statusRejected: '已退回',
    viewTx: '查看交易',
    errors: {
      invalid_address: '地址与所选网络不符。',
      below_minimum: '金额低于最低提现额。',
      below_fee: '金额不足以支付手续费。',
      insufficient_balance: '金额超过可提现余额。',
      invalid_amount: '请输入最多 6 位小数的金额。',
      withdrawal_pending: '已有一笔提现正在审核。',
      withdrawal_disabled: '提现暂时关闭。',
      network_unavailable: '该网络暂不可用。',
    },
    genericError: '出了点问题,请重试。',
  },
  'zh-TW': {
    eyebrow: '推薦收益',
    title: '提現 USDT',
    lede: '選擇網路,貼上你的 USDT 地址。每筆提現都會人工審核後轉出。',
    available: '可提現',
    account: '帳戶',
    minimum: '最低 {min} USDT',
    network: '網路',
    networkTip: '選擇你的收款錢包或交易所接收 USDT 使用的網路。',
    fee: '手續費約 {fee} USDT',
    feeLabel: '手續費(預估)',
    feeNote: '手續費按轉出當時的鏈上實際費用計算,到帳後顯示最終金額。',
    address: '{network} 上的 USDT 地址',
    addressPlaceholder: '貼上你的 {network} 地址',
    addressInvalid: '這不是 {network} 地址。',
    amount: '金額',
    max: '全部',
    youReceive: '預計到帳',
    wrongNetwork: '請再次確認地址屬於 {network}。轉到錯誤網路的 USDT 無法找回。',
    submit: '申請提現',
    submitting: '提交中…',
    successTitle: '申請已提交',
    successNote: '審核通過後,我們會在 {network} 上把 {net} USDT 轉到 {address}。進度可以在 App 裡查看。',
    returnToApp: '返回 AeroNyx',
    pendingTitle: '有一筆提現正在審核',
    pendingNote: '到帳後可以再次申請。',
    pausedTitle: '提現暫時關閉。',
    belowMinimum: '滿 {min} USDT 可提現,你目前有 {available} USDT。',
    linkMissing: '請從 AeroNyx App 打開此頁面',
    linkExpired: '連結已過期',
    linkUsed: '連結已使用過',
    openFromApp: '在 AeroNyx App 的「邀請好友」裡點「提現 USDT」取得新連結。',
    history: '最近提現',
    statusPending: '審核中',
    statusPaid: '已到帳',
    statusRejected: '已退回',
    viewTx: '查看交易',
    errors: {
      invalid_address: '地址與所選網路不符。',
      below_minimum: '金額低於最低提現額。',
      below_fee: '金額不足以支付手續費。',
      insufficient_balance: '金額超過可提現餘額。',
      invalid_amount: '請輸入最多 6 位小數的金額。',
      withdrawal_pending: '已有一筆提現正在審核。',
      withdrawal_disabled: '提現暫時關閉。',
      network_unavailable: '該網路暫不可用。',
    },
    genericError: '出了點問題,請重試。',
  },
  ja: {
    eyebrow: '紹介報酬',
    title: 'USDT を出金',
    lede: 'ネットワークを選び、USDT アドレスを貼り付けてください。すべての申請を審査し、手動で送金します。',
    available: '出金可能',
    account: 'アカウント',
    minimum: '最低 {min} USDT',
    network: 'ネットワーク',
    networkTip: '受け取るウォレットや取引所が USDT に使うネットワークを選んでください。',
    fee: '手数料 約{fee} USDT',
    feeLabel: '手数料(見込み)',
    feeNote: '手数料は送金時点のネットワーク実費です。支払い後に確定額が表示されます。',
    address: '{network} の USDT アドレス',
    addressPlaceholder: '{network} アドレスを貼り付け',
    addressInvalid: '{network} のアドレスではありません。',
    amount: '金額',
    max: '全額',
    youReceive: '受取見込み',
    wrongNetwork: 'アドレスが {network} のものか再確認してください。誤ったネットワークに送った USDT は取り戻せません。',
    submit: '出金を申請',
    submitting: '送信中…',
    successTitle: '申請を受け付けました',
    successNote: '審査後、{network} で {net} USDT を {address} に送金します。状況は App で確認できます。',
    returnToApp: 'AeroNyx に戻る',
    pendingTitle: '出金を審査中です',
    pendingNote: '支払い後に次の申請ができます。',
    pausedTitle: '出金は現在停止中です。',
    belowMinimum: '{min} USDT から出金できます。現在 {available} USDT です。',
    linkMissing: 'AeroNyx App から開いてください',
    linkExpired: 'リンクの有効期限が切れました',
    linkUsed: 'このリンクは使用済みです',
    openFromApp: 'AeroNyx App の「友だちを招待」で「USDT を出金」をタップすると新しいリンクが開きます。',
    history: '最近の出金',
    statusPending: '審査中',
    statusPaid: '支払い済み',
    statusRejected: '返金済み',
    viewTx: '取引を見る',
    errors: {
      invalid_address: 'このネットワークのアドレスではありません。',
      below_minimum: '最低出金額を下回っています。',
      below_fee: '手数料をまかなえない金額です。',
      insufficient_balance: '出金可能額を超えています。',
      invalid_amount: '小数点以下 6 桁までで入力してください。',
      withdrawal_pending: '審査中の出金があります。',
      withdrawal_disabled: '出金は現在停止中です。',
      network_unavailable: 'このネットワークは利用できません。',
    },
    genericError: '問題が発生しました。もう一度お試しください。',
  },
  ko: {
    eyebrow: '추천 수익',
    title: 'USDT 출금',
    lede: '네트워크를 선택하고 USDT 주소를 붙여 넣으세요. 모든 요청은 심사 후 직접 송금됩니다.',
    available: '출금 가능',
    account: '계정',
    minimum: '최소 {min} USDT',
    network: '네트워크',
    networkTip: '받는 지갑이나 거래소가 USDT에 사용하는 네트워크를 선택하세요.',
    fee: '수수료 약 {fee} USDT',
    feeLabel: '수수료(예상)',
    feeNote: '수수료는 송금 시점의 실제 네트워크 비용입니다. 지급 후 최종 금액이 표시됩니다.',
    address: '{network} USDT 주소',
    addressPlaceholder: '{network} 주소 붙여넣기',
    addressInvalid: '{network} 주소가 아닙니다.',
    amount: '금액',
    max: '전액',
    youReceive: '예상 수령액',
    wrongNetwork: '주소가 {network} 주소인지 다시 확인하세요. 잘못된 네트워크로 보낸 USDT는 되찾을 수 없습니다.',
    submit: '출금 신청',
    submitting: '보내는 중…',
    successTitle: '신청이 접수되었습니다',
    successNote: '심사 후 {network}에서 {net} USDT를 {address}(으)로 보냅니다. 진행 상황은 앱에서 볼 수 있습니다.',
    returnToApp: 'AeroNyx로 돌아가기',
    pendingTitle: '출금을 심사 중입니다',
    pendingNote: '지급된 후 다시 신청할 수 있습니다.',
    pausedTitle: '출금이 일시 중단되었습니다.',
    belowMinimum: '{min} USDT부터 출금할 수 있습니다. 현재 {available} USDT입니다.',
    linkMissing: 'AeroNyx 앱에서 열어 주세요',
    linkExpired: '링크가 만료되었습니다',
    linkUsed: '이미 사용된 링크입니다',
    openFromApp: 'AeroNyx 앱의 친구 초대에서 USDT 출금을 누르면 새 링크가 열립니다.',
    history: '최근 출금',
    statusPending: '심사 중',
    statusPaid: '지급 완료',
    statusRejected: '반환됨',
    viewTx: '거래 보기',
    errors: {
      invalid_address: '이 네트워크의 주소가 아닙니다.',
      below_minimum: '최소 출금액보다 적습니다.',
      below_fee: '수수료를 낼 수 없는 금액입니다.',
      insufficient_balance: '출금 가능 금액보다 많습니다.',
      invalid_amount: '소수점 6자리까지 입력하세요.',
      withdrawal_pending: '심사 중인 출금이 있습니다.',
      withdrawal_disabled: '출금이 일시 중단되었습니다.',
      network_unavailable: '이 네트워크는 사용할 수 없습니다.',
    },
    genericError: '문제가 발생했습니다. 다시 시도하세요.',
  },
  ru: {
    eyebrow: 'Реферальный доход',
    title: 'Вывод USDT',
    lede: 'Выберите сеть и вставьте адрес USDT. Каждую заявку мы проверяем и отправляем вручную.',
    available: 'Доступно',
    account: 'Аккаунт',
    minimum: 'Минимум {min} USDT',
    network: 'Сеть',
    networkTip: 'Выберите сеть, в которой ваш кошелёк или биржа принимает USDT.',
    fee: 'Комиссия ≈ {fee} USDT',
    feeLabel: 'Комиссия сети (оценка)',
    feeNote: 'Комиссия равна фактической стоимости сети в момент отправки. Итоговая сумма появится после выплаты.',
    address: 'Адрес USDT в сети {network}',
    addressPlaceholder: 'Вставьте адрес {network}',
    addressInvalid: 'Это не адрес {network}.',
    amount: 'Сумма',
    max: 'Всё',
    youReceive: 'Вы получите ≈',
    wrongNetwork: 'Проверьте, что адрес в сети {network}. USDT, отправленные не в ту сеть, вернуть нельзя.',
    submit: 'Отправить заявку',
    submitting: 'Отправка…',
    successTitle: 'Заявка принята',
    successNote: 'После проверки мы отправим {net} USDT на {address} в сети {network}. Статус виден в приложении.',
    returnToApp: 'Вернуться в AeroNyx',
    pendingTitle: 'Заявка на вывод проверяется',
    pendingNote: 'Новую можно подать после выплаты.',
    pausedTitle: 'Вывод временно приостановлен.',
    belowMinimum: 'Вывод доступен от {min} USDT. Сейчас у вас {available} USDT.',
    linkMissing: 'Откройте эту страницу из AeroNyx',
    linkExpired: 'Срок действия ссылки истёк',
    linkUsed: 'Ссылка уже использована',
    openFromApp: 'В приложении AeroNyx откройте «Пригласить друзей» и нажмите «Вывести USDT», чтобы получить новую ссылку.',
    history: 'Последние выводы',
    statusPending: 'На проверке',
    statusPaid: 'Выплачено',
    statusRejected: 'Возвращено',
    viewTx: 'Открыть транзакцию',
    errors: {
      invalid_address: 'Это не адрес выбранной сети.',
      below_minimum: 'Сумма меньше минимальной.',
      below_fee: 'Сумма не покрывает комиссию сети.',
      insufficient_balance: 'Сумма больше доступного баланса.',
      invalid_amount: 'Введите сумму, не более 6 знаков после точки.',
      withdrawal_pending: 'Одна заявка уже проверяется.',
      withdrawal_disabled: 'Вывод временно приостановлен.',
      network_unavailable: 'Эта сеть недоступна.',
    },
    genericError: 'Что-то пошло не так. Попробуйте ещё раз.',
  },
};

class WithdrawApiError extends Error {
  constructor(public code: string, public status: number) {
    super(code);
  }
}

async function api<T>(path: string, session: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${MEMBERSHIP_API_BASE}${path}`, {
    ...init,
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json', 'X-Withdraw-Session': session, ...(init?.headers || {}) },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body?.success !== true) {
    throw new WithdrawApiError(String(body?.error || 'request_failed'), response.status);
  }
  return body as T;
}

function pageLocaleFromApp(raw: string | null): Locale | null {
  const tag = (raw || '').trim().replace(/_/g, '-').toLowerCase();
  if (!tag) return null;
  if (tag.startsWith('zh')) return /(-tw|-hk|-mo|-hant)/.test(tag) ? 'zh-TW' : 'zh-CN';
  for (const candidate of ['ja', 'ko', 'ru', 'en'] as const) {
    if (tag === candidate || tag.startsWith(`${candidate}-`)) return candidate;
  }
  return null;
}

// Micro-USDT integers: a money form never adds floats.
function toMicro(raw: string): number | null {
  const match = /^(\d+)(?:\.(\d{0,6}))?$/.exec(raw.trim());
  if (!match) return null;
  return Number(match[1]) * 1_000_000 + Number((match[2] || '').padEnd(6, '0'));
}

function formatUsdt(micro: number): string {
  const cents = Math.floor(micro / 10_000);
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, '0')}`;
}

function trimAmount(raw: string): string {
  return raw.includes('.') ? raw.replace(/0+$/, '').replace(/\.$/, '') : raw;
}

const BASE58 = /^[1-9A-HJ-NP-Za-km-z]+$/;
function addressLooksValid(network: PaymentNetworkId, address: string): boolean {
  const value = address.trim();
  if (network === 'bsc' || network === 'ethereum') return /^0x[0-9a-fA-F]{40}$/.test(value);
  if (network === 'tron') return /^T/.test(value) && value.length === 34 && BASE58.test(value);
  return value.length >= 32 && value.length <= 44 && BASE58.test(value);
}

function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? `{${key}}`);
}

function newRequestId(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return `wd-${Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')}`;
}

function shortAddress(address: string): string {
  return address.length > 14 ? `${address.slice(0, 6)}…${address.slice(-4)}` : address;
}

export default function WithdrawPage() {
  const { locale, setLocale } = useI18n();
  const text = copyByLocale[locale] || en;
  const [session, setSession] = useState('');
  const [fromApp, setFromApp] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [fatal, setFatal] = useState<'missing' | 'expired' | 'used' | 'error' | ''>('');
  const [network, setNetwork] = useState<PaymentNetworkId | ''>('');
  const [address, setAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [done, setDone] = useState<Withdrawal | null>(null);
  const [doneAddress, setDoneAddress] = useState('');
  // One idempotency key per (network, address, amount): a retry after a
  // dropped response replays the same request instead of making a second.
  const requestIdRef = useRef<{ key: string; id: string } | null>(null);
  // [WITHDRAW-LIVE-FEE 2026-10-03 by Claude] Fee for the exact recipient
  // (a TRON / Solana address that never held USDT costs more to send to).
  const [quote, setQuote] = useState<{ key: string; fee: string } | null>(null);

  useEffect(() => {
    const url = new URL(window.location.href);
    const params = new URLSearchParams(url.hash.replace(/^#/, ''));
    const appLocale = pageLocaleFromApp(params.get('lang'));
    if (appLocale) {
      try {
        window.localStorage.setItem(LOCALE_STORAGE_KEY, appLocale);
      } catch {
        // Storage blocked: setLocale still applies for this visit.
      }
      setLocale(appLocale);
    }
    let value = (params.get('session') || '').trim();
    const app = params.get('from') === 'app';
    try {
      if (value) {
        window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ value, app }));
      } else {
        const stored = JSON.parse(window.sessionStorage.getItem(SESSION_STORAGE_KEY) || 'null');
        if (stored?.value) {
          value = String(stored.value);
          setFromApp(Boolean(stored.app));
        }
      }
    } catch {
      // No storage: a reload will need a new link from the App.
    }
    if (url.hash) window.history.replaceState(null, '', `${url.pathname}${url.search}`);
    if (app) setFromApp(true);
    if (!value.startsWith('WDS_')) {
      setFatal('missing');
      setLoading(false);
      return;
    }
    setSession(value);
  }, []);

  // Safari reuses an open tab when only the fragment changes (a new link from
  // the App): read the new session from scratch.
  useEffect(() => {
    const onHash = () => window.location.reload();
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const loadSummary = useCallback(async (value: string) => {
    setLoading(true);
    try {
      const data = await api<Summary>('/referral/withdraw/summary/', value);
      setSummary(data);
      setNetwork((current) => current || data.networks[0]?.network || '');
      setAmount((current) => current || trimAmount(data.available));
      setFatal('');
    } catch (error) {
      const code = error instanceof WithdrawApiError ? error.code : '';
      setFatal(code === 'session_expired' ? 'expired' : code === 'session_used' ? 'used' : code === 'invalid_session' ? 'missing' : 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (session) void loadSummary(session);
  }, [session, loadSummary]);

  const selected = summary?.networks.find((n) => n.network === network) || null;
  const quoteKey = `${network}|${address.trim()}`;
  const addressValid = network !== '' && addressLooksValid(network, address);
  useEffect(() => {
    if (!session || !addressValid) return;
    const key = quoteKey;
    const timer = window.setTimeout(async () => {
      try {
        const data = await api<{ fee: string }>(
          `/referral/withdraw/fee/?network=${encodeURIComponent(network)}&address=${encodeURIComponent(address.trim())}`,
          session,
        );
        setQuote({ key, fee: data.fee });
      } catch {
        // Keep the network-level estimate; the server prices the request anyway.
      }
    }, 400);
    return () => window.clearTimeout(timer);
  }, [session, quoteKey, addressValid]);
  const feeText = quote && quote.key === quoteKey ? quote.fee : selected?.fee || '';
  const availableMicro = summary ? toMicro(summary.available) ?? 0 : 0;
  const minMicro = summary ? toMicro(summary.min_withdrawal) ?? 0 : 0;
  const feeMicro = feeText ? toMicro(feeText) ?? 0 : 0;
  const amountMicro = toMicro(amount);
  const receiveMicro = amountMicro !== null ? Math.max(0, amountMicro - feeMicro) : 0;
  const addressOk = addressValid;
  const amountProblem = useMemo(() => {
    if (amount.trim() === '') return '';
    if (amountMicro === null) return text.errors.invalid_amount;
    if (amountMicro < minMicro) return text.errors.below_minimum;
    if (amountMicro > availableMicro) return text.errors.insufficient_balance;
    if (amountMicro <= feeMicro) return text.errors.below_fee;
    return '';
  }, [amount, amountMicro, minMicro, availableMicro, feeMicro, text]);
  const canSubmit = Boolean(summary?.can_withdraw && selected && addressOk && amountMicro !== null && !amountProblem && !submitting);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!canSubmit || !selected || amountMicro === null) return;
    setSubmitting(true);
    setFormError('');
    const cleanAddress = address.trim();
    const key = `${selected.network}|${cleanAddress}|${amount.trim()}`;
    if (requestIdRef.current?.key !== key) requestIdRef.current = { key, id: newRequestId() };
    try {
      const result = await api<{ withdrawal: Withdrawal }>('/referral/withdraw/', session, {
        method: 'POST',
        body: JSON.stringify({
          network: selected.network,
          address: cleanAddress,
          amount: amount.trim(),
          client_request_id: requestIdRef.current.id,
        }),
      });
      setDone(result.withdrawal);
      setDoneAddress(cleanAddress);
      try {
        window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
      } catch {
        // nothing to clear
      }
    } catch (error) {
      const code = error instanceof WithdrawApiError ? error.code : '';
      if (code === 'session_expired' || code === 'session_used' || code === 'invalid_session') {
        setFatal(code === 'session_expired' ? 'expired' : code === 'session_used' ? 'used' : 'missing');
      } else {
        setFormError(text.errors[code] || text.genericError);
      }
    } finally {
      setSubmitting(false);
    }
  }

  const networkName = selected?.name || '';
  const statusLabel = (status: Withdrawal['status']) =>
    status === 'paid' ? text.statusPaid : status === 'rejected' ? text.statusRejected : text.statusPending;
  const statusClass = (status: Withdrawal['status']) =>
    status === 'paid' ? 'bg-emerald-400/15 text-emerald-300' : status === 'rejected' ? 'bg-white/10 text-zinc-300' : 'bg-amber-400/15 text-amber-200';

  return (
    <main className="min-h-screen bg-[#08080B] px-4 pb-16 text-white sm:px-6">
      <div className="mx-auto max-w-2xl">
        <header className="flex min-h-20 items-center justify-between gap-3 border-b border-white/10">
          <div className="min-[380px]:hidden"><Logo className="h-8 w-8" /></div>
          <div className="hidden min-[380px]:block"><Logo className="h-8 w-8" showText /></div>
          <LanguageSelector compact className="w-32 shrink-0 sm:w-36" />
        </header>

        {loading && <div className="h-1 w-full overflow-hidden bg-white/10"><div className="h-full w-1/3 animate-pulse bg-emerald-400" /></div>}

        <div className="py-6 sm:py-10">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">{text.eyebrow}</p>
          <h1 className="text-2xl font-semibold leading-tight sm:text-4xl">{done ? text.successTitle : text.title}</h1>
          {!done && !fatal && <p className="mt-3 text-sm leading-6 text-zinc-400 sm:text-base">{text.lede}</p>}
        </div>

        {fatal && (
          <section className="rounded-lg border border-white/10 bg-white/[0.035] p-5 sm:p-7">
            <h2 className="text-lg font-semibold">
              {fatal === 'expired' ? text.linkExpired : fatal === 'used' ? text.linkUsed : fatal === 'missing' ? text.linkMissing : text.genericError}
            </h2>
            <p className="mt-2 text-sm leading-6 text-zinc-400">{text.openFromApp}</p>
            {fromApp && (
              <a href={APP_RETURN_URI} className="mt-5 inline-flex min-h-11 items-center rounded-lg bg-white px-4 text-sm font-semibold text-black transition hover:bg-zinc-200">
                {text.returnToApp}
              </a>
            )}
          </section>
        )}

        {done && (
          <section className="rounded-lg border border-emerald-400/40 bg-emerald-400/[0.07] p-5 sm:p-7" aria-live="polite">
            <div className="flex items-center gap-3">
              <NetworkMark network={done.network} className="h-9 w-9 shrink-0" />
              <div>
                <div className="text-2xl font-semibold tabular-nums">≈ {trimAmount(done.net_amount)} USDT</div>
                <div className="mt-0.5 text-xs text-zinc-400">{fill(text.fee, { fee: trimAmount(done.fee) })}</div>
              </div>
            </div>
            <p className="mt-4 text-sm leading-6 text-zinc-300">
              {fill(text.successNote, { net: `≈ ${trimAmount(done.net_amount)}`, address: shortAddress(doneAddress), network: networkName })}
            </p>
            {fromApp && (
              <a href={APP_RETURN_URI} className="mt-5 inline-flex min-h-11 items-center rounded-lg bg-white px-4 text-sm font-semibold text-black transition hover:bg-zinc-200">
                {text.returnToApp}
              </a>
            )}
          </section>
        )}

        {summary && !fatal && !done && (
          <div className="space-y-8">
            <section className="flex flex-wrap items-end justify-between gap-4 rounded-lg border border-white/10 bg-white/[0.035] p-5">
              <div>
                <div className="text-xs text-zinc-500">{text.available}</div>
                <div className="mt-1 text-3xl font-semibold tabular-nums">
                  {formatUsdt(availableMicro)} <span className="text-base font-medium text-zinc-400">USDT</span>
                </div>
                <div className="mt-1 text-xs text-zinc-500">{fill(text.minimum, { min: trimAmount(summary.min_withdrawal) })}</div>
              </div>
              <div className="text-right text-xs text-zinc-500">
                {text.account} <code className="text-zinc-300">{summary.account}</code>
              </div>
            </section>

            {!summary.withdrawal_enabled ? (
              <p className="rounded-lg border border-amber-300/25 bg-amber-300/[0.06] px-4 py-3 text-sm text-amber-100">{text.pausedTitle}</p>
            ) : summary.has_pending_withdrawal ? (
              <section className="rounded-lg border border-amber-300/25 bg-amber-300/[0.06] p-5">
                <h2 className="font-semibold text-amber-100">{text.pendingTitle}</h2>
                <p className="mt-1 text-sm text-zinc-300">{text.pendingNote}</p>
              </section>
            ) : availableMicro < minMicro ? (
              <p className="rounded-lg border border-white/10 bg-white/[0.035] px-4 py-3 text-sm text-zinc-300">
                {fill(text.belowMinimum, { min: trimAmount(summary.min_withdrawal), available: formatUsdt(availableMicro) })}
              </p>
            ) : (
              <form className="space-y-8" onSubmit={submit} noValidate>
                <section>
                  <h2 className="text-lg font-semibold">{text.network}</h2>
                  <p className="mb-4 mt-1 text-xs leading-5 text-zinc-400">{text.networkTip}</p>
                  <div className="grid grid-cols-2 gap-3">
                    {summary.networks.map((n) => {
                      const active = n.network === network;
                      return (
                        <button
                          key={n.network}
                          type="button"
                          onClick={() => { setNetwork(n.network); setFormError(''); }}
                          aria-pressed={active}
                          className={`flex min-h-16 items-center gap-3 rounded-lg border p-3 text-left transition focus:outline-none focus:ring-2 focus:ring-emerald-400/50 ${active ? 'border-emerald-400/60 bg-emerald-400/[0.08]' : 'border-white/10 bg-white/[0.03] hover:border-white/25'}`}
                        >
                          <NetworkMark network={n.network} className="h-9 w-9 shrink-0" />
                          <span className="min-w-0">
                            <span className="block text-sm font-medium leading-tight">{n.name}</span>
                            <span className="mt-0.5 block text-xs text-zinc-500">{fill(text.fee, { fee: trimAmount(n.fee) })}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </section>

                <section>
                  <label htmlFor="withdraw-address" className="text-lg font-semibold">{fill(text.address, { network: networkName })}</label>
                  <input
                    id="withdraw-address"
                    value={address}
                    onChange={(e) => { setAddress(e.target.value); setFormError(''); }}
                    autoComplete="off"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    placeholder={fill(text.addressPlaceholder, { network: networkName })}
                    className="mt-3 h-12 w-full rounded-lg border border-white/15 bg-black/30 px-4 font-mono text-sm outline-none placeholder:text-zinc-600 focus:border-emerald-400/60 focus:ring-2 focus:ring-emerald-400/20"
                  />
                  {address.trim() !== '' && !addressOk && (
                    <p className="mt-2 text-xs text-red-300">{fill(text.addressInvalid, { network: networkName })}</p>
                  )}
                </section>

                <section>
                  <div className="flex items-center justify-between">
                    <label htmlFor="withdraw-amount" className="text-lg font-semibold">{text.amount}</label>
                    <button type="button" onClick={() => setAmount(trimAmount(summary.available))} className="text-xs font-semibold text-emerald-300 hover:text-emerald-200">
                      {text.max}
                    </button>
                  </div>
                  <div className="relative mt-3">
                    <input
                      id="withdraw-amount"
                      value={amount}
                      onChange={(e) => { setAmount(e.target.value.replace(/[^\d.]/g, '')); setFormError(''); }}
                      inputMode="decimal"
                      autoComplete="off"
                      className="h-12 w-full rounded-lg border border-white/15 bg-black/30 px-4 pr-16 text-base tabular-nums outline-none focus:border-emerald-400/60 focus:ring-2 focus:ring-emerald-400/20"
                    />
                    <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm text-zinc-500">USDT</span>
                  </div>
                  {amountProblem && <p className="mt-2 text-xs text-red-300">{amountProblem}</p>}
                </section>

                <section className="rounded-lg border border-white/10 bg-white/[0.035] p-5">
                  <dl className="space-y-2 text-sm">
                    <div className="flex justify-between gap-4"><dt className="text-zinc-500">{text.amount}</dt><dd className="tabular-nums">{amountMicro !== null ? formatUsdt(amountMicro) : '—'} USDT</dd></div>
                    <div className="flex justify-between gap-4"><dt className="text-zinc-500">{text.feeLabel}</dt><dd className="tabular-nums">−{feeText ? trimAmount(feeText) : '—'} USDT</dd></div>
                    <div className="flex justify-between gap-4 border-t border-white/10 pt-2 text-base font-semibold"><dt>{text.youReceive}</dt><dd className="tabular-nums text-emerald-300">{formatUsdt(receiveMicro)} USDT</dd></div>
                  </dl>
                  <p className="mt-3 text-xs leading-5 text-zinc-500">{text.feeNote}</p>
                  <p className="mt-2 text-xs leading-5 text-amber-200/80">{fill(text.wrongNetwork, { network: networkName })}</p>
                </section>

                {formError && <div role="alert" className="rounded-lg border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-100">{formError}</div>}

                <button
                  type="submit"
                  disabled={!canSubmit}
                  className="h-12 w-full rounded-lg bg-white text-sm font-semibold text-black transition hover:bg-zinc-200 focus:outline-none focus:ring-2 focus:ring-emerald-400/60 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500"
                >
                  {submitting ? text.submitting : text.submit}
                </button>
              </form>
            )}

            {summary.withdrawals.length > 0 && (
              <section>
                <h2 className="mb-3 text-sm font-semibold text-zinc-300">{text.history}</h2>
                <ul className="divide-y divide-white/10 rounded-lg border border-white/10">
                  {summary.withdrawals.map((w) => (
                    <li key={w.id} className="flex items-center justify-between gap-3 p-4">
                      <div className="flex min-w-0 items-center gap-3">
                        <NetworkMark network={w.network} className="h-7 w-7 shrink-0" />
                        <div className="min-w-0">
                          <div className="text-sm tabular-nums">{trimAmount(w.net_amount)} USDT</div>
                          <div className="truncate text-xs text-zinc-500">
                            {w.address_short} · {new Date(w.requested_at).toLocaleDateString(locale)}
                            {w.status === 'rejected' && w.reject_reason ? ` · ${w.reject_reason}` : ''}
                          </div>
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusClass(w.status)}`}>{statusLabel(w.status)}</span>
                        {w.explorer_url && (
                          <a href={w.explorer_url} target="_blank" rel="noreferrer noopener" className="text-xs text-emerald-300 hover:text-emerald-200">{text.viewTx}</a>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
