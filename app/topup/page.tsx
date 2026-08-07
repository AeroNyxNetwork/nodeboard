/**
 * ============================================
 * File: app/topup/page.tsx
 * ============================================
 * Creation Reason:
 *   Turn the reserved membership top-up route into a real, privacy-preserving
 *   USDT checkout for Solana, BNB Smart Chain, and TRON.
 * Main Functionality:
 *   1. Validate an opaque membership/top-up capability.
 *   2. Select a fixed membership plan and payment network.
 *   3. Display the server-authored exact amount/address and QR code.
 *   4. Poll real chain-verification state and show fulfillment evidence.
 * Dependencies:
 *   - lib/membershipPayments.ts
 *   - lib/i18n/I18nProvider.tsx
 *   - components/common/Logo.tsx
 *   - components/common/LanguageSelector.tsx
 *   - qrcode
 *
 * Main Logical Flow:
 *   code -> checkout metadata -> immutable payment intent -> exact transfer ->
 *   detected -> confirming -> membership activated.
 *
 * Important Note for Next Developer:
 *   Never animate fake payment progress or infer paid state in the browser.
 *   Only backend status=fulfilled may render the success state.
 *
 * Last Modified: v2.0.0 - [USDT-PAYMENTS 2026-08-07 by Codex] Three-chain checkout.
 * ============================================
 */
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';

import LanguageSelector from '@/components/common/LanguageSelector';
import Logo from '@/components/common/Logo';
import { Locale } from '@/lib/i18n';
import { useI18n } from '@/lib/i18n/I18nProvider';
import {
  CheckoutSummary,
  CryptoPayment,
  MembershipPaymentApiError,
  PaymentNetworkId,
  createPaymentIntent,
  loadCheckout,
  loadPaymentStatus,
  submitTransactionHint,
} from '@/lib/membershipPayments';

type Copy = {
  membership: string;
  title: string;
  lede: string;
  account: string;
  choosePlan: string;
  chooseNetwork: string;
  network: string;
  monthly: string;
  yearly: string;
  days: string;
  continue: string;
  preparing: string;
  unavailable: string;
  exactAmount: string;
  receivingAddress: string;
  networkFee: string;
  expires: string;
  copy: string;
  copied: string;
  scan: string;
  status: string;
  awaiting: string;
  detected: string;
  confirming: string;
  fulfilled: string;
  expired: string;
  review: string;
  txHint: string;
  txPlaceholder: string;
  submit: string;
  submitting: string;
  explorer: string;
  retry: string;
  missingCode: string;
  openFromApp: string;
  privacy: string;
  publicChain: string;
  bscNotice: string;
  exactWarning: string;
};

const en: Copy = {
  membership: 'AeroNyx Membership',
  title: 'Membership with USDT',
  lede: 'Choose a plan and pay on the network you already use. AeroNyx activates membership only after independent on-chain verification.',
  account: 'Checkout account',
  choosePlan: 'Choose membership',
  chooseNetwork: 'Choose payment network', network: 'Network',
  monthly: 'Monthly', yearly: 'Yearly', days: 'days', continue: 'Create payment',
  preparing: 'Preparing secure payment…', unavailable: 'Temporarily unavailable',
  exactAmount: 'Exact amount', receivingAddress: 'Receiving address',
  networkFee: 'Network fee requires', expires: 'Payment window', copy: 'Copy', copied: 'Copied',
  scan: 'Scan the receiving address', status: 'Payment status', awaiting: 'Waiting for transfer',
  detected: 'Transfer detected', confirming: 'Confirming on-chain', fulfilled: 'Membership activated',
  expired: 'Payment window expired', review: 'Payment needs review', txHint: 'Already sent?',
  txPlaceholder: 'Paste transaction hash to speed up detection', submit: 'Check transaction',
  submitting: 'Checking…', explorer: 'View transaction', retry: 'Start again',
  missingCode: 'A checkout code is required.',
  openFromApp: 'Open this page from AeroNyx Membership so the private checkout code is included.',
  privacy: 'This page transmits only a random membership code, never your AeroNyx wallet, chat identity, Privacy Network activity, or private memory.',
  publicChain: 'Blockchain transfers remain public and may reveal the sending wallet.',
  bscNotice: 'BNB Smart Chain accepts Binance-Peg BSC-USD, not native Tether-issued USDT.',
  exactWarning: 'Send the exact amount on the selected network. Wrong-network transfers cannot be recovered automatically.',
};

const copyByLocale: Record<Locale, Copy> = {
  en,
  'zh-CN': {
    ...en, membership: 'AeroNyx 会员', title: '使用 USDT 购买会员', lede: '选择会员套餐和你常用的支付网络。只有独立完成链上验证后，AeroNyx 才会激活会员。',
    account: '结账识别码', choosePlan: '选择会员', chooseNetwork: '选择支付网络', network: '网络', monthly: '月付', yearly: '年付', days: '天',
    continue: '创建支付订单', preparing: '正在准备安全支付…', unavailable: '暂时不可用', exactAmount: '精确支付金额', receivingAddress: '收款地址',
    networkFee: '网络手续费需要', expires: '支付剩余时间', copy: '复制', copied: '已复制', scan: '扫描收款地址', status: '支付状态',
    awaiting: '等待转账', detected: '已检测到转账', confirming: '正在等待链上确认', fulfilled: '会员已激活', expired: '支付订单已过期', review: '支付需要人工审核',
    txHint: '已经转账？', txPlaceholder: '粘贴交易哈希可以加快检测', submit: '检查交易', submitting: '检查中…', explorer: '查看链上交易', retry: '重新创建',
    missingCode: '缺少支付码。', openFromApp: '请从 AeroNyx 的会员页面进入，以携带私密支付码。',
    privacy: '此页面只传输随机会员码，不会传输你的 AeroNyx 钱包、聊天身份、隐私网络活动或私人记忆。',
    publicChain: '链上转账记录是公开的，可能显示付款钱包地址。', bscNotice: 'BNB Smart Chain 接收 Binance-Peg BSC-USD，并非 Tether 原生发行的 USDT。',
    exactWarning: '请在所选网络发送精确金额。转错网络的资产无法自动找回。',
  },
  'zh-TW': {
    ...en, membership: 'AeroNyx 會員', title: '使用 USDT 購買會員', lede: '選擇會員方案和你常用的支付網路。只有獨立完成鏈上驗證後，AeroNyx 才會啟用會員。',
    account: '結帳識別碼', choosePlan: '選擇會員', chooseNetwork: '選擇支付網路', network: '網路', monthly: '月付', yearly: '年付', days: '天',
    continue: '建立支付訂單', preparing: '正在準備安全支付…', unavailable: '暫時不可用', exactAmount: '精確支付金額', receivingAddress: '收款地址',
    networkFee: '網路手續費需要', expires: '支付剩餘時間', copy: '複製', copied: '已複製', scan: '掃描收款地址', status: '支付狀態',
    awaiting: '等待轉帳', detected: '已偵測到轉帳', confirming: '正在等待鏈上確認', fulfilled: '會員已啟用', expired: '支付訂單已過期', review: '支付需要人工審核',
    txHint: '已經轉帳？', txPlaceholder: '貼上交易雜湊可以加快偵測', submit: '檢查交易', submitting: '檢查中…', explorer: '查看鏈上交易', retry: '重新建立',
    missingCode: '缺少支付碼。', openFromApp: '請從 AeroNyx 的會員頁面進入，以攜帶私密支付碼。',
    privacy: '此頁面只傳輸隨機會員碼，不會傳輸你的 AeroNyx 錢包、聊天身分、隱私網路活動或私人記憶。',
    publicChain: '鏈上轉帳記錄是公開的，可能顯示付款錢包地址。', bscNotice: 'BNB Smart Chain 接收 Binance-Peg BSC-USD，並非 Tether 原生發行的 USDT。',
    exactWarning: '請在所選網路傳送精確金額。轉錯網路的資產無法自動找回。',
  },
  ja: {
    ...en, membership: 'AeroNyx メンバーシップ', title: 'USDTでメンバーシップを購入', lede: 'プランと利用するネットワークを選択してください。独立したオンチェーン検証後にのみ有効化されます。',
    account: '決済識別コード', choosePlan: 'プランを選択', chooseNetwork: '支払いネットワーク', network: 'ネットワーク', monthly: '月額', yearly: '年額', days: '日', continue: '支払いを作成',
    preparing: '安全な支払いを準備中…', unavailable: '一時利用不可', exactAmount: '正確な金額', receivingAddress: '受取アドレス', networkFee: '手数料に必要',
    expires: '残り時間', copy: 'コピー', copied: 'コピー済み', scan: '受取アドレスをスキャン', status: '支払い状況', awaiting: '送金を待っています',
    detected: '送金を検出しました', confirming: 'オンチェーン確認中', fulfilled: 'メンバーシップ有効', expired: '支払い期限切れ', review: '確認が必要です',
    txHint: '送金済みですか？', txPlaceholder: 'トランザクションハッシュを入力', submit: '取引を確認', submitting: '確認中…', explorer: '取引を表示', retry: 'やり直す',
    missingCode: '決済コードが必要です。', openFromApp: 'AeroNyxのメンバーシップ画面から開いてください。',
    privacy: 'このページはランダムな会員コードのみを送信し、ウォレット、チャット、プライバシーネットワークの活動、個人メモリは送信しません。', publicChain: 'ブロックチェーン上の送金は公開され、送信元ウォレットが表示される場合があります。',
    bscNotice: 'BNB Smart ChainではTetherネイティブUSDTではなくBinance-Peg BSC-USDを受け付けます。', exactWarning: '選択したネットワークで正確な金額を送ってください。誤送金は自動復旧できません。',
  },
  ko: {
    ...en, membership: 'AeroNyx 멤버십', title: 'USDT로 멤버십 구매', lede: '요금제와 결제 네트워크를 선택하세요. 독립적인 온체인 검증 후에만 멤버십이 활성화됩니다.',
    account: '결제 식별 코드', choosePlan: '멤버십 선택', chooseNetwork: '결제 네트워크 선택', network: '네트워크', monthly: '월간', yearly: '연간', days: '일', continue: '결제 만들기',
    preparing: '안전한 결제 준비 중…', unavailable: '일시적으로 사용할 수 없음', exactAmount: '정확한 금액', receivingAddress: '수신 주소', networkFee: '네트워크 수수료',
    expires: '남은 시간', copy: '복사', copied: '복사됨', scan: '수신 주소 스캔', status: '결제 상태', awaiting: '송금 대기 중', detected: '송금 감지됨',
    confirming: '온체인 확인 중', fulfilled: '멤버십 활성화됨', expired: '결제 시간 만료', review: '검토가 필요합니다', txHint: '이미 보냈나요?',
    txPlaceholder: '트랜잭션 해시를 입력하세요', submit: '거래 확인', submitting: '확인 중…', explorer: '거래 보기', retry: '다시 시작', missingCode: '결제 코드가 필요합니다.',
    openFromApp: '비공개 결제 코드가 포함되도록 AeroNyx 멤버십에서 열어 주세요.', privacy: '이 페이지는 무작위 멤버십 코드만 전송하며 지갑, 채팅 ID, 프라이버시 네트워크 활동, 개인 메모리는 전송하지 않습니다.',
    publicChain: '블록체인 송금은 공개되며 보내는 지갑이 표시될 수 있습니다.', bscNotice: 'BNB Smart Chain에서는 Tether 네이티브 USDT가 아닌 Binance-Peg BSC-USD를 받습니다.',
    exactWarning: '선택한 네트워크에서 정확한 금액을 보내세요. 잘못된 네트워크 송금은 자동 복구되지 않습니다.',
  },
  ru: {
    ...en, membership: 'Подписка AeroNyx', title: 'Оплата подписки в USDT', lede: 'Выберите тариф и сеть. Подписка активируется только после независимой проверки транзакции в блокчейне.',
    account: 'Код оплаты', choosePlan: 'Выберите подписку', chooseNetwork: 'Выберите сеть', network: 'Сеть', monthly: 'Ежемесячно', yearly: 'Ежегодно', days: 'дней', continue: 'Создать платёж',
    preparing: 'Подготовка безопасного платежа…', unavailable: 'Временно недоступно', exactAmount: 'Точная сумма', receivingAddress: 'Адрес получателя', networkFee: 'Комиссия оплачивается в',
    expires: 'Осталось времени', copy: 'Копировать', copied: 'Скопировано', scan: 'Отсканируйте адрес', status: 'Статус платежа', awaiting: 'Ожидание перевода',
    detected: 'Перевод обнаружен', confirming: 'Подтверждение в сети', fulfilled: 'Подписка активирована', expired: 'Время оплаты истекло', review: 'Требуется проверка',
    txHint: 'Уже отправили?', txPlaceholder: 'Вставьте хэш транзакции', submit: 'Проверить', submitting: 'Проверка…', explorer: 'Открыть транзакцию', retry: 'Начать заново',
    missingCode: 'Нужен платёжный код.', openFromApp: 'Откройте страницу из раздела подписки AeroNyx.',
    privacy: 'Эта страница передаёт только случайный код подписки, но не кошелёк AeroNyx, чаты, активность в Privacy Network или приватную память.', publicChain: 'Переводы в блокчейне публичны и могут раскрывать адрес отправителя.',
    bscNotice: 'В BNB Smart Chain принимается Binance-Peg BSC-USD, а не нативный USDT от Tether.', exactWarning: 'Отправьте точную сумму в выбранной сети. Ошибочный перевод нельзя восстановить автоматически.',
  },
};

const ACTIVE_STATUSES = new Set(['created', 'awaiting_payment', 'detected', 'confirming', 'paid']);

function sessionKey(code: string) {
  return `aeronyx.membership.payment.${code}`;
}

function formatCountdown(expiresAt: string, now: number) {
  const seconds = Math.max(0, Math.floor((new Date(expiresAt).getTime() - now) / 1000));
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

function friendlyError(error: unknown) {
  if (error instanceof MembershipPaymentApiError) return error.message;
  if (error instanceof Error) return error.message;
  return 'Payment service is temporarily unavailable.';
}

export default function TopUpPage() {
  const { locale } = useI18n();
  const text = copyByLocale[locale] || en;
  const [code, setCode] = useState('');
  const [checkout, setCheckout] = useState<CheckoutSummary | null>(null);
  const [selectedPlan, setSelectedPlan] = useState('');
  const [selectedNetwork, setSelectedNetwork] = useState<PaymentNetworkId | ''>('');
  const [payment, setPayment] = useState<CryptoPayment | null>(null);
  const [clientToken, setClientToken] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [txHash, setTxHash] = useState('');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState('');
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const raw = new URLSearchParams(window.location.search).get('code') || '';
    const normalized = raw.trim().toUpperCase();
    if (/^(?:TOP-)?NYX-[A-Z0-9-]{8,40}$/.test(normalized)) setCode(normalized);
    else setLoading(false);
  }, []);

  const refreshPayment = useCallback(async (id: string, token: string, checkoutCode: string) => {
    const next = await loadPaymentStatus({ id, code: checkoutCode, clientToken: token });
    setPayment(next);
    return next;
  }, []);

  useEffect(() => {
    if (!code) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const summary = await loadCheckout(code);
        if (cancelled) return;
        setCheckout(summary);
        setSelectedPlan(summary.plans[0]?.id || '');
        setSelectedNetwork(summary.networks.find((item) => item.available)?.id || '');
        const saved = window.sessionStorage.getItem(sessionKey(code));
        if (saved) {
          const parsed = JSON.parse(saved) as { id?: string; token?: string };
          if (parsed.id && parsed.token) {
            setClientToken(parsed.token);
            try {
              await refreshPayment(parsed.id, parsed.token, code);
            } catch {
              window.sessionStorage.removeItem(sessionKey(code));
              setClientToken('');
            }
          }
        }
      } catch (requestError) {
        if (!cancelled) setError(friendlyError(requestError));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [code, refreshPayment]);

  useEffect(() => {
    if (!payment || !clientToken || !code || !ACTIVE_STATUSES.has(payment.status)) return;
    let running = false;
    const timer = window.setInterval(async () => {
      if (running) return;
      running = true;
      try { await refreshPayment(payment.id, clientToken, code); }
      catch (requestError) { setError(friendlyError(requestError)); }
      finally { running = false; }
    }, 5000);
    return () => window.clearInterval(timer);
  }, [payment, clientToken, code, refreshPayment]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!payment?.recipient_address) { setQrDataUrl(''); return; }
    QRCode.toDataURL(payment.recipient_address, {
      width: 320,
      margin: 1,
      color: { dark: '#09090B', light: '#FFFFFF' },
      errorCorrectionLevel: 'M',
    }).then(setQrDataUrl).catch(() => setQrDataUrl(''));
  }, [payment?.recipient_address]);

  const selectedPlanData = useMemo(
    () => checkout?.plans.find((item) => item.id === selectedPlan),
    [checkout, selectedPlan],
  );
  const selectedNetworkData = useMemo(
    () => checkout?.networks.find((item) => item.id === selectedNetwork),
    [checkout, selectedNetwork],
  );

  async function startPayment() {
    if (!code || !selectedPlan || !selectedNetwork) return;
    setCreating(true);
    setError('');
    try {
      const result = await createPaymentIntent({ code, plan: selectedPlan, network: selectedNetwork });
      setPayment(result.payment);
      setClientToken(result.clientToken);
      window.sessionStorage.setItem(
        sessionKey(code),
        JSON.stringify({ id: result.payment.id, token: result.clientToken }),
      );
    } catch (requestError) {
      setError(friendlyError(requestError));
    } finally {
      setCreating(false);
    }
  }

  async function copyValue(key: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      window.setTimeout(() => setCopied(''), 1500);
    } catch { setError('Clipboard access is unavailable.'); }
  }

  async function sendTransactionHint() {
    if (!payment || !clientToken || !txHash.trim()) return;
    setSubmitting(true);
    setError('');
    try {
      const next = await submitTransactionHint({
        id: payment.id, code, clientToken, txHash: txHash.trim(),
      });
      setPayment(next);
      setTxHash('');
    } catch (requestError) {
      setError(friendlyError(requestError));
    } finally { setSubmitting(false); }
  }

  function resetPayment() {
    if (code) window.sessionStorage.removeItem(sessionKey(code));
    setPayment(null); setClientToken(''); setTxHash(''); setError('');
  }

  const statusLabel = payment?.status === 'fulfilled' ? text.fulfilled
    : payment?.status === 'detected' ? text.detected
      : payment?.status === 'confirming' || payment?.status === 'paid' ? text.confirming
        : payment?.status === 'expired' ? text.expired
          : payment?.status === 'needs_review' || payment?.status === 'underpaid' || payment?.status === 'overpaid' || payment?.status === 'wrong_asset' ? text.review
            : text.awaiting;

  return (
    <main className="min-h-screen bg-[#08080B] px-4 pb-16 text-white sm:px-6">
      <div className="mx-auto max-w-5xl">
        <header className="flex min-h-20 items-center justify-between gap-3 border-b border-white/10">
          {/* [USDT-PAYMENTS 2026-08-07 by Codex] Preserve breathing room on
              320px devices without shrinking the language control. */}
          <div className="min-[380px]:hidden"><Logo className="h-8 w-8" /></div>
          <div className="hidden min-[380px]:block"><Logo className="h-8 w-8" showText /></div>
          <LanguageSelector compact className="w-32 shrink-0 sm:w-36" />
        </header>

        <div className="py-10 sm:py-14">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">{text.membership}</p>
          <h1 className="max-w-3xl text-3xl font-semibold leading-tight sm:text-5xl">{text.title}</h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-zinc-400 sm:text-lg">{text.lede}</p>
        </div>

        {!code && !loading && (
          <section className="max-w-2xl border-l-2 border-amber-400 py-2 pl-5">
            <h2 className="text-lg font-semibold">{text.missingCode}</h2>
            <p className="mt-2 leading-6 text-zinc-400">{text.openFromApp}</p>
          </section>
        )}

        {loading && <div className="h-1 w-full overflow-hidden bg-white/10"><div className="h-full w-1/3 animate-pulse bg-emerald-400" /></div>}

        {error && (
          <div role="alert" className="mb-6 rounded-lg border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-100">{error}</div>
        )}

        {checkout && !payment && (
          <div className="grid gap-10 lg:grid-cols-[1fr_360px]">
            <div className="space-y-10">
              <section>
                <div className="mb-4 flex items-center justify-between gap-4">
                  <h2 className="text-lg font-semibold">{text.choosePlan}</h2>
                  <code className="max-w-[55%] truncate text-xs text-zinc-500" title={code}>{code}</code>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {checkout.plans.map((plan) => {
                    const active = selectedPlan === plan.id;
                    return (
                      <button key={plan.id} onClick={() => setSelectedPlan(plan.id)}
                        className={`min-h-32 rounded-lg border p-5 text-left transition ${active ? 'border-emerald-400 bg-emerald-400/10' : 'border-white/10 bg-white/[0.025] hover:border-white/25'}`}>
                        <div className="flex items-start justify-between gap-4">
                          <div><div className="text-sm capitalize text-zinc-400">{plan.tier}</div><div className="mt-1 font-medium">{plan.billing_cycle === 'yearly' ? text.yearly : text.monthly}</div></div>
                          <div className="text-right"><span className="text-2xl font-semibold">${plan.amount_usd}</span><div className="mt-1 text-xs text-zinc-500">{plan.grants_days} {text.days}</div></div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>

              <section>
                <h2 className="mb-4 text-lg font-semibold">{text.chooseNetwork}</h2>
                <div className="grid gap-3 sm:grid-cols-3">
                  {checkout.networks.map((network) => {
                    const active = selectedNetwork === network.id;
                    return (
                      <button key={network.id} disabled={!network.available} onClick={() => setSelectedNetwork(network.id)}
                        className={`min-h-28 rounded-lg border p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-40 ${active ? 'border-emerald-400 bg-emerald-400/10' : 'border-white/10 bg-white/[0.025] hover:border-white/25'}`}>
                        <span className="mb-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-xs font-bold">{network.id === 'solana' ? 'S' : network.id === 'bsc' ? 'B' : 'T'}</span>
                        <span className="block text-sm font-medium">{network.display_name}</span>
                        <span className="mt-1 block text-xs text-zinc-500">USDT · {network.gas_symbol}</span>
                      </button>
                    );
                  })}
                </div>
                {selectedNetworkData?.id === 'bsc' && <p className="mt-3 text-xs leading-5 text-amber-300/80">{text.bscNotice}</p>}
              </section>
            </div>

            <aside className="h-fit rounded-lg border border-white/10 bg-white/[0.035] p-6 lg:sticky lg:top-6">
              <div className="text-sm text-zinc-500">{text.account}</div>
              <code className="mt-2 block truncate text-sm text-zinc-300">{code}</code>
              <div className="my-6 h-px bg-white/10" />
              <div className="flex justify-between text-sm"><span className="text-zinc-400">{selectedPlanData?.tier || '—'}</span><span>{selectedPlanData ? `$${selectedPlanData.amount_usd}` : '—'}</span></div>
              <div className="mt-3 flex justify-between text-sm"><span className="text-zinc-400">{text.network}</span><span>{selectedNetworkData?.display_name || '—'}</span></div>
              <button onClick={startPayment} disabled={!checkout.payment_enabled || !selectedPlan || !selectedNetwork || creating}
                className="mt-6 h-12 w-full rounded-lg bg-white px-4 font-semibold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500">
                {creating ? text.preparing : checkout.payment_enabled ? text.continue : text.unavailable}
              </button>
            </aside>
          </div>
        )}

        {payment && (
          <div className="grid gap-8 lg:grid-cols-[320px_1fr]">
            <section className="rounded-lg border border-white/10 bg-white p-4 text-black">
              {qrDataUrl ? <img src={qrDataUrl} alt={text.scan} className="aspect-square w-full" /> : <div className="aspect-square w-full animate-pulse bg-zinc-100" />}
              <p className="mt-3 text-center text-xs text-zinc-500">{text.scan}</p>
            </section>

            <section className="min-w-0 rounded-lg border border-white/10 bg-white/[0.035] p-5 sm:p-7">
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 pb-5">
                <div><div className="text-xs uppercase tracking-[0.16em] text-zinc-500">{text.status}</div><h2 className="mt-2 text-xl font-semibold">{statusLabel}</h2></div>
                <div className={`rounded-full px-3 py-1 text-xs ${payment.status === 'fulfilled' ? 'bg-emerald-400/15 text-emerald-300' : payment.status === 'expired' ? 'bg-red-400/15 text-red-300' : 'bg-amber-400/15 text-amber-200'}`}>
                  {payment.confirmations}/{payment.required_confirmations}
                </div>
              </div>

              <div className="grid gap-6 py-6 sm:grid-cols-2">
                <div><div className="text-xs text-zinc-500">{text.exactAmount}</div><button onClick={() => copyValue('amount', payment.quoted_amount)} className="mt-2 flex max-w-full items-baseline gap-2 text-left"><span className="break-all text-3xl font-semibold tabular-nums">{payment.quoted_amount}</span><span className="text-zinc-400">USDT</span><span className="text-xs text-emerald-300">{copied === 'amount' ? text.copied : text.copy}</span></button></div>
                <div><div className="text-xs text-zinc-500">{text.expires}</div><div className="mt-2 text-3xl font-semibold tabular-nums">{formatCountdown(payment.expires_at, now)}</div><div className="mt-1 text-xs text-zinc-500">{payment.network_name} · {text.networkFee} {payment.gas_symbol}</div></div>
              </div>

              <div className="border-t border-white/10 py-5">
                <div className="text-xs text-zinc-500">{text.receivingAddress}</div>
                <button onClick={() => copyValue('address', payment.recipient_address)} className="mt-2 flex w-full items-center gap-3 rounded-lg border border-white/10 bg-black/30 p-3 text-left">
                  <code className="min-w-0 flex-1 break-all text-xs leading-5 text-zinc-200">{payment.recipient_address}</code><span className="shrink-0 text-xs text-emerald-300">{copied === 'address' ? text.copied : text.copy}</span>
                </button>
              </div>

              <p className="rounded-lg border border-amber-300/20 bg-amber-300/[0.06] p-3 text-xs leading-5 text-amber-100/80">{text.exactWarning}</p>
              {payment.network === 'bsc' && <p className="mt-3 text-xs leading-5 text-zinc-500">{text.bscNotice}</p>}

              {ACTIVE_STATUSES.has(payment.status) && (
                <div className="mt-6 border-t border-white/10 pt-5">
                  <label className="text-xs text-zinc-500" htmlFor="tx-hash">{text.txHint}</label>
                  <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                    <input id="tx-hash" value={txHash} onChange={(event) => setTxHash(event.target.value)} placeholder={text.txPlaceholder}
                      className="h-11 min-w-0 flex-1 rounded-lg border border-white/10 bg-black/30 px-3 text-sm outline-none focus:border-emerald-400/60" />
                    <button onClick={sendTransactionHint} disabled={!txHash.trim() || submitting}
                      className="h-11 rounded-lg border border-white/15 px-4 text-sm font-medium transition hover:bg-white/10 disabled:opacity-40">{submitting ? text.submitting : text.submit}</button>
                  </div>
                </div>
              )}

              <div className="mt-6 flex flex-wrap gap-3">
                {payment.explorer_url && <a href={payment.explorer_url} target="_blank" rel="noreferrer" className="rounded-lg border border-white/15 px-4 py-2 text-sm hover:bg-white/10">{text.explorer}</a>}
                {(payment.status === 'expired' || payment.status === 'failed' || payment.status === 'cancelled') && <button onClick={resetPayment} className="rounded-lg border border-white/15 px-4 py-2 text-sm hover:bg-white/10">{text.retry}</button>}
              </div>
            </section>
          </div>
        )}

        <footer className="mt-14 grid gap-3 border-t border-white/10 pt-6 text-xs leading-5 text-zinc-500 sm:grid-cols-2">
          <p>{text.privacy}</p><p>{text.publicChain}</p>
        </footer>
      </div>
    </main>
  );
}
