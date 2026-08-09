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
 * Last Modified: v2.2.0 - [USDT-TOPUP-BINDING 2026-08-09 by Codex]
 *   Bound browser recovery state to the exact one-time top-up code and added
 *   visible, masked evidence that the quote and address belong to that code.
 * Previous: v2.1.0 - [USDT-CAPABILITY-RECOVERY 2026-08-09 by Codex]
 *   Added fragment capability transport, grace-window recovery, complete
 *   terminal/review states, and capability-safe session restoration.
 * Previous: v2.0.0 - [USDT-PAYMENTS 2026-08-07 by Codex] Three-chain checkout.
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
  PaymentStatus,
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
  verifiedCheckout: string;
  checkoutReference: string;
  addressBound: string;
  choosePlan: string;
  chooseNetwork: string;
  network: string;
  monthly: string;
  yearly: string;
  days: string;
  continue: string;
  preparing: string;
  unavailable: string;
  paymentsOffline: string;
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
  underpaid: string;
  overpaid: string;
  wrongAsset: string;
  failed: string;
  cancelled: string;
  recovery: string;
  recoveryNote: string;
  hintBound: string;
  reviewNote: string;
  support: string;
  txHint: string;
  txPlaceholder: string;
  submit: string;
  submitting: string;
  explorer: string;
  retry: string;
  missingCode: string;
  openFromDashboard: string;
  privacy: string;
  publicChain: string;
  bscNotice: string;
  exactWarning: string;
  clipboardError: string;
};

const en: Copy = {
  membership: 'AeroNyx Membership',
  title: 'Membership with USDT',
  lede: 'Choose a plan and pay on the network you already use. AeroNyx activates membership only after independent on-chain verification.',
  account: 'Code-bound checkout', verifiedCheckout: 'One-time top-up code verified',
  checkoutReference: 'Top-up reference',
  addressBound: 'This network, exact amount, and receiving address are locked to this one-time top-up.',
  choosePlan: 'Choose membership',
  chooseNetwork: 'Choose payment network', network: 'Network',
  monthly: 'Monthly', yearly: 'Yearly', days: 'days', continue: 'Create payment',
  preparing: 'Preparing secure payment…', unavailable: 'Temporarily unavailable',
  paymentsOffline: 'USDT checkout is not accepting transfers yet. No receiving address will be shown until operations enables a verified network.',
  exactAmount: 'Exact amount', receivingAddress: 'Receiving address',
  networkFee: 'Network fee requires', expires: 'Payment window', copy: 'Copy', copied: 'Copied',
  scan: 'Scan the receiving address', status: 'Payment status', awaiting: 'Waiting for transfer',
  detected: 'Transfer detected', confirming: 'Confirming on-chain', fulfilled: 'Membership activated',
  expired: 'Payment window expired', review: 'Payment needs review',
  underpaid: 'Amount received is below the quote', overpaid: 'Amount received exceeds the quote',
  wrongAsset: 'Wrong asset or network detected', failed: 'Verification failed', cancelled: 'Payment cancelled',
  recovery: 'Verifying an on-time transfer',
  recoveryNote: 'The payment window has closed, but AeroNyx is still checking for a transfer broadcast before expiry.',
  hintBound: 'Transaction attached. Independent on-chain verification continues.',
  reviewNote: 'Do not send another transfer. Contact support with the transaction hash so the existing transfer can be reviewed safely.',
  support: 'Contact support', txHint: 'Already sent?',
  txPlaceholder: 'Paste transaction hash to speed up detection', submit: 'Check transaction',
  submitting: 'Checking…', explorer: 'View transaction', retry: 'Start again',
  missingCode: 'A checkout code is required.',
  openFromDashboard: 'Open this page from the Nodeboard membership dashboard so the private top-up code is included.',
  privacy: 'This page transmits only a random membership code, never your AeroNyx wallet, chat identity, Privacy Network activity, or private memory.',
  publicChain: 'Blockchain transfers remain public and may reveal the sending wallet.',
  bscNotice: 'BNB Smart Chain accepts Binance-Peg BSC-USD, not native Tether-issued USDT.',
  exactWarning: 'Send the exact amount on the selected network. Wrong-network transfers cannot be recovered automatically.',
  clipboardError: 'Clipboard access is unavailable.',
};

const copyByLocale: Record<Locale, Copy> = {
  en,
  'zh-CN': {
    ...en, membership: 'AeroNyx 会员', title: '使用 USDT 购买会员', lede: '选择会员套餐和你常用的支付网络。只有独立完成链上验证后，AeroNyx 才会激活会员。',
    account: '充值码绑定结账', verifiedCheckout: '一次性充值码已验证', checkoutReference: '充值参考码', addressBound: '当前网络、精确金额和收款地址已与本次一次性充值绑定。', choosePlan: '选择会员', chooseNetwork: '选择支付网络', network: '网络', monthly: '月付', yearly: '年付', days: '天',
    continue: '创建支付订单', preparing: '正在准备安全支付…', unavailable: '暂时不可用', paymentsOffline: 'USDT 结账尚未开始接收转账。运营方启用已验证网络之前，本页面不会显示收款地址。', exactAmount: '精确支付金额', receivingAddress: '收款地址',
    networkFee: '网络手续费需要', expires: '支付剩余时间', copy: '复制', copied: '已复制', scan: '扫描收款地址', status: '支付状态',
    awaiting: '等待转账', detected: '已检测到转账', confirming: '正在等待链上确认', fulfilled: '会员已激活', expired: '支付订单已过期', review: '支付需要人工审核', underpaid: '到账金额低于报价', overpaid: '到账金额高于报价', wrongAsset: '检测到错误资产或网络', failed: '验证失败', cancelled: '支付已取消', recovery: '正在验证按时发出的转账', recoveryNote: '支付窗口已关闭，但 AeroNyx 仍在检查是否存在到期前广播的转账。', hintBound: '交易已关联，独立链上验证仍在继续。', reviewNote: '请勿再次转账。请携带交易哈希联系支持，以安全审核现有转账。', support: '联系支持',
    txHint: '已经转账？', txPlaceholder: '粘贴交易哈希可以加快检测', submit: '检查交易', submitting: '检查中…', explorer: '查看链上交易', retry: '重新创建',
    missingCode: '缺少充值码。', openFromDashboard: '请从 Nodeboard 会员页面进入，以携带私密的一次性充值码。',
    privacy: '此页面只传输随机会员码，不会传输你的 AeroNyx 钱包、聊天身份、隐私网络活动或私人记忆。',
    publicChain: '链上转账记录是公开的，可能显示付款钱包地址。', bscNotice: 'BNB Smart Chain 接收 Binance-Peg BSC-USD，并非 Tether 原生发行的 USDT。',
    exactWarning: '请在所选网络发送精确金额。转错网络的资产无法自动找回。', clipboardError: '无法访问剪贴板。',
  },
  'zh-TW': {
    ...en, membership: 'AeroNyx 會員', title: '使用 USDT 購買會員', lede: '選擇會員方案和你常用的支付網路。只有獨立完成鏈上驗證後，AeroNyx 才會啟用會員。',
    account: '充值碼綁定結帳', verifiedCheckout: '一次性充值碼已驗證', checkoutReference: '充值參考碼', addressBound: '目前網路、精確金額和收款地址已與本次一次性充值綁定。', choosePlan: '選擇會員', chooseNetwork: '選擇支付網路', network: '網路', monthly: '月付', yearly: '年付', days: '天',
    continue: '建立支付訂單', preparing: '正在準備安全支付…', unavailable: '暫時不可用', paymentsOffline: 'USDT 結帳尚未開始接收轉帳。營運方啟用已驗證網路之前，本頁面不會顯示收款地址。', exactAmount: '精確支付金額', receivingAddress: '收款地址',
    networkFee: '網路手續費需要', expires: '支付剩餘時間', copy: '複製', copied: '已複製', scan: '掃描收款地址', status: '支付狀態',
    awaiting: '等待轉帳', detected: '已偵測到轉帳', confirming: '正在等待鏈上確認', fulfilled: '會員已啟用', expired: '支付訂單已過期', review: '支付需要人工審核', underpaid: '到帳金額低於報價', overpaid: '到帳金額高於報價', wrongAsset: '偵測到錯誤資產或網路', failed: '驗證失敗', cancelled: '支付已取消', recovery: '正在驗證按時送出的轉帳', recoveryNote: '支付視窗已關閉，但 AeroNyx 仍在檢查是否存在到期前廣播的轉帳。', hintBound: '交易已關聯，獨立鏈上驗證仍在繼續。', reviewNote: '請勿再次轉帳。請攜帶交易雜湊聯絡支援，以安全審核現有轉帳。', support: '聯絡支援',
    txHint: '已經轉帳？', txPlaceholder: '貼上交易雜湊可以加快偵測', submit: '檢查交易', submitting: '檢查中…', explorer: '查看鏈上交易', retry: '重新建立',
    missingCode: '缺少充值碼。', openFromDashboard: '請從 Nodeboard 會員頁面進入，以攜帶私密的一次性充值碼。',
    privacy: '此頁面只傳輸隨機會員碼，不會傳輸你的 AeroNyx 錢包、聊天身分、隱私網路活動或私人記憶。',
    publicChain: '鏈上轉帳記錄是公開的，可能顯示付款錢包地址。', bscNotice: 'BNB Smart Chain 接收 Binance-Peg BSC-USD，並非 Tether 原生發行的 USDT。',
    exactWarning: '請在所選網路傳送精確金額。轉錯網路的資產無法自動找回。', clipboardError: '無法存取剪貼簿。',
  },
  ja: {
    ...en, membership: 'AeroNyx メンバーシップ', title: 'USDTでメンバーシップを購入', lede: 'プランと利用するネットワークを選択してください。独立したオンチェーン検証後にのみ有効化されます。',
    account: 'コード連携決済', verifiedCheckout: '一回限りのチャージコードを確認済み', checkoutReference: 'チャージ参照コード', addressBound: 'ネットワーク、正確な金額、受取アドレスはこの一回限りのチャージに固定されています。', choosePlan: 'プランを選択', chooseNetwork: '支払いネットワーク', network: 'ネットワーク', monthly: '月額', yearly: '年額', days: '日', continue: '支払いを作成',
    preparing: '安全な支払いを準備中…', unavailable: '一時利用不可', paymentsOffline: 'USDT決済はまだ送金を受け付けていません。検証済みネットワークが有効になるまで受取アドレスは表示されません。', exactAmount: '正確な金額', receivingAddress: '受取アドレス', networkFee: '手数料に必要',
    expires: '残り時間', copy: 'コピー', copied: 'コピー済み', scan: '受取アドレスをスキャン', status: '支払い状況', awaiting: '送金を待っています',
    detected: '送金を検出しました', confirming: 'オンチェーン確認中', fulfilled: 'メンバーシップ有効', expired: '支払い期限切れ', review: '確認が必要です', underpaid: '受取額が見積額を下回っています', overpaid: '受取額が見積額を上回っています', wrongAsset: '誤った資産またはネットワークです', failed: '検証に失敗しました', cancelled: '支払いはキャンセルされました', recovery: '期限内送金を検証中', recoveryNote: '支払い期限後も、期限前に送信された取引を確認しています。', hintBound: '取引を関連付けました。独立したオンチェーン検証を継続します。', reviewNote: '再送金せず、トランザクションハッシュを添えてサポートへご連絡ください。', support: 'サポートに連絡',
    txHint: '送金済みですか？', txPlaceholder: 'トランザクションハッシュを入力', submit: '取引を確認', submitting: '確認中…', explorer: '取引を表示', retry: 'やり直す',
    missingCode: 'チャージコードが必要です。', openFromDashboard: 'Nodeboardのメンバーシップ画面から開き、一回限りのチャージコードを引き継いでください。',
    privacy: 'このページはランダムな会員コードのみを送信し、ウォレット、チャット、プライバシーネットワークの活動、個人メモリは送信しません。', publicChain: 'ブロックチェーン上の送金は公開され、送信元ウォレットが表示される場合があります。',
    bscNotice: 'BNB Smart ChainではTetherネイティブUSDTではなくBinance-Peg BSC-USDを受け付けます。', exactWarning: '選択したネットワークで正確な金額を送ってください。誤送金は自動復旧できません。', clipboardError: 'クリップボードを利用できません。',
  },
  ko: {
    ...en, membership: 'AeroNyx 멤버십', title: 'USDT로 멤버십 구매', lede: '요금제와 결제 네트워크를 선택하세요. 독립적인 온체인 검증 후에만 멤버십이 활성화됩니다.',
    account: '충전 코드 연결 결제', verifiedCheckout: '일회용 충전 코드 확인됨', checkoutReference: '충전 참조 코드', addressBound: '네트워크, 정확한 금액, 수신 주소가 이 일회용 충전에 고정되었습니다.', choosePlan: '멤버십 선택', chooseNetwork: '결제 네트워크 선택', network: '네트워크', monthly: '월간', yearly: '연간', days: '일', continue: '결제 만들기',
    preparing: '안전한 결제 준비 중…', unavailable: '일시적으로 사용할 수 없음', paymentsOffline: 'USDT 결제는 아직 송금을 받지 않습니다. 검증된 네트워크가 활성화될 때까지 수신 주소가 표시되지 않습니다.', exactAmount: '정확한 금액', receivingAddress: '수신 주소', networkFee: '네트워크 수수료',
    expires: '남은 시간', copy: '복사', copied: '복사됨', scan: '수신 주소 스캔', status: '결제 상태', awaiting: '송금 대기 중', detected: '송금 감지됨',
    confirming: '온체인 확인 중', fulfilled: '멤버십 활성화됨', expired: '결제 시간 만료', review: '검토가 필요합니다', underpaid: '입금액이 견적보다 적습니다', overpaid: '입금액이 견적보다 많습니다', wrongAsset: '잘못된 자산 또는 네트워크입니다', failed: '검증 실패', cancelled: '결제 취소됨', recovery: '기한 내 송금 확인 중', recoveryNote: '결제 시간이 끝났지만 만료 전에 전송된 거래를 계속 확인하고 있습니다.', hintBound: '거래가 연결되었습니다. 독립적인 온체인 검증을 계속합니다.', reviewNote: '다시 송금하지 말고 거래 해시와 함께 지원팀에 문의하세요.', support: '지원팀 문의', txHint: '이미 보냈나요?',
    txPlaceholder: '트랜잭션 해시를 입력하세요', submit: '거래 확인', submitting: '확인 중…', explorer: '거래 보기', retry: '다시 시작', missingCode: '결제 코드가 필요합니다.',
    openFromDashboard: '일회용 충전 코드가 포함되도록 Nodeboard 멤버십 화면에서 열어 주세요.', privacy: '이 페이지는 무작위 멤버십 코드만 전송하며 지갑, 채팅 ID, 프라이버시 네트워크 활동, 개인 메모리는 전송하지 않습니다.',
    publicChain: '블록체인 송금은 공개되며 보내는 지갑이 표시될 수 있습니다.', bscNotice: 'BNB Smart Chain에서는 Tether 네이티브 USDT가 아닌 Binance-Peg BSC-USD를 받습니다.',
    exactWarning: '선택한 네트워크에서 정확한 금액을 보내세요. 잘못된 네트워크 송금은 자동 복구되지 않습니다.', clipboardError: '클립보드를 사용할 수 없습니다.',
  },
  ru: {
    ...en, membership: 'Подписка AeroNyx', title: 'Оплата подписки в USDT', lede: 'Выберите тариф и сеть. Подписка активируется только после независимой проверки транзакции в блокчейне.',
    account: 'Оплата по коду', verifiedCheckout: 'Одноразовый код пополнения подтверждён', checkoutReference: 'Код пополнения', addressBound: 'Сеть, точная сумма и адрес получателя закреплены за этим одноразовым пополнением.', choosePlan: 'Выберите подписку', chooseNetwork: 'Выберите сеть', network: 'Сеть', monthly: 'Ежемесячно', yearly: 'Ежегодно', days: 'дней', continue: 'Создать платёж',
    preparing: 'Подготовка безопасного платежа…', unavailable: 'Временно недоступно', paymentsOffline: 'Оплата USDT пока не принимает переводы. Адрес не будет показан до включения проверенной сети.', exactAmount: 'Точная сумма', receivingAddress: 'Адрес получателя', networkFee: 'Комиссия оплачивается в',
    expires: 'Осталось времени', copy: 'Копировать', copied: 'Скопировано', scan: 'Отсканируйте адрес', status: 'Статус платежа', awaiting: 'Ожидание перевода',
    detected: 'Перевод обнаружен', confirming: 'Подтверждение в сети', fulfilled: 'Подписка активирована', expired: 'Время оплаты истекло', review: 'Требуется проверка', underpaid: 'Получено меньше расчётной суммы', overpaid: 'Получено больше расчётной суммы', wrongAsset: 'Неверный актив или сеть', failed: 'Проверка не пройдена', cancelled: 'Платёж отменён', recovery: 'Проверка своевременного перевода', recoveryNote: 'Окно оплаты закрыто, но AeroNyx продолжает искать перевод, отправленный до истечения срока.', hintBound: 'Транзакция привязана. Независимая проверка продолжается.', reviewNote: 'Не отправляйте повторный перевод. Свяжитесь с поддержкой и укажите хэш транзакции.', support: 'Связаться с поддержкой',
    txHint: 'Уже отправили?', txPlaceholder: 'Вставьте хэш транзакции', submit: 'Проверить', submitting: 'Проверка…', explorer: 'Открыть транзакцию', retry: 'Начать заново',
    missingCode: 'Нужен код пополнения.', openFromDashboard: 'Откройте страницу из раздела подписки Nodeboard, чтобы передать одноразовый код пополнения.',
    privacy: 'Эта страница передаёт только случайный код подписки, но не кошелёк AeroNyx, чаты, активность в Privacy Network или приватную память.', publicChain: 'Переводы в блокчейне публичны и могут раскрывать адрес отправителя.',
    bscNotice: 'В BNB Smart Chain принимается Binance-Peg BSC-USD, а не нативный USDT от Tether.', exactWarning: 'Отправьте точную сумму в выбранной сети. Ошибочный перевод нельзя восстановить автоматически.', clipboardError: 'Буфер обмена недоступен.',
  },
};

const ACTIVE_STATUSES = new Set<PaymentStatus>([
  'created', 'awaiting_payment', 'detected', 'confirming', 'paid',
]);
const REVIEW_STATUSES = new Set<PaymentStatus>([
  'underpaid', 'overpaid', 'wrong_asset', 'needs_review',
]);
const PAYMENT_SESSION_KEY = 'aeronyx.membership.payment.current';
const CHECKOUT_CODE_PATTERN = /^(?:TOP-)?NYX-[A-Z0-9-]{8,40}$/;

function canRecover(payment: CryptoPayment, now = Date.now()) {
  return payment.status === 'expired'
    && payment.can_still_recover
    && new Date(payment.recovery_until).getTime() > now;
}

function shouldPoll(payment: CryptoPayment) {
  return ACTIVE_STATUSES.has(payment.status) || canRecover(payment);
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

function maskedCheckoutCode(code: string) {
  const suffix = code.slice(-6);
  return `${code.startsWith('TOP-') ? 'TOP-' : ''}••••-${suffix}`;
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
    // [USDT-CAPABILITY-RECOVERY 2026-08-09 by Codex] Fragments never reach
    // the web server. Query support remains only to upgrade old links in place.
    const url = new URL(window.location.href);
    const fragmentCode = new URLSearchParams(url.hash.replace(/^#/, '')).get('code');
    const queryCode = url.searchParams.get('code');
    const raw = fragmentCode || queryCode || '';
    const normalized = raw.trim().toUpperCase();
    if (!CHECKOUT_CODE_PATTERN.test(normalized)) {
      setLoading(false);
      return;
    }
    if (!fragmentCode && queryCode) {
      url.searchParams.delete('code');
      url.hash = `code=${encodeURIComponent(normalized)}`;
      window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
    }
    setCode(normalized);
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
        // [USDT-TOPUP-BINDING 2026-08-09 by Codex] Clear any rendered intent
        // before restoring. A payment token is valid only with the exact code
        // that created it, even when another checkout opens in the same tab.
        setPayment(null);
        setClientToken('');
        setCheckout(summary);
        setSelectedPlan(summary.plans[0]?.id || '');
        setSelectedNetwork(summary.networks.find((item) => item.available)?.id || '');
        const saved = window.sessionStorage.getItem(PAYMENT_SESSION_KEY);
        if (saved) {
          let parsed: { code?: string; id?: string; token?: string } = {};
          try {
            parsed = JSON.parse(saved) as typeof parsed;
          } catch {
            // Corrupt or legacy browser state must never block a new checkout.
            window.sessionStorage.removeItem(PAYMENT_SESSION_KEY);
          }
          if (parsed.code === code && parsed.id && parsed.token) {
            setClientToken(parsed.token);
            try {
              await refreshPayment(parsed.id, parsed.token, code);
            } catch {
              window.sessionStorage.removeItem(PAYMENT_SESSION_KEY);
              setClientToken('');
            }
          } else window.sessionStorage.removeItem(PAYMENT_SESSION_KEY);
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
    if (!payment || !clientToken || !code || !shouldPoll(payment)) return;
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
        PAYMENT_SESSION_KEY,
        JSON.stringify({ code, id: result.payment.id, token: result.clientToken }),
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
    } catch { setError(text.clipboardError); }
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

  function restartCheckout() {
    window.sessionStorage.removeItem(PAYMENT_SESSION_KEY);
    if (checkout?.code_type === 'one_time') {
      // A consumed one-time capability cannot safely create another intent.
      // Return to the authenticated/App source so it can issue a fresh link.
      if (window.history.length > 1) window.history.back();
      else window.location.assign('/dashboard');
      return;
    }
    setPayment(null); setClientToken(''); setTxHash(''); setError('');
  }

  const paymentRecoverable = payment ? canRecover(payment, now) : false;
  const statusLabel = !payment ? ''
    : payment.status === 'fulfilled' ? text.fulfilled
      : payment.status === 'detected' ? text.detected
        : payment.status === 'confirming' || payment.status === 'paid' ? text.confirming
          : payment.status === 'expired' ? (paymentRecoverable ? text.recovery : text.expired)
            : payment.status === 'underpaid' ? text.underpaid
              : payment.status === 'overpaid' ? text.overpaid
                : payment.status === 'wrong_asset' ? text.wrongAsset
                  : payment.status === 'needs_review' ? text.review
                    : payment.status === 'failed' ? text.failed
                      : payment.status === 'cancelled' ? text.cancelled
                        : text.awaiting;
  const statusNote = !payment ? ''
    : paymentRecoverable ? text.recoveryNote
      : REVIEW_STATUSES.has(payment.status) ? text.reviewNote
        : '';
  const acceptsTransactionHint = payment
    ? (ACTIVE_STATUSES.has(payment.status) || paymentRecoverable)
      && !payment.transaction_hint_bound
    : false;
  const statusBadgeClass = payment?.status === 'fulfilled'
    ? 'bg-emerald-400/15 text-emerald-300'
    : payment && (REVIEW_STATUSES.has(payment.status) || paymentRecoverable)
      ? 'bg-amber-400/15 text-amber-200'
      : payment && ['expired', 'failed', 'cancelled'].includes(payment.status)
        ? 'bg-red-400/15 text-red-300'
        : 'bg-sky-400/15 text-sky-200';

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
            <p className="mt-2 leading-6 text-zinc-400">{text.openFromDashboard}</p>
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
                  <span className="text-xs text-emerald-300">{text.verifiedCheckout}</span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {checkout.plans.map((plan) => {
                    const active = selectedPlan === plan.id;
                    return (
                      <button key={plan.id} onClick={() => setSelectedPlan(plan.id)} aria-pressed={active}
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
                      <button key={network.id} disabled={!network.available} onClick={() => setSelectedNetwork(network.id)} aria-pressed={active}
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
              <div className="mt-2 flex items-center gap-2 text-sm text-emerald-300">
                <span aria-hidden="true" className="h-2 w-2 rounded-full bg-emerald-400" />
                {text.verifiedCheckout}
              </div>
              <div className="mt-5 flex items-center justify-between gap-4 text-xs">
                <span className="text-zinc-500">{text.checkoutReference}</span>
                <code className="text-zinc-300">{maskedCheckoutCode(code)}</code>
              </div>
              <div className="my-6 h-px bg-white/10" />
              <div className="flex justify-between text-sm"><span className="text-zinc-400">{selectedPlanData?.tier || '—'}</span><span>{selectedPlanData ? `$${selectedPlanData.amount_usd}` : '—'}</span></div>
              <div className="mt-3 flex justify-between text-sm"><span className="text-zinc-400">{text.network}</span><span>{selectedNetworkData?.display_name || '—'}</span></div>
              <button onClick={startPayment} disabled={!checkout.payment_enabled || !selectedPlan || !selectedNetwork || creating}
                className="mt-6 h-12 w-full rounded-lg bg-white px-4 font-semibold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500">
                {creating ? text.preparing : checkout.payment_enabled ? text.continue : text.unavailable}
              </button>
              {!checkout.payment_enabled && (
                <p className="mt-3 text-xs leading-5 text-zinc-500">{text.paymentsOffline}</p>
              )}
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
              <div aria-live="polite" className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 pb-5">
                <div>
                  <div className="text-xs uppercase tracking-[0.16em] text-zinc-500">{text.status}</div>
                  <h2 className="mt-2 text-xl font-semibold">{statusLabel}</h2>
                  {statusNote && <p className="mt-2 max-w-xl text-sm leading-6 text-zinc-400">{statusNote}</p>}
                </div>
                <div className={`rounded-full px-3 py-1 text-xs ${statusBadgeClass}`}>
                  {payment.confirmations}/{payment.required_confirmations}
                </div>
              </div>

              <div className="grid gap-6 py-6 sm:grid-cols-2">
                <div><div className="text-xs text-zinc-500">{text.exactAmount}</div><button onClick={() => copyValue('amount', payment.quoted_amount)} className="mt-2 flex max-w-full items-baseline gap-2 text-left"><span className="break-all text-3xl font-semibold tabular-nums">{payment.quoted_amount}</span><span className="text-zinc-400">USDT</span><span className="text-xs text-emerald-300">{copied === 'amount' ? text.copied : text.copy}</span></button></div>
                <div><div className="text-xs text-zinc-500">{paymentRecoverable ? text.recovery : text.expires}</div><div className="mt-2 text-3xl font-semibold tabular-nums">{formatCountdown(paymentRecoverable ? payment.recovery_until : payment.expires_at, now)}</div><div className="mt-1 text-xs text-zinc-500">{payment.network_name} · {text.networkFee} {payment.gas_symbol}</div></div>
              </div>

              <div className="border-t border-white/10 py-5">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500">
                  <span>{text.receivingAddress}</span>
                  <code>{maskedCheckoutCode(code)}</code>
                </div>
                <button onClick={() => copyValue('address', payment.recipient_address)} className="mt-2 flex w-full items-center gap-3 rounded-lg border border-white/10 bg-black/30 p-3 text-left">
                  <code className="min-w-0 flex-1 break-all text-xs leading-5 text-zinc-200">{payment.recipient_address}</code><span className="shrink-0 text-xs text-emerald-300">{copied === 'address' ? text.copied : text.copy}</span>
                </button>
                <p className="mt-2 text-xs leading-5 text-zinc-500">{text.addressBound}</p>
              </div>

              <p className="rounded-lg border border-amber-300/20 bg-amber-300/[0.06] p-3 text-xs leading-5 text-amber-100/80">{text.exactWarning}</p>
              {payment.network === 'bsc' && <p className="mt-3 text-xs leading-5 text-zinc-500">{text.bscNotice}</p>}

              {acceptsTransactionHint && (
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

              {payment.transaction_hint_bound && (
                <p className="mt-5 rounded-lg border border-sky-300/20 bg-sky-300/[0.06] p-3 text-xs leading-5 text-sky-100/80">{text.hintBound}</p>
              )}

              <div className="mt-6 flex flex-wrap gap-3">
                {payment.explorer_url && <a href={payment.explorer_url} target="_blank" rel="noreferrer" className="rounded-lg border border-white/15 px-4 py-2 text-sm hover:bg-white/10">{text.explorer}</a>}
                {REVIEW_STATUSES.has(payment.status) && <a href="mailto:hi@aeronyx.network" className="rounded-lg border border-amber-300/25 px-4 py-2 text-sm text-amber-100 hover:bg-amber-300/10">{text.support}</a>}
                {((payment.status === 'expired' && !paymentRecoverable) || payment.status === 'failed' || payment.status === 'cancelled') && <button onClick={restartCheckout} className="rounded-lg border border-white/15 px-4 py-2 text-sm hover:bg-white/10">{text.retry}</button>}
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
