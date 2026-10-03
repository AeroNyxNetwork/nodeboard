/**
 * ============================================
 * File: app/topup/page.tsx
 * ============================================
 * Creation Reason:
 *   Provide a privacy-preserving AeroNyx points checkout for Solana, BNB Smart
 *   Chain, Ethereum, and TRON without putting payment handling inside the App.
 * Main Functionality:
 *   1. Accept a public membership code or validate an app-issued top-up code.
 *   2. Select a fixed points bundle and payment network.
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
 *   detected -> confirming -> points credited.
 *
 * Important Note for Next Developer:
 *   Never animate fake payment progress or infer paid state in the browser.
 *   Only backend status=fulfilled may render the success state.
 *
 * Last Modified: v3.1.0 - [USDT-CHECKOUT-OFFER-BINDING 2026-08-25 by Codex]
 *   Render app-issued one-time checkouts as a fixed points reservation and
 *   fail closed if checkout metadata no longer contains exactly that offer.
 * Previous: v3.0.0 - [MEMBERSHIP-POINTS-FIRST 2026-08-24 by Codex]
 *   Made the page independently usable with a membership-code entry, changed
 *   every checkout state from direct membership activation to points credit,
 *   and exposed the fixed 1 USDT = 100 points product contract.
 * Previous: v2.4.0 - [USDT-CHECKOUT-SESSION 2026-08-13 by Codex]
 *   Reused the shared recovery-session boundary and added an explicit,
 *   capability-clearing return action after membership activation.
 * Previous: v2.3.0 - [USDT-CHECKOUT-LIFECYCLE 2026-08-13 by Codex]
 *   Prevented duplicate-payment cues after detection, preserved recoverable
 *   sessions across transient failures, and added resilient status controls.
 * Previous: v2.2.0 - [USDT-TOPUP-BINDING 2026-08-09 by Codex]
 *   Bound browser recovery state to the exact one-time top-up code and added
 *   visible, masked evidence that the quote and address belong to that code.
 * Previous: v2.1.0 - [USDT-CAPABILITY-RECOVERY 2026-08-09 by Codex]
 *   Added fragment capability transport, grace-window recovery, complete
 *   terminal/review states, and capability-safe session restoration.
 * Previous: v2.0.0 - [USDT-PAYMENTS 2026-08-07 by Codex] Three-chain checkout.
 * ============================================
 */
'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import QRCode from 'qrcode';

import LanguageSelector from '@/components/common/LanguageSelector';
import Logo from '@/components/common/Logo';
import NetworkMark from '@/components/common/NetworkMark';
import { LOCALE_STORAGE_KEY, Locale } from '@/lib/i18n';
import { useI18n } from '@/lib/i18n/I18nProvider';
import {
  CheckoutSummary,
  CryptoPayment,
  MembershipPaymentApiError,
  PaymentNetworkId,
  PaymentStatus,
  canSubmitPaymentTransactionHint,
  clearMembershipPaymentSession,
  createPaymentIntent,
  isPaymentRecoverable,
  isPaymentRecoveryCredentialRejected,
  isPaymentTransferOpen,
  loadCheckout,
  loadPaymentStatus,
  normalizeMembershipCheckoutCode,
  paymentLifecyclePhase,
  readMembershipPaymentSession,
  shouldPollPayment,
  submitTransactionHint,
  writeMembershipPaymentSession,
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
  stepTransfer: string;
  stepVerify: string;
  stepActivate: string;
  transferClosed: string;
  transferClosedNote: string;
  paymentCompleteNote: string;
  reviewTransferNote: string;
  instructionsClosedNote: string;
  confirmations: string;
  refreshDelayed: string;
  refreshNow: string;
  refreshing: string;
  restoreFailed: string;
  restoreFailedNote: string;
  backToDashboard: string;
  returnToAeroNyx: string;
  continueOnWeb: string;
  paymentSummary: string;
  rate: string;
  points: string;
  pointsUse: string;
  enterCode: string;
  codePlaceholder: string;
  continueWithCode: string;
  invalidCode: string;
  reservedBundle: string;
  reservedBundleNote: string;
  offerMismatch: string;
  // [TOPUP-POLISH 2026-10-03 by Claude]
  creditsTo: string;
  redeemsFor: string;
  tierPremium: string;
  tierUltimate: string;
  ethNotice: string;
  networkTip: string;
  openInWallet: string;
  openInWalletNote: string;
};

const en: Copy = {
  membership: 'AeroNyx Points',
  title: 'Buy points with USDT',
  lede: 'Pick a bundle and the network your USDT is on, send from any wallet or exchange, and the points arrive on their own once the transfer confirms.',
  account: 'Code-bound checkout', verifiedCheckout: 'One-time top-up code verified',
  checkoutReference: 'Top-up reference',
  addressBound: 'This network, exact amount, and receiving address are locked to this one-time top-up.',
  choosePlan: 'Choose points',
  chooseNetwork: 'Choose payment network', network: 'Network',
  monthly: 'Monthly', yearly: 'Yearly', days: 'days', continue: 'Create payment',
  preparing: 'Preparing secure payment…', unavailable: 'Temporarily unavailable',
  paymentsOffline: 'USDT checkout is not accepting transfers yet. No receiving address will be shown until operations enables a verified network.',
  exactAmount: 'Exact amount', receivingAddress: 'Receiving address',
  networkFee: 'Network fee requires', expires: 'Payment window', copy: 'Copy', copied: 'Copied',
  scan: 'Scan the receiving address', status: 'Payment status', awaiting: 'Waiting for transfer',
  detected: 'Transfer detected', confirming: 'Confirming on-chain', fulfilled: 'Points credited',
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
  openFromDashboard: 'Enter the membership code shown in AeroNyx Wallet. Anyone with the code can add points, but cannot view or spend them.',
  privacy: 'This page transmits only an AeroNyx membership code, never your wallet keys, chat identity, Privacy Network activity, or private memory.',
  publicChain: 'Blockchain transfers remain public and may reveal the sending wallet.',
  bscNotice: 'BNB Smart Chain accepts Binance-Peg BSC-USD, not native Tether-issued USDT.',
  exactWarning: 'Send the exact amount on the selected network. Wrong-network transfers cannot be recovered automatically.',
  clipboardError: 'Clipboard access is unavailable.',
  stepTransfer: 'Transfer', stepVerify: 'Verify', stepActivate: 'Credit',
  transferClosed: 'Do not send another transfer',
  transferClosedNote: 'The receiving instructions are locked while AeroNyx verifies this payment.',
  paymentCompleteNote: 'The points are now available in AeroNyx. The account owner can transfer them to a friend or redeem a membership.',
  reviewTransferNote: 'The existing transfer is being reviewed. Do not send another payment for this order.',
  instructionsClosedNote: 'This payment order no longer accepts transfers. Start a new points purchase if needed.',
  confirmations: 'On-chain confirmations',
  refreshDelayed: 'Live status is temporarily delayed. Your payment session remains safe.',
  refreshNow: 'Refresh status', refreshing: 'Refreshing…',
  restoreFailed: 'Payment status is temporarily unavailable',
  restoreFailedNote: 'AeroNyx kept this payment session on this device. Retry without creating another transfer.',
  backToDashboard: 'Done', returnToAeroNyx: 'Return to AeroNyx', continueOnWeb: 'Continue on web', paymentSummary: 'Payment summary',
  rate: '1 USDT = 100 points', points: 'points',
  pointsUse: 'Use points in AeroNyx to transfer to a friend or redeem membership.',
  enterCode: 'Which AeroNyx account should receive the points?',
  codePlaceholder: 'NYX-XXXX-XXXX', continueWithCode: 'Continue',
  invalidCode: 'Enter a valid AeroNyx membership code.',
  reservedBundle: 'Reserved points bundle',
  reservedBundleNote: 'AeroNyx created this one-time checkout for this exact bundle. The amount cannot be changed here.',
  offerMismatch: 'This checkout no longer matches its original points bundle. Return to AeroNyx and start again.',
  creditsTo: 'Points go to',
  redeemsFor: 'Enough for {plan}',
  tierPremium: 'Premium',
  tierUltimate: 'Ultimate',
  ethNotice: 'Ethereum network fees are usually much higher. Sending on TRON or Solana costs less.',
  networkTip: 'Choose the network your USDT is on. Withdrawing from an exchange? Pick the same network there.',
  openInWallet: 'Open in wallet app',
  openInWalletNote: 'Fills in the address and exact amount in Phantom, Solflare or another Solana wallet.',
};

const copyByLocale: Record<Locale, Copy> = {
  en,
  'zh-CN': {
    ...en, networkTip: '选你的 USDT 所在的网络。从交易所提币时，也要在交易所选同一个网络。', openInWallet: '用钱包 App 打开', openInWalletNote: '在 Phantom、Solflare 等 Solana 钱包中自动填好地址和精确金额。',
    creditsTo: '积分存入', redeemsFor: '够兑换{plan}', tierPremium: '高级', tierUltimate: '旗舰', ethNotice: '以太坊网络手续费通常高很多，用 TRON 或 Solana 转账更省。',
    membership: 'AeroNyx 积分', title: '使用 USDT 购买积分', lede: '选好积分包和你的 USDT 所在网络，从任何钱包或交易所转账，链上确认后积分自动到账。',
    account: '账户绑定结账', verifiedCheckout: '收款账户已验证', checkoutReference: '充值参考码', addressBound: '当前网络、精确金额和收款地址已与本次积分充值绑定。', choosePlan: '选择积分', chooseNetwork: '选择支付网络', network: '网络', monthly: '月付', yearly: '年付', days: '天',
    continue: '创建支付订单', preparing: '正在准备安全支付…', unavailable: '暂时不可用', paymentsOffline: 'USDT 结账尚未开始接收转账。运营方启用已验证网络之前，本页面不会显示收款地址。', exactAmount: '精确支付金额', receivingAddress: '收款地址',
    networkFee: '网络手续费需要', expires: '支付剩余时间', copy: '复制', copied: '已复制', scan: '扫描收款地址', status: '支付状态',
    awaiting: '等待转账', detected: '已检测到转账', confirming: '正在等待链上确认', fulfilled: '积分已到账', expired: '支付订单已过期', review: '支付需要人工审核', underpaid: '到账金额低于报价', overpaid: '到账金额高于报价', wrongAsset: '检测到错误资产或网络', failed: '验证失败', cancelled: '支付已取消', recovery: '正在验证按时发出的转账', recoveryNote: '支付窗口已关闭，但 AeroNyx 仍在检查是否存在到期前广播的转账。', hintBound: '交易已关联，独立链上验证仍在继续。', reviewNote: '请勿再次转账。请携带交易哈希联系支持，以安全审核现有转账。', support: '联系支持',
    txHint: '已经转账？', txPlaceholder: '粘贴交易哈希可以加快检测', submit: '检查交易', submitting: '检查中…', explorer: '查看链上交易', retry: '重新创建',
    missingCode: '请输入会员码。', openFromDashboard: '请输入 AeroNyx 钱包中显示的会员码。任何人都可以用它为账户增加积分，但不能查看或使用积分。',
    privacy: '此页面只传输 AeroNyx 会员码，不会传输钱包密钥、聊天身份、隐私网络活动或私人记忆。',
    publicChain: '链上转账记录是公开的，可能显示付款钱包地址。', bscNotice: 'BNB Smart Chain 接收 Binance-Peg BSC-USD，并非 Tether 原生发行的 USDT。',
    exactWarning: '请在所选网络发送精确金额。转错网络的资产无法自动找回。', clipboardError: '无法访问剪贴板。',
    stepTransfer: '转账', stepVerify: '链上验证', stepActivate: '积分入账', transferClosed: '请勿再次转账', transferClosedNote: 'AeroNyx 正在验证本次支付，收款信息已锁定。', paymentCompleteNote: '积分已记入 AeroNyx。账户所有者可以转给朋友，或兑换会员。', reviewTransferNote: '现有转账正在人工审核，请勿为此订单再次付款。', instructionsClosedNote: '此支付订单已不再接收转账。如有需要，请重新购买积分。', confirmations: '链上确认数',
    refreshDelayed: '实时状态暂时延迟，你的支付会话仍安全保存在此设备。', refreshNow: '刷新状态', refreshing: '刷新中…', restoreFailed: '暂时无法读取支付状态', restoreFailedNote: 'AeroNyx 已在此设备保留支付会话。请重试，不要重新转账。', backToDashboard: '完成', returnToAeroNyx: '返回 AeroNyx', continueOnWeb: '留在网页', paymentSummary: '支付摘要',
    rate: '1 USDT = 100 积分', points: '积分', pointsUse: '积分可在 AeroNyx 内转给朋友，或兑换会员。', enterCode: '积分要充入哪个 AeroNyx 账户？', codePlaceholder: 'NYX-XXXX-XXXX', continueWithCode: '继续', invalidCode: '请输入有效的 AeroNyx 会员码。', reservedBundle: '已预留的积分包', reservedBundleNote: 'AeroNyx 已为本次一次性结账锁定这个积分包，无法在网页中更改金额。', offerMismatch: '本次结账与原始积分包不一致，请返回 AeroNyx 重新发起。',
  },
  'zh-TW': {
    ...en, networkTip: '選你的 USDT 所在的網路。從交易所提幣時，也要在交易所選同一個網路。', openInWallet: '用錢包 App 打開', openInWalletNote: '在 Phantom、Solflare 等 Solana 錢包中自動填好地址和精確金額。',
    creditsTo: '積分存入', redeemsFor: '夠兌換{plan}', tierPremium: '高級', tierUltimate: '旗艦', ethNotice: '以太坊網路手續費通常高很多，用 TRON 或 Solana 轉帳更省。',
    membership: 'AeroNyx 積分', title: '使用 USDT 購買積分', lede: '選好積分包和你的 USDT 所在網路，從任何錢包或交易所轉帳，鏈上確認後積分自動到帳。',
    account: '帳戶綁定結帳', verifiedCheckout: '收款帳戶已驗證', checkoutReference: '充值參考碼', addressBound: '目前網路、精確金額和收款地址已與本次積分充值綁定。', choosePlan: '選擇積分', chooseNetwork: '選擇支付網路', network: '網路', monthly: '月付', yearly: '年付', days: '天',
    continue: '建立支付訂單', preparing: '正在準備安全支付…', unavailable: '暫時不可用', paymentsOffline: 'USDT 結帳尚未開始接收轉帳。營運方啟用已驗證網路之前，本頁面不會顯示收款地址。', exactAmount: '精確支付金額', receivingAddress: '收款地址',
    networkFee: '網路手續費需要', expires: '支付剩餘時間', copy: '複製', copied: '已複製', scan: '掃描收款地址', status: '支付狀態',
    awaiting: '等待轉帳', detected: '已偵測到轉帳', confirming: '正在等待鏈上確認', fulfilled: '積分已到帳', expired: '支付訂單已過期', review: '支付需要人工審核', underpaid: '到帳金額低於報價', overpaid: '到帳金額高於報價', wrongAsset: '偵測到錯誤資產或網路', failed: '驗證失敗', cancelled: '支付已取消', recovery: '正在驗證按時送出的轉帳', recoveryNote: '支付視窗已關閉，但 AeroNyx 仍在檢查是否存在到期前廣播的轉帳。', hintBound: '交易已關聯，獨立鏈上驗證仍在繼續。', reviewNote: '請勿再次轉帳。請攜帶交易雜湊聯絡支援，以安全審核現有轉帳。', support: '聯絡支援',
    txHint: '已經轉帳？', txPlaceholder: '貼上交易雜湊可以加快偵測', submit: '檢查交易', submitting: '檢查中…', explorer: '查看鏈上交易', retry: '重新建立',
    missingCode: '請輸入會員碼。', openFromDashboard: '請輸入 AeroNyx 錢包中顯示的會員碼。任何人都可以用它為帳戶增加積分，但不能查看或使用積分。',
    privacy: '此頁面只傳輸 AeroNyx 會員碼，不會傳輸錢包密鑰、聊天身分、隱私網路活動或私人記憶。',
    publicChain: '鏈上轉帳記錄是公開的，可能顯示付款錢包地址。', bscNotice: 'BNB Smart Chain 接收 Binance-Peg BSC-USD，並非 Tether 原生發行的 USDT。',
    exactWarning: '請在所選網路傳送精確金額。轉錯網路的資產無法自動找回。', clipboardError: '無法存取剪貼簿。',
    stepTransfer: '轉帳', stepVerify: '鏈上驗證', stepActivate: '積分入帳', transferClosed: '請勿再次轉帳', transferClosedNote: 'AeroNyx 正在驗證本次支付，收款資訊已鎖定。', paymentCompleteNote: '積分已記入 AeroNyx。帳戶所有者可以轉給朋友，或兌換會員。', reviewTransferNote: '現有轉帳正在人工審核，請勿為此訂單再次付款。', instructionsClosedNote: '此支付訂單已不再接收轉帳。如有需要，請重新購買積分。', confirmations: '鏈上確認數',
    refreshDelayed: '即時狀態暫時延遲，你的支付工作階段仍安全保存在此裝置。', refreshNow: '重新整理狀態', refreshing: '重新整理中…', restoreFailed: '暫時無法讀取支付狀態', restoreFailedNote: 'AeroNyx 已在此裝置保留支付工作階段。請重試，不要重新轉帳。', backToDashboard: '完成', returnToAeroNyx: '返回 AeroNyx', continueOnWeb: '留在網頁', paymentSummary: '支付摘要',
    rate: '1 USDT = 100 積分', points: '積分', pointsUse: '積分可在 AeroNyx 內轉給朋友，或兌換會員。', enterCode: '積分要充入哪個 AeroNyx 帳戶？', codePlaceholder: 'NYX-XXXX-XXXX', continueWithCode: '繼續', invalidCode: '請輸入有效的 AeroNyx 會員碼。', reservedBundle: '已預留的積分包', reservedBundleNote: 'AeroNyx 已為本次一次性結帳鎖定這個積分包，無法在網頁中更改金額。', offerMismatch: '本次結帳與原始積分包不一致，請返回 AeroNyx 重新發起。',
  },
  ja: {
    ...en, networkTip: 'USDT があるネットワークを選んでください。取引所から出金する場合も、同じネットワークを選んでください。', openInWallet: 'ウォレットアプリで開く', openInWalletNote: 'Phantom や Solflare などの Solana ウォレットに、送金先と正確な金額が入力されます。',
    creditsTo: 'ポイントの入金先', redeemsFor: '{plan}に交換できます', tierPremium: 'プレミアム', tierUltimate: 'アルティメット', ethNotice: 'Ethereum のネットワーク手数料は通常かなり高めです。TRON や Solana の方が安く送れます。',
    membership: 'AeroNyx ポイント', title: 'USDTでポイントを購入', lede: 'ポイントパックと USDT があるネットワークを選び、ウォレットや取引所から送金すると、承認後に自動でポイントが入ります。',
    account: 'アカウント連携決済', verifiedCheckout: '受取アカウントを確認済み', checkoutReference: 'チャージ参照コード', addressBound: 'ネットワーク、正確な金額、受取アドレスはこのポイント購入に固定されています。', choosePlan: 'ポイントを選択', chooseNetwork: '支払いネットワーク', network: 'ネットワーク', monthly: '月額', yearly: '年額', days: '日', continue: '支払いを作成',
    preparing: '安全な支払いを準備中…', unavailable: '一時利用不可', paymentsOffline: 'USDT決済はまだ送金を受け付けていません。検証済みネットワークが有効になるまで受取アドレスは表示されません。', exactAmount: '正確な金額', receivingAddress: '受取アドレス', networkFee: '手数料に必要',
    expires: '残り時間', copy: 'コピー', copied: 'コピー済み', scan: '受取アドレスをスキャン', status: '支払い状況', awaiting: '送金を待っています',
    detected: '送金を検出しました', confirming: 'オンチェーン確認中', fulfilled: 'ポイント付与済み', expired: '支払い期限切れ', review: '確認が必要です', underpaid: '受取額が見積額を下回っています', overpaid: '受取額が見積額を上回っています', wrongAsset: '誤った資産またはネットワークです', failed: '検証に失敗しました', cancelled: '支払いはキャンセルされました', recovery: '期限内送金を検証中', recoveryNote: '支払い期限後も、期限前に送信された取引を確認しています。', hintBound: '取引を関連付けました。独立したオンチェーン検証を継続します。', reviewNote: '再送金せず、トランザクションハッシュを添えてサポートへご連絡ください。', support: 'サポートに連絡',
    txHint: '送金済みですか？', txPlaceholder: 'トランザクションハッシュを入力', submit: '取引を確認', submitting: '確認中…', explorer: '取引を表示', retry: 'やり直す',
    missingCode: 'メンバーシップコードを入力してください。', openFromDashboard: 'AeroNyx Wallet に表示されるコードを入力してください。コードを知る人はポイントを追加できますが、残高の閲覧や使用はできません。',
    privacy: 'このページは AeroNyx メンバーシップコードのみを送信し、ウォレット鍵、チャット、プライバシーネットワークの活動、個人メモリは送信しません。', publicChain: 'ブロックチェーン上の送金は公開され、送信元ウォレットが表示される場合があります。',
    bscNotice: 'BNB Smart ChainではTetherネイティブUSDTではなくBinance-Peg BSC-USDを受け付けます。', exactWarning: '選択したネットワークで正確な金額を送ってください。誤送金は自動復旧できません。', clipboardError: 'クリップボードを利用できません。',
    stepTransfer: '送金', stepVerify: '検証', stepActivate: 'ポイント付与', transferClosed: '追加送金しないでください', transferClosedNote: 'AeroNyx が支払いを検証している間、受取情報はロックされます。', paymentCompleteNote: 'ポイントが AeroNyx に付与されました。友人への送付またはメンバーシップ交換に利用できます。', reviewTransferNote: '既存の送金を確認中です。この注文に追加送金しないでください。', instructionsClosedNote: 'この支払い注文は送金を受け付けていません。必要な場合は新しいポイント購入を開始してください。', confirmations: 'オンチェーン確認数',
    refreshDelayed: '最新ステータスの取得が遅れています。支払いセッションは安全に保持されています。', refreshNow: '状態を更新', refreshing: '更新中…', restoreFailed: '支払い状況を一時的に取得できません', restoreFailedNote: 'この端末に支払いセッションを保持しています。再送金せずに再試行してください。', backToDashboard: '完了', returnToAeroNyx: 'AeroNyx に戻る', continueOnWeb: 'Web で続ける', paymentSummary: '支払い概要',
    rate: '1 USDT = 100 ポイント', points: 'ポイント', pointsUse: 'ポイントは AeroNyx で友人に送るか、メンバーシップに交換できます。', enterCode: 'どの AeroNyx アカウントにポイントを追加しますか？', codePlaceholder: 'NYX-XXXX-XXXX', continueWithCode: '続ける', invalidCode: '有効な AeroNyx メンバーシップコードを入力してください。', reservedBundle: '予約済みポイントパック', reservedBundleNote: 'この一回限りの決済には、このポイントパックが固定されています。ここでは金額を変更できません。', offerMismatch: '決済内容が元のポイントパックと一致しません。AeroNyx に戻ってやり直してください。',
  },
  ko: {
    ...en, networkTip: 'USDT가 있는 네트워크를 선택하세요. 거래소에서 출금할 때도 같은 네트워크를 선택해야 합니다.', openInWallet: '지갑 앱에서 열기', openInWalletNote: 'Phantom, Solflare 등 Solana 지갑에 주소와 정확한 금액이 자동으로 입력됩니다.',
    creditsTo: '포인트 입금 계정', redeemsFor: '{plan} 교환 가능', tierPremium: '프리미엄', tierUltimate: '얼티밋', ethNotice: '이더리움 네트워크 수수료는 보통 훨씬 높습니다. TRON이나 Solana로 보내는 편이 저렴합니다.',
    membership: 'AeroNyx 포인트', title: 'USDT로 포인트 구매', lede: '포인트 패키지와 USDT가 있는 네트워크를 고르고, 지갑이나 거래소에서 보내면 확인 후 포인트가 자동으로 들어옵니다.',
    account: '계정 연결 결제', verifiedCheckout: '수신 계정 확인됨', checkoutReference: '충전 참조 코드', addressBound: '네트워크, 정확한 금액, 수신 주소가 이 포인트 충전에 고정되었습니다.', choosePlan: '포인트 선택', chooseNetwork: '결제 네트워크 선택', network: '네트워크', monthly: '월간', yearly: '연간', days: '일', continue: '결제 만들기',
    preparing: '안전한 결제 준비 중…', unavailable: '일시적으로 사용할 수 없음', paymentsOffline: 'USDT 결제는 아직 송금을 받지 않습니다. 검증된 네트워크가 활성화될 때까지 수신 주소가 표시되지 않습니다.', exactAmount: '정확한 금액', receivingAddress: '수신 주소', networkFee: '네트워크 수수료',
    expires: '남은 시간', copy: '복사', copied: '복사됨', scan: '수신 주소 스캔', status: '결제 상태', awaiting: '송금 대기 중', detected: '송금 감지됨',
    confirming: '온체인 확인 중', fulfilled: '포인트 적립 완료', expired: '결제 시간 만료', review: '검토가 필요합니다', underpaid: '입금액이 견적보다 적습니다', overpaid: '입금액이 견적보다 많습니다', wrongAsset: '잘못된 자산 또는 네트워크입니다', failed: '검증 실패', cancelled: '결제 취소됨', recovery: '기한 내 송금 확인 중', recoveryNote: '결제 시간이 끝났지만 만료 전에 전송된 거래를 계속 확인하고 있습니다.', hintBound: '거래가 연결되었습니다. 독립적인 온체인 검증을 계속합니다.', reviewNote: '다시 송금하지 말고 거래 해시와 함께 지원팀에 문의하세요.', support: '지원팀 문의', txHint: '이미 보냈나요?',
    txPlaceholder: '트랜잭션 해시를 입력하세요', submit: '거래 확인', submitting: '확인 중…', explorer: '거래 보기', retry: '다시 시작', missingCode: '멤버십 코드를 입력하세요.',
    openFromDashboard: 'AeroNyx Wallet에 표시된 코드를 입력하세요. 코드를 아는 사람은 포인트를 추가할 수 있지만 조회하거나 사용할 수 없습니다.', privacy: '이 페이지는 AeroNyx 멤버십 코드만 전송하며 지갑 키, 채팅 ID, 프라이버시 네트워크 활동, 개인 메모리는 전송하지 않습니다.',
    publicChain: '블록체인 송금은 공개되며 보내는 지갑이 표시될 수 있습니다.', bscNotice: 'BNB Smart Chain에서는 Tether 네이티브 USDT가 아닌 Binance-Peg BSC-USD를 받습니다.',
    exactWarning: '선택한 네트워크에서 정확한 금액을 보내세요. 잘못된 네트워크 송금은 자동 복구되지 않습니다.', clipboardError: '클립보드를 사용할 수 없습니다.',
    stepTransfer: '송금', stepVerify: '검증', stepActivate: '포인트 적립', transferClosed: '추가 송금하지 마세요', transferClosedNote: 'AeroNyx가 결제를 검증하는 동안 수신 정보가 잠깁니다.', paymentCompleteNote: '포인트가 AeroNyx에 적립되었습니다. 친구에게 보내거나 멤버십으로 교환할 수 있습니다.', reviewTransferNote: '기존 송금을 검토 중입니다. 이 주문에 다시 결제하지 마세요.', instructionsClosedNote: '이 결제 주문은 더 이상 송금을 받지 않습니다. 필요하면 새 포인트 구매를 시작하세요.', confirmations: '온체인 확인 수',
    refreshDelayed: '실시간 상태가 잠시 지연되고 있습니다. 결제 세션은 이 기기에 안전하게 보관됩니다.', refreshNow: '상태 새로고침', refreshing: '새로고침 중…', restoreFailed: '결제 상태를 일시적으로 불러올 수 없습니다', restoreFailedNote: '결제 세션을 이 기기에 보관했습니다. 다시 송금하지 말고 재시도하세요.', backToDashboard: '완료', returnToAeroNyx: 'AeroNyx로 돌아가기', continueOnWeb: '웹에서 계속', paymentSummary: '결제 요약',
    rate: '1 USDT = 100 포인트', points: '포인트', pointsUse: '포인트는 AeroNyx에서 친구에게 보내거나 멤버십으로 교환할 수 있습니다.', enterCode: '어느 AeroNyx 계정에 포인트를 추가할까요?', codePlaceholder: 'NYX-XXXX-XXXX', continueWithCode: '계속', invalidCode: '유효한 AeroNyx 멤버십 코드를 입력하세요.', reservedBundle: '예약된 포인트 패키지', reservedBundleNote: '이 일회성 결제에는 해당 포인트 패키지가 고정되어 있어 여기서 금액을 변경할 수 없습니다.', offerMismatch: '결제 내용이 원래 포인트 패키지와 일치하지 않습니다. AeroNyx로 돌아가 다시 시작하세요.',
  },
  ru: {
    ...en, networkTip: 'Выберите сеть, в которой лежат ваши USDT. При выводе с биржи укажите там ту же сеть.', openInWallet: 'Открыть в кошельке', openInWalletNote: 'Адрес и точная сумма подставятся в Phantom, Solflare или другой Solana-кошелёк.',
    creditsTo: 'Баллы получит', redeemsFor: 'Хватит на {plan}', tierPremium: 'Premium', tierUltimate: 'Ultimate', ethNotice: 'Комиссии сети Ethereum обычно намного выше. Перевод через TRON или Solana обходится дешевле.',
    membership: 'Баллы AeroNyx', title: 'Купить баллы за USDT', lede: 'Выберите пакет и сеть, где лежат ваши USDT, отправьте перевод с любого кошелька или биржи — баллы придут сами после подтверждения.',
    account: 'Оплата для аккаунта', verifiedCheckout: 'Аккаунт получателя подтверждён', checkoutReference: 'Код пополнения', addressBound: 'Сеть, точная сумма и адрес получателя закреплены за этим пополнением баллов.', choosePlan: 'Выберите баллы', chooseNetwork: 'Выберите сеть', network: 'Сеть', monthly: 'Ежемесячно', yearly: 'Ежегодно', days: 'дней', continue: 'Создать платёж',
    preparing: 'Подготовка безопасного платежа…', unavailable: 'Временно недоступно', paymentsOffline: 'Оплата USDT пока не принимает переводы. Адрес не будет показан до включения проверенной сети.', exactAmount: 'Точная сумма', receivingAddress: 'Адрес получателя', networkFee: 'Комиссия оплачивается в',
    expires: 'Осталось времени', copy: 'Копировать', copied: 'Скопировано', scan: 'Отсканируйте адрес', status: 'Статус платежа', awaiting: 'Ожидание перевода',
    detected: 'Перевод обнаружен', confirming: 'Подтверждение в сети', fulfilled: 'Баллы начислены', expired: 'Время оплаты истекло', review: 'Требуется проверка', underpaid: 'Получено меньше расчётной суммы', overpaid: 'Получено больше расчётной суммы', wrongAsset: 'Неверный актив или сеть', failed: 'Проверка не пройдена', cancelled: 'Платёж отменён', recovery: 'Проверка своевременного перевода', recoveryNote: 'Окно оплаты закрыто, но AeroNyx продолжает искать перевод, отправленный до истечения срока.', hintBound: 'Транзакция привязана. Независимая проверка продолжается.', reviewNote: 'Не отправляйте повторный перевод. Свяжитесь с поддержкой и укажите хэш транзакции.', support: 'Связаться с поддержкой',
    txHint: 'Уже отправили?', txPlaceholder: 'Вставьте хэш транзакции', submit: 'Проверить', submitting: 'Проверка…', explorer: 'Открыть транзакцию', retry: 'Начать заново',
    missingCode: 'Введите код участника.', openFromDashboard: 'Введите код из AeroNyx Wallet. По нему можно только добавить баллы; посмотреть или потратить их нельзя.',
    privacy: 'Эта страница передаёт только код участника AeroNyx, но не ключи кошелька, чаты, активность Privacy Network или приватную память.', publicChain: 'Переводы в блокчейне публичны и могут раскрывать адрес отправителя.',
    bscNotice: 'В BNB Smart Chain принимается Binance-Peg BSC-USD, а не нативный USDT от Tether.', exactWarning: 'Отправьте точную сумму в выбранной сети. Ошибочный перевод нельзя восстановить автоматически.', clipboardError: 'Буфер обмена недоступен.',
    stepTransfer: 'Перевод', stepVerify: 'Проверка', stepActivate: 'Начисление', transferClosed: 'Не отправляйте повторный перевод', transferClosedNote: 'Реквизиты заблокированы, пока AeroNyx проверяет платёж.', paymentCompleteNote: 'Баллы начислены в AeroNyx. Их можно перевести другу или обменять на подписку.', reviewTransferNote: 'Имеющийся перевод проходит проверку. Не оплачивайте этот заказ повторно.', instructionsClosedNote: 'Этот платёжный заказ больше не принимает переводы. При необходимости начните новую покупку баллов.', confirmations: 'Подтверждения в сети',
    refreshDelayed: 'Обновление статуса задерживается. Платёжная сессия безопасно сохранена.', refreshNow: 'Обновить статус', refreshing: 'Обновление…', restoreFailed: 'Статус платежа временно недоступен', restoreFailedNote: 'Платёжная сессия сохранена на устройстве. Повторите проверку и не отправляйте новый перевод.', backToDashboard: 'Готово', returnToAeroNyx: 'Вернуться в AeroNyx', continueOnWeb: 'Продолжить в браузере', paymentSummary: 'Сводка платежа',
    rate: '1 USDT = 100 баллов', points: 'баллов', pointsUse: 'Баллы можно перевести другу в AeroNyx или обменять на подписку.', enterCode: 'На какой аккаунт AeroNyx начислить баллы?', codePlaceholder: 'NYX-XXXX-XXXX', continueWithCode: 'Продолжить', invalidCode: 'Введите действительный код участника AeroNyx.', reservedBundle: 'Зарезервированный пакет баллов', reservedBundleNote: 'Этот пакет закреплён за одноразовой оплатой AeroNyx. Изменить сумму на этой странице нельзя.', offerMismatch: 'Параметры оплаты не совпадают с исходным пакетом баллов. Вернитесь в AeroNyx и начните заново.',
  },
};

const REVIEW_STATUSES = new Set<PaymentStatus>([
  'underpaid', 'overpaid', 'wrong_asset', 'needs_review',
]);
const STATUS_POLL_INTERVAL_MS = 5000;
const STATUS_POLL_MAX_BACKOFF_MS = 30000;
const APP_CHECKOUT_RETURN_URI = 'aeronyx://membership/topup-complete';

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

// [TOPUP-POLISH 2026-10-03 by Claude] The App's locale tag (Flutter style,
// `zh_TW` / `zh-Hant-TW` / `ja`) → one this page speaks; null keeps the
// visitor's own choice.
function pageLocaleFromApp(raw: string | null): Locale | null {
  const tag = (raw || '').trim().replace(/_/g, '-').toLowerCase();
  if (!tag) return null;
  if (tag.startsWith('zh')) {
    return /(-tw|-hk|-mo|-hant)/.test(tag) ? 'zh-TW' : 'zh-CN';
  }
  for (const candidate of ['ja', 'ko', 'ru', 'en'] as const) {
    if (tag === candidate || tag.startsWith(`${candidate}-`)) return candidate;
  }
  return null;
}

// "Premium · Yearly" for a bundle that is exactly one plan's price.
function bundlePlanName(plan: { tier: string; billing_cycle: string }, text: Copy): string {
  const tier = plan.tier === 'ultimate' ? text.tierUltimate : plan.tier === 'premium' ? text.tierPremium : '';
  const cycle = plan.billing_cycle === 'yearly' ? text.yearly : plan.billing_cycle === 'monthly' ? text.monthly : '';
  return tier && cycle ? `${tier} · ${cycle}` : tier;
}

// Solana Pay transfer request (https://docs.solanapay.com/spec): recipient
// is the wallet owner; the wallet resolves its USDT token account.
function solanaPayUrl(payment: CryptoPayment): string {
  const params = new URLSearchParams({
    amount: payment.quoted_amount,
    'spl-token': payment.token_contract,
    label: 'AeroNyx',
  });
  return `solana:${payment.recipient_address}?${params.toString()}`;
}

function maskedCheckoutCode(code: string) {
  // [TOPUP-POLISH 2026-10-03 by Claude] Mask whole groups, the way the App
  // prints the code: NYX-RPWU-TSP4-NBSF → NYX-••••-NBSF (a 6-char tail cut
  // mid-group and read "••••-4-NBSF").
  const groups = code.split('-').filter(Boolean);
  const prefix = groups[0] === 'TOP' ? 'TOP-' : '';
  const kind = groups.find((group) => group !== 'TOP') || '';
  const last = groups[groups.length - 1] || '';
  return groups.length >= 3 ? `${prefix}${kind}-••••-${last}` : `••••-${code.slice(-4)}`;
}

// [MEMBERSHIP-POINTS-FIRST 2026-08-24 by Codex] The backend settles the
// plan's Decimal USD amount at 100 points per USDT with ROUND_DOWN. Parse the
// decimal as text so browser floating-point rounding cannot overstate credit.
function pointsForUsd(amount: string): number {
  const match = /^(\d+)(?:\.(\d+))?$/.exec(amount.trim());
  if (!match) return 0;
  const whole = Number(match[1]);
  const hundredths = Number(`${match[2] || ''}00`.slice(0, 2));
  if (!Number.isSafeInteger(whole) || !Number.isSafeInteger(hundredths)) return 0;
  const points = (whole * 100) + hundredths;
  return Number.isSafeInteger(points) ? points : 0;
}

function formatPoints(value: number, locale: Locale): string {
  return new Intl.NumberFormat(locale).format(value);
}

// [USDT-CHECKOUT-OFFER-BINDING 2026-08-25 by Codex] App-issued TOP-NYX
// capabilities are narrowed by the backend to exactly one immutable offer.
// Keep this public-page guard local so the approved deployment surface remains
// one file while zero/multiple plans still fail closed instead of being guessed.
function resolveCheckoutPlanSelection(checkout: CheckoutSummary) {
  const plans = checkout.plans.filter((plan) => plan.id.trim().length > 0);
  if (checkout.code_type === 'one_time') {
    return plans.length === 1 ? { plan: plans[0], locked: true } : null;
  }
  return plans.length > 0 ? { plan: plans[0], locked: false } : null;
}

function isCheckoutPlanSelectionAllowed(
  checkout: CheckoutSummary,
  rawPlan: string,
): boolean {
  const plan = rawPlan.trim();
  if (!plan) return false;
  if (checkout.code_type === 'one_time') {
    return resolveCheckoutPlanSelection(checkout)?.plan.id === plan;
  }
  return checkout.plans.some((candidate) => candidate.id === plan);
}

export default function TopUpPage() {
  const { locale, setLocale } = useI18n();
  const text = copyByLocale[locale] || en;
  const [code, setCode] = useState('');
  const [manualCode, setManualCode] = useState('');
  const [checkout, setCheckout] = useState<CheckoutSummary | null>(null);
  const [selectedPlan, setSelectedPlan] = useState('');
  const [selectedNetwork, setSelectedNetwork] = useState<PaymentNetworkId | ''>('');
  const [payment, setPayment] = useState<CryptoPayment | null>(null);
  const [clientToken, setClientToken] = useState('');
  const [pendingPaymentId, setPendingPaymentId] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [txHash, setTxHash] = useState('');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [statusRefreshing, setStatusRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [statusWarning, setStatusWarning] = useState('');
  const [copied, setCopied] = useState('');
  const [now, setNow] = useState(Date.now());
  const copyTimerRef = useRef<number | null>(null);
  // [TOPUP-PLAN-PRESELECT 2026-10-03 by Claude] The App sends the plan the
  // person was short of points for (`#plan=premium_yearly`), so the bundle
  // they meant is already selected. Only honoured when this checkout allows
  // that plan; a one-time locked checkout keeps its own offer.
  const requestedPlanRef = useRef('');
  // [TOPUP-POLISH 2026-10-03 by Claude] Opened by the AeroNyx App
  // (`#…&from=app&lang=zh-TW`): speak its language, and finish by returning
  // to it instead of the operator dashboard, which an App user never chose.
  const [fromApp, setFromApp] = useState(false);

  useEffect(() => {
    // [USDT-CAPABILITY-RECOVERY 2026-08-09 by Codex] Fragments never reach
    // the web server. Query support remains only to upgrade old links in place.
    const url = new URL(window.location.href);
    const fragmentParams = new URLSearchParams(url.hash.replace(/^#/, ''));
    const fragmentCode = fragmentParams.get('code');
    requestedPlanRef.current = (fragmentParams.get('plan') || '').trim();
    setFromApp(fragmentParams.get('from') === 'app');
    const appLocale = pageLocaleFromApp(fragmentParams.get('lang'));
    if (appLocale) {
      // The provider's own first effect runs after this one (parents after
      // children) and reads the stored choice; store the App's first so it
      // does not overwrite it with the browser default.
      try {
        window.localStorage.setItem(LOCALE_STORAGE_KEY, appLocale);
      } catch {
        // Storage blocked: setLocale below still applies for this visit.
      }
      setLocale(appLocale);
    }
    const queryCode = url.searchParams.get('code');
    const normalized = normalizeMembershipCheckoutCode(fragmentCode || queryCode);
    if (!normalized) {
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

  // [TOPUP-POLISH 2026-10-03 by Claude] Safari reuses an open tab when the App
  // opens the same page with a different fragment (another plan, a new code):
  // only the hash changes, nothing reloads, and this page — which reads the
  // fragment once on mount — kept showing the previous checkout. Reload so the
  // new hand-off is read from scratch. The page's own rewrites use
  // history.replaceState, which does not fire hashchange.
  useEffect(() => {
    const reload = () => window.location.reload();
    window.addEventListener('hashchange', reload);
    return () => window.removeEventListener('hashchange', reload);
  }, []);

  const refreshPayment = useCallback(async (
    id: string,
    token: string,
    checkoutCode: string,
    signal?: AbortSignal,
  ) => loadPaymentStatus({
    id,
    code: checkoutCode,
    clientToken: token,
    signal,
  }), []);

  useEffect(() => {
    if (!code) return;
    let cancelled = false;
    const requestController = new AbortController();
    (async () => {
      setLoading(true);
      setError('');
      setStatusWarning('');
      try {
        const summary = await loadCheckout(code, requestController.signal);
        if (cancelled) return;
        // [USDT-TOPUP-BINDING 2026-08-09 by Codex] Clear any rendered intent
        // before restoring. A payment token is valid only with the exact code
        // that created it, even when another checkout opens in the same tab.
        const initialPlan = resolveCheckoutPlanSelection(summary);
        if (!initialPlan) {
          setCheckout(null);
          setError(text.offerMismatch);
          return;
        }
        setPayment(null);
        setClientToken('');
        setPendingPaymentId('');
        setCheckout(summary);
        const requestedPlan = requestedPlanRef.current;
        setSelectedPlan(
          requestedPlan && isCheckoutPlanSelectionAllowed(summary, requestedPlan)
            ? requestedPlan
            : initialPlan.plan.id,
        );
        setSelectedNetwork(summary.networks.find((item) => item.available)?.id || '');
        const saved = readMembershipPaymentSession(code);
        if (saved) {
          setClientToken(saved.token);
          setPendingPaymentId(saved.id);
          try {
            const restored = await refreshPayment(
              saved.id,
              saved.token,
              code,
              requestController.signal,
            );
            if (cancelled) return;
            setPayment(restored);
            setPendingPaymentId('');
          } catch (restoreError) {
            if (cancelled || requestController.signal.aborted) return;
            // [USDT-CHECKOUT-LIFECYCLE 2026-08-13 by Codex] Transient
            // network/server failures must not destroy the only browser
            // capability able to recover an already-funded payment.
            if (isPaymentRecoveryCredentialRejected(restoreError)) {
              clearMembershipPaymentSession();
              setClientToken('');
              setPendingPaymentId('');
              setError(friendlyError(restoreError));
            } else {
              setStatusWarning(friendlyError(restoreError));
            }
          }
        }
      } catch (requestError) {
        if (!cancelled && !requestController.signal.aborted) {
          setError(friendlyError(requestError));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      requestController.abort();
    };
  }, [code, refreshPayment, text.offerMismatch]);

  useEffect(() => {
    if (!payment || !clientToken || !code || !shouldPollPayment(payment, now)) return;
    let cancelled = false;
    let running = false;
    let failureCount = 0;
    let timer: number | null = null;
    let requestController: AbortController | null = null;

    const schedule = (delay: number) => {
      if (cancelled) return;
      if (timer !== null) window.clearTimeout(timer);
      timer = window.setTimeout(poll, delay);
    };

    const poll = async () => {
      if (cancelled || running) return;
      if (document.visibilityState === 'hidden') {
        schedule(STATUS_POLL_INTERVAL_MS);
        return;
      }
      running = true;
      requestController = new AbortController();
      try {
        const next = await refreshPayment(
          payment.id,
          clientToken,
          code,
          requestController.signal,
        );
        if (cancelled) return;
        failureCount = 0;
        setPayment(next);
        setStatusWarning('');
        if (shouldPollPayment(next)) schedule(STATUS_POLL_INTERVAL_MS);
      } catch (requestError) {
        if (cancelled || requestController.signal.aborted) return;
        failureCount += 1;
        setStatusWarning(friendlyError(requestError));
        schedule(Math.min(
          STATUS_POLL_MAX_BACKOFF_MS,
          STATUS_POLL_INTERVAL_MS * (2 ** Math.min(failureCount, 3)),
        ));
      } finally {
        running = false;
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') schedule(250);
    };
    document.addEventListener('visibilitychange', handleVisibility);
    schedule(STATUS_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      if (timer !== null) window.clearTimeout(timer);
      requestController?.abort();
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [payment?.id, payment?.status, clientToken, code, refreshPayment]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!payment?.recipient_address || !isPaymentTransferOpen(payment)) {
      setQrDataUrl('');
      return () => { cancelled = true; };
    }
    QRCode.toDataURL(payment.recipient_address, {
      width: 320,
      margin: 1,
      color: { dark: '#09090B', light: '#FFFFFF' },
      errorCorrectionLevel: 'M',
    }).then((value) => {
      if (!cancelled) setQrDataUrl(value);
    }).catch(() => {
      if (!cancelled) setQrDataUrl('');
    });
    return () => { cancelled = true; };
  }, [payment?.recipient_address, payment?.status]);

  useEffect(() => () => {
    if (copyTimerRef.current !== null) {
      window.clearTimeout(copyTimerRef.current);
    }
  }, []);

  const selectedPlanData = useMemo(
    () => checkout?.plans.find((item) => item.id === selectedPlan),
    [checkout, selectedPlan],
  );
  const selectedNetworkData = useMemo(
    () => checkout?.networks.find((item) => item.id === selectedNetwork),
    [checkout, selectedNetwork],
  );
  const checkoutPlanSelection = useMemo(
    () => checkout ? resolveCheckoutPlanSelection(checkout) : null,
    [checkout],
  );
  const planLocked = checkoutPlanSelection?.locked ?? false;
  const selectedPoints = selectedPlanData
    ? pointsForUsd(selectedPlanData.amount_usd)
    : 0;
  const creditedPoints = payment ? pointsForUsd(payment.amount_usd) : 0;

  function useMembershipCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = normalizeMembershipCheckoutCode(manualCode);
    if (!normalized || normalized.startsWith('TOP-NYX-')) {
      setError(text.invalidCode);
      return;
    }
    // The public form accepts only the non-spendable membership alias. App
    // issued TOP-NYX capabilities continue to arrive through fragment links.
    setError('');
    setCode(normalized);
    const url = new URL(window.location.href);
    url.hash = `code=${encodeURIComponent(normalized)}`;
    window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
  }

  async function startPayment() {
    if (!code || !checkout || !selectedNetwork) return;
    if (!isCheckoutPlanSelectionAllowed(checkout, selectedPlan)) {
      setError(text.offerMismatch);
      return;
    }
    setCreating(true);
    setError('');
    try {
      const result = await createPaymentIntent({ code, plan: selectedPlan, network: selectedNetwork });
      setPayment(result.payment);
      setClientToken(result.clientToken);
      setPendingPaymentId('');
      setStatusWarning('');
      writeMembershipPaymentSession({
        code,
        id: result.payment.id,
        token: result.clientToken,
      });
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
      if (copyTimerRef.current !== null) {
        window.clearTimeout(copyTimerRef.current);
      }
      copyTimerRef.current = window.setTimeout(() => {
        setCopied('');
        copyTimerRef.current = null;
      }, 1500);
    } catch { setError(text.clipboardError); }
  }

  async function refreshStatusNow() {
    const id = payment?.id || pendingPaymentId;
    if (!id || !clientToken || !code || statusRefreshing) return;
    setStatusRefreshing(true);
    try {
      const next = await refreshPayment(id, clientToken, code);
      setPayment(next);
      setPendingPaymentId('');
      setStatusWarning('');
      setError('');
    } catch (requestError) {
      if (isPaymentRecoveryCredentialRejected(requestError)) {
        clearMembershipPaymentSession();
        setClientToken('');
        setPendingPaymentId('');
        setError(friendlyError(requestError));
      } else {
        setStatusWarning(friendlyError(requestError));
      }
    } finally {
      setStatusRefreshing(false);
    }
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
      setStatusWarning('');
    } catch (requestError) {
      setError(friendlyError(requestError));
    } finally { setSubmitting(false); }
  }

  function finishCheckout() {
    // [USDT-CHECKOUT-SESSION 2026-08-13 by Codex] Completion is the only
    // positive lifecycle state that automatically closes local recovery.
    clearMembershipPaymentSession();
    // [MEMBERSHIP-CHECKOUT-RETURN 2026-08-25 by Codex] The claim-free URI only
    // foregrounds the app. AeroNyx independently re-reads the authenticated
    // receipt and points ledger before displaying any paid state.
    if (checkout?.code_type === 'one_time' || fromApp) {
      window.location.assign(APP_CHECKOUT_RETURN_URI);
      return;
    }
    window.location.assign('/dashboard');
  }

  function restartCheckout() {
    clearMembershipPaymentSession();
    if (checkout?.code_type === 'one_time') {
      // A consumed one-time capability cannot safely create another intent.
      // [USDT-CHECKOUT-LIFECYCLE 2026-08-13 by Codex] A deterministic route
      // avoids sending the user to an unrelated referrer or stale app page.
      window.location.assign('/dashboard');
      return;
    }
    setPayment(null); setClientToken(''); setPendingPaymentId('');
    setTxHash(''); setError(''); setStatusWarning('');
  }

  const paymentRecoverable = payment ? isPaymentRecoverable(payment, now) : false;
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
    ? canSubmitPaymentTransactionHint(payment, now)
    : false;
  const transferOpen = payment ? isPaymentTransferOpen(payment) : false;
  const lifecyclePhase = payment ? paymentLifecyclePhase(payment, now) : null;
  const showPaymentCountdown = transferOpen || paymentRecoverable;
  const inactiveTransferNote = lifecyclePhase === 'fulfilled'
    ? text.paymentCompleteNote
    : lifecyclePhase === 'review'
      ? text.reviewTransferNote
      : lifecyclePhase === 'verification'
        ? text.transferClosedNote
        : text.instructionsClosedNote;
  const progressStep = lifecyclePhase === 'fulfilled'
    ? 3
    : lifecyclePhase === 'transfer'
      ? 1
      : lifecyclePhase
        ? 2
        : 0;
  const statusBadgeClass = payment?.status === 'fulfilled'
    ? 'bg-emerald-400/15 text-emerald-300'
    : payment && (REVIEW_STATUSES.has(payment.status) || paymentRecoverable)
      ? 'bg-amber-400/15 text-amber-200'
      : payment && ['expired', 'failed', 'cancelled'].includes(payment.status)
        ? 'bg-red-400/15 text-red-300'
        : 'bg-sky-400/15 text-sky-200';

  return (
    <main className={`min-h-screen bg-[#08080B] px-4 text-white sm:px-6 ${checkout && !payment && !pendingPaymentId ? 'pb-32 lg:pb-16' : 'pb-16'}`}>
      <div className="mx-auto max-w-5xl">
        <header className="flex min-h-20 items-center justify-between gap-3 border-b border-white/10">
          {/* [USDT-PAYMENTS 2026-08-07 by Codex] Preserve breathing room on
              320px devices without shrinking the language control. */}
          <div className="min-[380px]:hidden"><Logo className="h-8 w-8" /></div>
          <div className="hidden min-[380px]:block"><Logo className="h-8 w-8" showText /></div>
          <LanguageSelector compact className="w-32 shrink-0 sm:w-36" />
        </header>

        {/* [TOPUP-POLISH 2026-10-03 by Claude] Conversion page: on a phone
            the bundles start on the first screen. What happens next is three
            words, not a paragraph; the rate sits under the bundles it prices. */}
        {/* Once a payment exists the progress steps below take over; the hero
            would only push the amount and address off the first screen. */}
        {!payment && (
        <div className="py-6 sm:py-14">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300 sm:mb-3">{text.membership}</p>
          <h1 className="max-w-3xl text-2xl font-semibold leading-tight sm:text-5xl">{text.title}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400 sm:mt-4 sm:text-lg sm:leading-7">{text.lede}</p>
          <ol className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-500">
            {[text.stepTransfer, text.stepVerify, text.stepActivate].map((label, index) => (
              <li key={label} className="flex items-center gap-2">
                {index > 0 && <span aria-hidden="true" className="text-zinc-700">→</span>}
                <span className="flex h-5 w-5 items-center justify-center rounded-full border border-white/15 text-[10px] font-semibold text-zinc-400">{index + 1}</span>
                {label}
              </li>
            ))}
          </ol>
        </div>
        )}

        {!code && !loading && (
          <section className="max-w-2xl rounded-lg border border-white/10 bg-white/[0.035] p-5 sm:p-7">
            <h2 className="text-lg font-semibold">{text.missingCode}</h2>
            <p className="mt-2 leading-6 text-zinc-400">{text.openFromDashboard}</p>
            {/* [MEMBERSHIP-POINTS-FIRST 2026-08-24 by Codex] The public
                membership alias is a receive-only coordinate: knowing it can
                add points, never inspect or spend an account balance. */}
            <form className="mt-6 flex flex-col gap-3 sm:flex-row" onSubmit={useMembershipCode}>
              <label className="sr-only" htmlFor="membership-code">{text.enterCode}</label>
              <input
                id="membership-code"
                value={manualCode}
                onChange={(event) => setManualCode(event.target.value.toUpperCase())}
                placeholder={text.codePlaceholder}
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
                inputMode="text"
                maxLength={48}
                className="h-12 min-w-0 flex-1 rounded-lg border border-white/15 bg-black/30 px-4 font-mono text-sm uppercase tracking-wide outline-none placeholder:text-zinc-600 focus:border-emerald-400/60 focus:ring-2 focus:ring-emerald-400/20"
              />
              <button
                type="submit"
                disabled={!manualCode.trim()}
                className="h-12 shrink-0 rounded-lg bg-white px-5 text-sm font-semibold text-black transition hover:bg-zinc-200 focus:outline-none focus:ring-2 focus:ring-emerald-400/60 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500"
              >
                {text.continueWithCode}
              </button>
            </form>
          </section>
        )}

        {loading && <div className="h-1 w-full overflow-hidden bg-white/10"><div className="h-full w-1/3 animate-pulse bg-emerald-400" /></div>}

        {error && (
          <div role="alert" className="mb-6 rounded-lg border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-100">{error}</div>
        )}

        {checkout && pendingPaymentId && !payment && (
          <section className="max-w-2xl rounded-lg border border-amber-300/25 bg-amber-300/[0.06] p-5 sm:p-6" aria-live="polite">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-200">{text.paymentSummary}</p>
            <h2 className="mt-3 text-xl font-semibold">{text.restoreFailed}</h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-zinc-300">{text.restoreFailedNote}</p>
            {statusWarning && <p className="mt-3 text-xs leading-5 text-amber-100/75">{statusWarning}</p>}
            <button type="button" onClick={refreshStatusNow} disabled={statusRefreshing}
              className="mt-5 min-h-11 rounded-lg bg-white px-4 text-sm font-semibold text-black transition hover:bg-zinc-200 focus:outline-none focus:ring-2 focus:ring-emerald-400/60 disabled:cursor-wait disabled:bg-zinc-700 disabled:text-zinc-300">
              {statusRefreshing ? text.refreshing : text.refreshNow}
            </button>
          </section>
        )}

        {checkout && !payment && !pendingPaymentId && (
          <div className="grid gap-10 lg:grid-cols-[1fr_360px]">
            <div className="space-y-10">
              <section>
                <div className="mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                  <h2 className="text-lg font-semibold">{planLocked ? text.reservedBundle : text.choosePlan}</h2>
                  {/* [TOPUP-POLISH 2026-10-03 by Claude] Which account, not a
                      "verified" badge that read as the receiving side. */}
                  <span className="flex items-center gap-1.5 text-xs text-zinc-400">
                    <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    {text.creditsTo} <code className="text-zinc-200">{maskedCheckoutCode(code)}</code>
                  </span>
                </div>
                {planLocked && selectedPlanData ? (
                  <div className="rounded-lg border border-emerald-400/45 bg-emerald-400/[0.08] p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="text-2xl font-semibold tabular-nums">{formatPoints(selectedPoints, locale)}</div>
                        <div className="mt-1 text-sm text-zinc-400">{text.points}</div>
                      </div>
                      <div className="text-right">
                        <span className="text-lg font-semibold tabular-nums">{selectedPlanData.amount_usd} USDT</span>
                        <div className="mt-1 text-xs text-emerald-300">{text.verifiedCheckout}</div>
                      </div>
                    </div>
                    <p className="mt-4 border-t border-emerald-300/15 pt-4 text-xs leading-5 text-zinc-400">{text.reservedBundleNote}</p>
                  </div>
                ) : (
                  // [TOPUP-POLISH 2026-10-03 by Claude] Smallest first, two per
                  // row on a phone, and each bundle says which plan it covers
                  // (every bundle is exactly one plan's price). The rate is the
                  // pill under the title; repeating it on every card was noise.
                  <div className="grid grid-cols-2 gap-3">
                    {[...checkout.plans]
                      .sort((a, b) => pointsForUsd(a.amount_usd) - pointsForUsd(b.amount_usd))
                      .map((plan) => {
                    const active = selectedPlan === plan.id;
                    const bundlePoints = pointsForUsd(plan.amount_usd);
                    const planName = bundlePlanName(plan, text);
                    return (
                      <button type="button" key={plan.id} onClick={() => setSelectedPlan(plan.id)} aria-pressed={active}
                        className={`relative rounded-xl border p-4 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60 ${active ? 'border-emerald-400 bg-emerald-400/10' : 'border-white/10 bg-white/[0.025] hover:border-white/25'}`}>
                        {active && (
                          <span aria-hidden="true" className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-400 text-[11px] font-bold text-black">✓</span>
                        )}
                        <div className="text-2xl font-semibold tabular-nums">{formatPoints(bundlePoints, locale)}</div>
                        <div className="text-xs text-zinc-500">{text.points}</div>
                        <div className="mt-3 text-sm font-medium tabular-nums text-zinc-200">{plan.amount_usd} USDT</div>
                        {planName && (
                          <div className="mt-1 text-xs leading-4 text-emerald-300/80">{text.redeemsFor.replace('{plan}', planName)}</div>
                        )}
                      </button>
                    );
                    })}
                  </div>
                )}
                <p className="mt-3 text-xs leading-5 text-zinc-500">
                  <span className="font-semibold text-emerald-300/90">{text.rate}</span> · {text.pointsUse}
                </p>
              </section>

              <section>
                <h2 className="text-lg font-semibold">{text.chooseNetwork}</h2>
                <p className="mb-4 mt-1 text-xs leading-5 text-zinc-400">{text.networkTip}</p>
                {/* [ETH-USDT 2026-10-03 by Claude] Four networks: two columns on
                    small screens, one row of four on wide ones. */}
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  {checkout.networks.map((network) => {
                    const active = selectedNetwork === network.id;
                    return (
                      <button key={network.id} disabled={!network.available} onClick={() => setSelectedNetwork(network.id)} aria-pressed={active}
                        className={`relative flex items-center gap-3 rounded-xl border p-3.5 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60 disabled:cursor-not-allowed disabled:opacity-40 ${active ? 'border-emerald-400 bg-emerald-400/10' : 'border-white/10 bg-white/[0.025] hover:border-white/25'}`}>
                        {/* [TOPUP-POLISH 2026-10-03 by Claude] The chain's own
                            mark, not a letter in a grey circle. */}
                        <NetworkMark network={network.id} className="h-9 w-9 shrink-0" />
                        <span className="min-w-0">
                          <span className="block text-sm font-medium leading-tight">{network.display_name}</span>
                          <span className="mt-0.5 block text-xs text-zinc-500">{network.asset_code} · {network.gas_symbol}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
                {selectedNetworkData?.id === 'bsc' && <p className="mt-3 text-xs leading-5 text-amber-300/80">{text.bscNotice}</p>}
                {selectedNetworkData?.id === 'ethereum' && <p className="mt-3 text-xs leading-5 text-amber-300/80">{text.ethNotice}</p>}
              </section>
            </div>

            <aside className="hidden h-fit rounded-lg border border-white/10 bg-white/[0.035] p-6 lg:sticky lg:top-6 lg:block">
              <div className="flex items-center justify-between gap-4 text-sm">
                <span className="flex items-center gap-2 text-zinc-400">
                  <span aria-hidden="true" className="h-2 w-2 rounded-full bg-emerald-400" />
                  {text.creditsTo}
                </span>
                <code className="text-zinc-200">{maskedCheckoutCode(code)}</code>
              </div>
              <div className="my-6 h-px bg-white/10" />
              <div className="flex items-start justify-between gap-4 text-sm">
                <span className="text-zinc-400">{text.points}</span>
                <span className="text-right font-semibold tabular-nums">{selectedPlanData ? formatPoints(selectedPoints, locale) : '—'}</span>
              </div>
              <div className="mt-3 flex items-start justify-between gap-4 text-sm">
                <span className="text-zinc-400">USDT</span>
                <span className="text-right tabular-nums">{selectedPlanData?.amount_usd || '—'}</span>
              </div>
              <div className="mt-3 flex justify-between text-sm"><span className="text-zinc-400">{text.network}</span><span>{selectedNetworkData?.display_name || '—'}</span></div>
              <button onClick={startPayment} disabled={!checkout.payment_enabled || !selectedPlan || !selectedNetwork || creating}
                className="mt-6 h-12 w-full rounded-lg bg-white px-4 font-semibold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500">
                {creating ? text.preparing : checkout.payment_enabled ? text.continue : text.unavailable}
              </button>
              {!checkout.payment_enabled && (
                <p className="mt-3 text-xs leading-5 text-zinc-500">{text.paymentsOffline}</p>
              )}
            </aside>

            {/* [TOPUP-POLISH 2026-10-03 by Claude] Phones: the summary and the
                action stay on screen. The desktop aside above is hidden here. */}
            <div className="fixed inset-x-0 bottom-0 z-20 border-t border-white/10 bg-[#08080B]/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur lg:hidden">
              <div className="mx-auto flex max-w-5xl items-center gap-3">
                {selectedNetworkData && <NetworkMark network={selectedNetworkData.id} className="h-8 w-8 shrink-0" />}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold tabular-nums">
                    {selectedPlanData ? `${formatPoints(selectedPoints, locale)} ${text.points}` : '—'}
                  </div>
                  <div className="truncate text-xs tabular-nums text-zinc-400">
                    {selectedPlanData ? `${selectedPlanData.amount_usd} USDT` : ''}
                    {selectedNetworkData ? ` · ${selectedNetworkData.display_name}` : ''}
                  </div>
                </div>
                <button onClick={startPayment} disabled={!checkout.payment_enabled || !selectedPlan || !selectedNetwork || creating}
                  className="h-12 shrink-0 rounded-lg bg-white px-5 text-sm font-semibold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500">
                  {creating ? text.preparing : checkout.payment_enabled ? text.continue : text.unavailable}
                </button>
              </div>
            </div>
          </div>
        )}

        {payment && (
          <>
            <ol aria-label={text.status} className="mb-6 grid grid-cols-3 border-b border-white/10 py-4 sm:mb-8">
              {[text.stepTransfer, text.stepVerify, text.stepActivate].map((label, index) => {
                const step = index + 1;
                const complete = progressStep > step
                  || (lifecyclePhase === 'fulfilled' && step === 3);
                const current = progressStep === step;
                return (
                  <li key={label} aria-current={current ? 'step' : undefined}
                    className={`flex min-w-0 items-center gap-2 px-2 text-xs sm:px-4 sm:text-sm ${complete || current ? 'text-white' : 'text-zinc-600'}`}>
                    <span aria-hidden="true" className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold ${complete ? 'border-emerald-400 bg-emerald-400 text-black' : current ? 'border-emerald-400 text-emerald-300' : 'border-white/15'}`}>
                      {complete ? '✓' : step}
                    </span>
                    <span className="min-w-0 truncate sm:whitespace-normal">{label}</span>
                  </li>
                );
              })}
            </ol>

            <div className="grid gap-8 lg:grid-cols-[320px_1fr]">
              {transferOpen ? (
                <section className="order-2 mx-auto h-fit w-full max-w-[240px] rounded-lg border border-white/10 bg-white p-4 text-black lg:order-none lg:max-w-none">
                  {qrDataUrl ? <img src={qrDataUrl} alt={text.scan} className="aspect-square w-full" /> : <div className="aspect-square w-full animate-pulse bg-zinc-100" />}
                  <p className="mt-3 text-center text-xs text-zinc-500">{text.scan}</p>
                </section>
              ) : (
                <section className={`hidden h-fit rounded-lg border p-6 lg:block ${lifecyclePhase === 'fulfilled' ? 'border-emerald-300/25 bg-emerald-300/[0.07]' : lifecyclePhase === 'review' ? 'border-amber-300/25 bg-amber-300/[0.06]' : 'border-white/10 bg-white/[0.035]'}`}>
                  <div aria-hidden="true" className={`flex h-12 w-12 items-center justify-center rounded-full border text-xl ${lifecyclePhase === 'fulfilled' ? 'border-emerald-400/50 bg-emerald-400/15 text-emerald-300' : lifecyclePhase === 'review' ? 'border-amber-300/40 bg-amber-300/10 text-amber-200' : 'border-sky-300/30 bg-sky-300/10 text-sky-200'}`}>
                    {lifecyclePhase === 'fulfilled' ? '✓' : lifecyclePhase === 'review' ? '!' : '…'}
                  </div>
                  <p className="mt-5 text-xs uppercase tracking-[0.16em] text-zinc-500">{text.paymentSummary}</p>
                  <p className="mt-2 text-lg font-semibold">{statusLabel}</p>
                  <dl className="mt-5 space-y-3 border-t border-white/10 pt-4 text-sm">
                    <div className="flex items-start justify-between gap-4"><dt className="text-zinc-500">{text.exactAmount}</dt><dd className="text-right font-medium tabular-nums">{payment.quoted_amount} {payment.asset_code}</dd></div>
                    <div className="flex items-start justify-between gap-4"><dt className="text-zinc-500">{text.network}</dt><dd className="flex items-center justify-end gap-2 text-right"><NetworkMark network={payment.network} className="h-5 w-5" />{payment.network_name}</dd></div>
                  </dl>
                </section>
              )}

              <section className="order-1 min-w-0 rounded-lg border border-white/10 bg-white/[0.035] p-5 sm:p-7 lg:order-none">
              {/* [TOPUP-POLISH 2026-10-03 by Claude] Done: the credit and the way
                  back lead the screen; the payment details follow, smaller. */}
              {lifecyclePhase === 'fulfilled' && (
                <div aria-live="polite" className="mb-6 rounded-xl border border-emerald-300/25 bg-emerald-300/[0.07] p-5 text-center">
                  <div aria-hidden="true" className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-emerald-400 text-lg font-bold text-black">✓</div>
                  <p className="mt-3 text-sm font-semibold text-emerald-200">{text.fulfilled}</p>
                  {creditedPoints > 0 && (
                    <p className="mt-1 text-4xl font-semibold tabular-nums text-white">
                      +{formatPoints(creditedPoints, locale)} <span className="text-base font-medium text-zinc-400">{text.points}</span>
                    </p>
                  )}
                  <button type="button" onClick={finishCheckout}
                    className="mt-5 h-12 w-full rounded-lg bg-white text-sm font-semibold text-black transition hover:bg-zinc-200 focus:outline-none focus:ring-2 focus:ring-emerald-400/60">
                    {checkout?.code_type === 'one_time' || fromApp ? text.returnToAeroNyx : text.backToDashboard}
                  </button>
                </div>
              )}

              <div aria-live="polite" className={`flex-wrap items-start justify-between gap-4 border-b border-white/10 pb-5 ${lifecyclePhase === 'fulfilled' ? 'hidden' : 'flex'}`}>
                <div>
                  <div className="text-xs uppercase tracking-[0.16em] text-zinc-500">{text.status}</div>
                  <h2 className="mt-2 text-xl font-semibold">{statusLabel}</h2>
                  {statusNote && <p className="mt-2 max-w-xl text-sm leading-6 text-zinc-400">{statusNote}</p>}
                </div>
                {(payment.confirmations > 0 || !transferOpen) && (
                  <div className={`rounded-full px-3 py-1 text-xs ${statusBadgeClass}`}>
                    {payment.confirmations}/{payment.required_confirmations}
                  </div>
                )}
              </div>

              {statusWarning && (
                <div role="status" className="mt-5 flex flex-col gap-3 rounded-lg border border-amber-300/25 bg-amber-300/[0.06] p-3 text-sm text-amber-100 sm:flex-row sm:items-center sm:justify-between">
                  <span className="leading-5">{text.refreshDelayed}</span>
                  <button type="button" onClick={refreshStatusNow} disabled={statusRefreshing}
                    className="min-h-10 shrink-0 rounded-lg border border-amber-200/25 px-3 text-xs font-semibold transition hover:bg-amber-200/10 focus:outline-none focus:ring-2 focus:ring-amber-200/50 disabled:cursor-wait disabled:opacity-50">
                    {statusRefreshing ? text.refreshing : text.refreshNow}
                  </button>
                </div>
              )}

              <div className="grid gap-6 py-6 sm:grid-cols-2">
                <div><div className="text-xs text-zinc-500">{text.exactAmount}</div><button type="button" onClick={() => copyValue('amount', payment.quoted_amount)} className="mt-2 flex max-w-full flex-wrap items-baseline gap-2 text-left focus:outline-none focus:ring-2 focus:ring-emerald-400/60"><span className="break-all text-3xl font-semibold tabular-nums">{payment.quoted_amount}</span><span className="text-zinc-400">{payment.asset_code}</span><span className="text-xs text-emerald-300">{copied === 'amount' ? text.copied : text.copy}</span></button></div>
                {showPaymentCountdown ? (
                  <div><div className="text-xs text-zinc-500">{paymentRecoverable ? text.recovery : text.expires}</div><div className="mt-2 text-3xl font-semibold tabular-nums">{formatCountdown(paymentRecoverable ? payment.recovery_until : payment.expires_at, now)}</div><div className="mt-1 text-xs text-zinc-500">{payment.network_name} · {text.networkFee} {payment.gas_symbol}</div></div>
                ) : (
                  <div><div className="text-xs text-zinc-500">{text.confirmations}</div><div className="mt-2 text-3xl font-semibold tabular-nums">{payment.confirmations} / {payment.required_confirmations}</div><div className="mt-1 text-xs text-zinc-500">{payment.network_name}</div></div>
                )}
              </div>

              {/* [TOPUP-POLISH 2026-10-03 by Claude] The trailing digits identify
                  this payment, so "exact" is said where the amount is, not
                  after the address. */}
              {transferOpen && (
                <p className="mb-5 rounded-lg border border-amber-300/20 bg-amber-300/[0.06] p-3 text-xs leading-5 text-amber-100/80">{text.exactWarning}</p>
              )}

              {transferOpen ? (
                <>
                  {/* [TOPUP-POLISH 2026-10-03 by Claude] Paying from the same
                      phone: a Solana Pay link opens the wallet with the address
                      and the exact quoted amount filled in (decimal string,
                      passed through untouched). Phones only — desktop wallets
                      rarely handle solana: links; the QR serves them. */}
                  {payment.network === 'solana' && (
                    <div className="border-t border-white/10 py-5 lg:hidden">
                      <a href={solanaPayUrl(payment)}
                        className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-white text-sm font-semibold text-black transition hover:bg-zinc-200">
                        <NetworkMark network="solana" className="h-5 w-5" />
                        {text.openInWallet}
                      </a>
                      <p className="mt-2 text-xs leading-5 text-zinc-500">{text.openInWalletNote}</p>
                    </div>
                  )}
                  <div className="border-t border-white/10 py-5">
                    <div className="text-xs text-zinc-500">{text.receivingAddress}</div>
                    <button type="button" onClick={() => copyValue('address', payment.recipient_address)} className="mt-2 flex w-full items-center gap-3 rounded-lg border border-white/10 bg-black/30 p-3 text-left focus:outline-none focus:ring-2 focus:ring-emerald-400/60">
                      <code className="min-w-0 flex-1 break-all text-xs leading-5 text-zinc-200">{payment.recipient_address}</code><span className="shrink-0 text-xs text-emerald-300">{copied === 'address' ? text.copied : text.copy}</span>
                    </button>
                    <p className="mt-2 text-xs leading-5 text-zinc-500">{text.addressBound}</p>
                  </div>

                  {payment.network === 'bsc' && <p className="mt-3 text-xs leading-5 text-zinc-500">{text.bscNotice}</p>}
                </>
              ) : (
                <div className="border-t border-white/10 py-5">
                  <p className={`text-sm font-semibold ${lifecyclePhase === 'fulfilled' ? 'text-emerald-200' : 'text-amber-100'}`}>
                    {lifecyclePhase === 'fulfilled' ? text.fulfilled : text.transferClosed}
                  </p>
                  <p className="mt-2 text-xs leading-5 text-zinc-400">{inactiveTransferNote}</p>
                </div>
              )}

              {acceptsTransactionHint && (
                <div className="mt-6 border-t border-white/10 pt-5">
                  <label className="text-xs text-zinc-500" htmlFor="tx-hash">{text.txHint}</label>
                  <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                    <input id="tx-hash" value={txHash} onChange={(event) => setTxHash(event.target.value)} placeholder={text.txPlaceholder}
                      autoCapitalize="none" autoCorrect="off" spellCheck={false} maxLength={128}
                      className="h-11 min-w-0 flex-1 rounded-lg border border-white/10 bg-black/30 px-3 text-sm outline-none focus:border-emerald-400/60" />
                    <button type="button" onClick={sendTransactionHint} disabled={!txHash.trim() || submitting}
                      className="h-11 rounded-lg border border-white/15 px-4 text-sm font-medium transition hover:bg-white/10 disabled:opacity-40">{submitting ? text.submitting : text.submit}</button>
                  </div>
                </div>
              )}

              {payment.transaction_hint_bound && (
                <p className="mt-5 rounded-lg border border-sky-300/20 bg-sky-300/[0.06] p-3 text-xs leading-5 text-sky-100/80">{text.hintBound}</p>
              )}

              <div className="mt-6 flex flex-wrap gap-3">
                {payment.explorer_url && <a href={payment.explorer_url} target="_blank" rel="noreferrer" className="rounded-lg border border-white/15 px-4 py-2 text-sm hover:bg-white/10">{text.explorer}</a>}
                {payment.status === 'fulfilled' && checkout?.code_type === 'one_time' && <a href="/dashboard" onClick={() => clearMembershipPaymentSession()} className="rounded-lg border border-white/15 px-4 py-2 text-sm hover:bg-white/10">{text.continueOnWeb}</a>}
                {(REVIEW_STATUSES.has(payment.status) || payment.status === 'failed') && <a href="mailto:hi@aeronyx.network" className="rounded-lg border border-amber-300/25 px-4 py-2 text-sm text-amber-100 hover:bg-amber-300/10">{text.support}</a>}
                {((payment.status === 'expired' && !paymentRecoverable) || payment.status === 'failed' || payment.status === 'cancelled') && <button type="button" onClick={restartCheckout} className="rounded-lg border border-white/15 px-4 py-2 text-sm hover:bg-white/10">{text.retry}</button>}
              </div>
              </section>
            </div>
          </>
        )}

        <footer className="mt-14 grid gap-3 border-t border-white/10 pt-6 text-xs leading-5 text-zinc-500 sm:grid-cols-2">
          <p>{text.privacy}</p><p>{text.publicChain}</p>
        </footer>
      </div>
    </main>
  );
}

