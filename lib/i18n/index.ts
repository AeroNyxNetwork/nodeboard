/**
 * ============================================
 * AeroNyx Nodeboard i18n Dictionary
 * ============================================
 * File Path: lib/i18n/index.ts
 *
 * Product Requirement:
 *   Nodeboard must support operators in English, Simplified Chinese,
 *   Traditional Chinese, Japanese, Korean, and Russian without changing
 *   dashboard route URLs or breaking existing deep links.
 *
 * Main Functionality:
 *   - Supported language registry
 *   - Browser-language normalization
 *   - English fallback translation lookup
 *   - Lightweight interpolation for operator UI strings
 *
 * Privacy Boundary:
 *   Translation dictionaries contain UI copy only. They do not contain node
 *   public keys, wallet secrets, client IPs, destinations, DNS contents,
 *   packet payloads, browsing history, or traffic metadata.
 *
 * Last Modified: v1.0.0 - Initial nodeboard i18n base framework
 * ============================================
 */

export type Locale = 'en' | 'zh-CN' | 'zh-TW' | 'ja' | 'ko' | 'ru';

export const DEFAULT_LOCALE: Locale = 'en';
export const LOCALE_STORAGE_KEY = 'aeronyx.nodeboard.locale';

export const LANGUAGE_OPTIONS: Array<{
  code: Locale;
  label: string;
  nativeLabel: string;
}> = [
  { code: 'en', label: 'English', nativeLabel: 'English' },
  { code: 'zh-CN', label: 'Simplified Chinese', nativeLabel: '简体中文' },
  { code: 'zh-TW', label: 'Traditional Chinese', nativeLabel: '繁體中文' },
  { code: 'ja', label: 'Japanese', nativeLabel: '日本語' },
  { code: 'ko', label: 'Korean', nativeLabel: '한국어' },
  { code: 'ru', label: 'Russian', nativeLabel: 'Русский' },
];

type Dictionary = Record<string, string>;

const en: Dictionary = {
  'common.loadingDashboard': 'Loading dashboard...',
  'common.retry': 'Retry',
  'common.refreshNow': 'Refresh now',
  'common.refreshing': 'Refreshing',
  'common.manageNodes': 'Manage nodes',
  'common.connectedWallet': 'Connected Wallet',
  'common.notAvailable': 'N/A',
  'common.disconnect': 'Disconnect',
  'common.collapseDetails': 'Collapse details',
  'common.status.ok': 'ok',
  'common.status.info': 'info',
  'common.status.pending': 'pending',
  'common.status.warning': 'warning',
  'common.status.critical': 'critical',
  'common.status.error': 'error',
  'common.status.healthy': 'healthy',
  'common.status.degraded': 'degraded',
  'common.status.blocked': 'blocked',
  'common.status.ready': 'ready',
  'common.status.attention': 'attention',
  'common.status.current': 'current',

  'nav.overview': 'Overview',
  'nav.services': 'Services',
  'nav.nodes': 'Nodes',
  'nav.codes': 'Registration Codes',
  'nav.sessions': 'Sessions',
  'nav.billing': 'Traffic & Billing',
  'nav.events': 'Alerts / Events',
  'nav.settings': 'Settings',

  'language.label': 'Language',
  'language.helper': 'Choose the dashboard language. Technical IDs and backend paths remain unchanged.',
  'language.saved': 'Language saved locally.',

  'settings.title': 'Settings',
  'settings.subtitle': 'Commercial AeroNyx Privacy Protocol placement and policy per node',
  'settings.unavailableTitle': 'Settings Unavailable',
  'settings.unavailableDescription': 'Unable to load node settings.',
  'settings.noNodesTitle': 'No Nodes',
  'settings.noNodesDescription': 'Node settings will appear after a node is registered.',
  'settings.languageTitle': 'Language & Region',
  'settings.languageDescription': 'This changes nodeboard UI text, number formatting, and date formatting for this browser.',

  'services.pageEyebrow': 'Node Operator Console',
  'services.pageTitle': 'AeroNyx Service Readiness',
  'services.pageDescription': 'Privacy Protocol transport, MemChain memory, encrypted relay, sovereign data RPC, and SuperNode worker status from signed Rust heartbeats.',
  'services.liveRefresh': 'Live refresh {interval}',
  'services.apiOverview': 'API GET /api/privacy_network/vpn/overview/',
  'services.dataUnavailableTitle': 'Service data unavailable',
  'services.dataUnavailableDescription': 'The operator console could not load service overview data from the backend.',
  'services.detailModules.title': 'Detail Modules',
  'services.detailModules.description': 'Open secondary reports only when you need placement, rollout, policy, or node-level diagnostics.',
  'services.detailModules.collapsedTitle': 'Details collapsed',
  'services.detailModules.collapsedDescription': 'Select a detail module above to inspect placement, rollout, service-layer, risk, or node-table diagnostics.',
  'services.modules.placement.eyebrow': 'capacity',
  'services.modules.placement.label': 'Client Placement',
  'services.modules.placement.detail': 'Placement capacity, unavailable reasons, region and tier groups.',
  'services.modules.restart.eyebrow': 'operations',
  'services.modules.restart.label': 'Restart & Rollout',
  'services.modules.restart.detail': 'Restart gates, drain risk, command delivery, Rust rollout gaps.',
  'services.modules.layers.eyebrow': 'signals',
  'services.modules.layers.label': 'Service Layers',
  'services.modules.layers.detail': 'Privacy Protocol, MemChain, ChatRelay, data layer, and operator heartbeat.',
  'services.modules.risks.eyebrow': 'alerts',
  'services.modules.risks.label': 'Service Risks',
  'services.modules.risks.detail': 'Degraded service-layer risks and remediation notes.',
  'services.modules.nodes.eyebrow': 'table',
  'services.modules.nodes.label': 'Node Readiness',
  'services.modules.nodes.detail': 'Full per-node readiness table and service cards.',
  'services.operatorSignal.title': 'Operator Signal',
  'services.operatorSignal.reporting': '{count} node(s) reporting operator_status through signed Rust heartbeat',
  'services.operatorSignal.waiting': 'Waiting for system_stats.operator_status from Rust heartbeats',
};

const zhCN: Dictionary = {
  'common.loadingDashboard': '正在加载控制台...',
  'common.retry': '重试',
  'common.refreshNow': '立即刷新',
  'common.refreshing': '刷新中',
  'common.manageNodes': '管理节点',
  'common.connectedWallet': '已连接钱包',
  'common.notAvailable': '不可用',
  'common.disconnect': '断开连接',
  'common.collapseDetails': '收起详情',
  'common.status.ok': '正常',
  'common.status.info': '信息',
  'common.status.pending': '等待中',
  'common.status.warning': '警告',
  'common.status.critical': '严重',
  'common.status.error': '错误',
  'common.status.healthy': '健康',
  'common.status.degraded': '降级',
  'common.status.blocked': '阻塞',
  'common.status.ready': '就绪',
  'common.status.attention': '需关注',
  'common.status.current': '当前',
  'nav.overview': '概览',
  'nav.services': '服务',
  'nav.nodes': '节点',
  'nav.codes': '注册码',
  'nav.sessions': '会话',
  'nav.billing': '流量与结算',
  'nav.events': '告警 / 事件',
  'nav.settings': '设置',
  'language.label': '语言',
  'language.helper': '选择控制台语言。技术 ID 和后端路径保持不变。',
  'language.saved': '语言已保存在本地。',
  'settings.title': '设置',
  'settings.subtitle': '按节点管理商用 AeroNyx 隐私协议接入与策略',
  'settings.unavailableTitle': '设置不可用',
  'settings.unavailableDescription': '无法加载节点设置。',
  'settings.noNodesTitle': '没有节点',
  'settings.noNodesDescription': '注册节点后会显示节点设置。',
  'settings.languageTitle': '语言与地区',
  'settings.languageDescription': '此设置会改变当前浏览器里的 nodeboard 文案、数字格式和日期格式。',
  'services.pageEyebrow': '节点运营控制台',
  'services.pageTitle': 'AeroNyx 服务就绪状态',
  'services.pageDescription': '来自 Rust 签名心跳的隐私协议传输、MemChain 记忆、加密中继、主权数据 RPC 和 SuperNode worker 状态。',
  'services.liveRefresh': '实时刷新 {interval}',
  'services.apiOverview': 'API GET /api/privacy_network/vpn/overview/',
  'services.dataUnavailableTitle': '服务数据不可用',
  'services.dataUnavailableDescription': '运营控制台无法从后端加载服务概览数据。',
  'services.detailModules.title': '详情模块',
  'services.detailModules.description': '仅在需要接入、发布、策略或节点级诊断时打开二级报表。',
  'services.detailModules.collapsedTitle': '详情已收起',
  'services.detailModules.collapsedDescription': '选择上方详情模块来查看接入、发布、服务层、风险或节点表诊断。',
  'services.modules.placement.eyebrow': '容量',
  'services.modules.placement.label': '客户端接入',
  'services.modules.placement.detail': '接入容量、不可用原因、地区与等级分组。',
  'services.modules.restart.eyebrow': '运维',
  'services.modules.restart.label': '重启与发布',
  'services.modules.restart.detail': '重启门禁、drain 风险、命令投递、Rust 发布缺口。',
  'services.modules.layers.eyebrow': '信号',
  'services.modules.layers.label': '服务层',
  'services.modules.layers.detail': '隐私协议、MemChain、ChatRelay、数据层和 operator 心跳。',
  'services.modules.risks.eyebrow': '告警',
  'services.modules.risks.label': '服务风险',
  'services.modules.risks.detail': '服务层降级风险和修复建议。',
  'services.modules.nodes.eyebrow': '表格',
  'services.modules.nodes.label': '节点就绪状态',
  'services.modules.nodes.detail': '完整的节点就绪表格和服务卡片。',
  'services.operatorSignal.title': 'Operator 信号',
  'services.operatorSignal.reporting': '{count} 个节点通过 Rust 签名心跳上报 operator_status',
  'services.operatorSignal.waiting': '正在等待 Rust 心跳中的 system_stats.operator_status',
};

const zhTW: Dictionary = {
  ...zhCN,
  'common.loadingDashboard': '正在載入控制台...',
  'common.retry': '重試',
  'common.refreshNow': '立即刷新',
  'common.connectedWallet': '已連接錢包',
  'common.notAvailable': '不可用',
  'common.disconnect': '中斷連線',
  'common.collapseDetails': '收起詳情',
  'nav.overview': '總覽',
  'nav.services': '服務',
  'nav.nodes': '節點',
  'nav.codes': '註冊碼',
  'nav.sessions': '連線',
  'nav.billing': '流量與結算',
  'nav.events': '警示 / 事件',
  'nav.settings': '設定',
  'language.label': '語言',
  'language.helper': '選擇控制台語言。技術 ID 和後端路徑保持不變。',
  'language.saved': '語言已儲存在本機。',
  'settings.title': '設定',
  'settings.subtitle': '按節點管理商用 AeroNyx 隱私協議接入與策略',
  'settings.unavailableTitle': '設定不可用',
  'settings.unavailableDescription': '無法載入節點設定。',
  'settings.noNodesTitle': '沒有節點',
  'settings.noNodesDescription': '註冊節點後會顯示節點設定。',
  'settings.languageTitle': '語言與地區',
  'settings.languageDescription': '此設定會改變目前瀏覽器裡的 nodeboard 文案、數字格式和日期格式。',
  'services.pageEyebrow': '節點運營控制台',
  'services.pageTitle': 'AeroNyx 服務就緒狀態',
  'services.detailModules.title': '詳情模組',
  'services.detailModules.description': '僅在需要接入、發布、策略或節點級診斷時開啟二級報表。',
  'services.detailModules.collapsedTitle': '詳情已收起',
  'services.detailModules.collapsedDescription': '選擇上方詳情模組來查看接入、發布、服務層、風險或節點表診斷。',
  'services.modules.placement.label': '客戶端接入',
  'services.modules.restart.label': '重啟與發布',
  'services.modules.layers.label': '服務層',
  'services.modules.risks.label': '服務風險',
  'services.modules.nodes.label': '節點就緒狀態',
};

const ja: Dictionary = {
  ...en,
  'common.loadingDashboard': 'ダッシュボードを読み込み中...',
  'common.retry': '再試行',
  'common.refreshNow': '今すぐ更新',
  'common.refreshing': '更新中',
  'common.manageNodes': 'ノード管理',
  'common.connectedWallet': '接続済みウォレット',
  'common.disconnect': '切断',
  'common.collapseDetails': '詳細を閉じる',
  'nav.overview': '概要',
  'nav.services': 'サービス',
  'nav.nodes': 'ノード',
  'nav.codes': '登録コード',
  'nav.sessions': 'セッション',
  'nav.billing': 'トラフィックと請求',
  'nav.events': 'アラート / イベント',
  'nav.settings': '設定',
  'language.label': '言語',
  'language.helper': 'ダッシュボードの言語を選択します。技術 ID とバックエンドパスは変更されません。',
  'settings.title': '設定',
  'settings.subtitle': 'ノードごとの商用 AeroNyx Privacy Protocol 配置とポリシー',
  'settings.languageTitle': '言語と地域',
  'settings.languageDescription': 'このブラウザの UI テキスト、数値形式、日付形式を変更します。',
  'services.pageEyebrow': 'ノード運用コンソール',
  'services.pageTitle': 'AeroNyx サービス準備状況',
  'services.detailModules.title': '詳細モジュール',
  'services.detailModules.description': '配置、ロールアウト、ポリシー、ノード診断が必要なときだけ開きます。',
  'services.detailModules.collapsedTitle': '詳細は折りたたまれています',
  'services.modules.placement.label': 'クライアント配置',
  'services.modules.restart.label': '再起動とロールアウト',
  'services.modules.layers.label': 'サービスレイヤー',
  'services.modules.risks.label': 'サービスリスク',
  'services.modules.nodes.label': 'ノード準備状況',
};

const ko: Dictionary = {
  ...en,
  'common.loadingDashboard': '대시보드를 불러오는 중...',
  'common.retry': '다시 시도',
  'common.refreshNow': '지금 새로고침',
  'common.refreshing': '새로고침 중',
  'common.manageNodes': '노드 관리',
  'common.connectedWallet': '연결된 지갑',
  'common.disconnect': '연결 해제',
  'common.collapseDetails': '상세 접기',
  'nav.overview': '개요',
  'nav.services': '서비스',
  'nav.nodes': '노드',
  'nav.codes': '등록 코드',
  'nav.sessions': '세션',
  'nav.billing': '트래픽 및 정산',
  'nav.events': '알림 / 이벤트',
  'nav.settings': '설정',
  'language.label': '언어',
  'language.helper': '대시보드 언어를 선택합니다. 기술 ID와 백엔드 경로는 변경되지 않습니다.',
  'settings.title': '설정',
  'settings.subtitle': '노드별 상업용 AeroNyx Privacy Protocol 배치 및 정책',
  'settings.languageTitle': '언어 및 지역',
  'settings.languageDescription': '이 브라우저의 UI 문구, 숫자 형식, 날짜 형식을 변경합니다.',
  'services.pageEyebrow': '노드 운영 콘솔',
  'services.pageTitle': 'AeroNyx 서비스 준비 상태',
  'services.detailModules.title': '상세 모듈',
  'services.detailModules.description': '배치, 롤아웃, 정책 또는 노드 진단이 필요할 때만 여세요.',
  'services.detailModules.collapsedTitle': '상세가 접혀 있습니다',
  'services.modules.placement.label': '클라이언트 배치',
  'services.modules.restart.label': '재시작 및 롤아웃',
  'services.modules.layers.label': '서비스 레이어',
  'services.modules.risks.label': '서비스 위험',
  'services.modules.nodes.label': '노드 준비 상태',
};

const ru: Dictionary = {
  ...en,
  'common.loadingDashboard': 'Загрузка панели...',
  'common.retry': 'Повторить',
  'common.refreshNow': 'Обновить',
  'common.refreshing': 'Обновление',
  'common.manageNodes': 'Управлять узлами',
  'common.connectedWallet': 'Подключенный кошелек',
  'common.disconnect': 'Отключить',
  'common.collapseDetails': 'Свернуть детали',
  'nav.overview': 'Обзор',
  'nav.services': 'Сервисы',
  'nav.nodes': 'Узлы',
  'nav.codes': 'Коды регистрации',
  'nav.sessions': 'Сессии',
  'nav.billing': 'Трафик и биллинг',
  'nav.events': 'Оповещения / события',
  'nav.settings': 'Настройки',
  'language.label': 'Язык',
  'language.helper': 'Выберите язык панели. Технические ID и backend-пути не меняются.',
  'settings.title': 'Настройки',
  'settings.subtitle': 'Коммерческое размещение AeroNyx Privacy Protocol и политика по узлам',
  'settings.languageTitle': 'Язык и регион',
  'settings.languageDescription': 'Изменяет текст интерфейса, формат чисел и дат в этом браузере.',
  'services.pageEyebrow': 'Консоль оператора узлов',
  'services.pageTitle': 'Готовность сервисов AeroNyx',
  'services.detailModules.title': 'Модули деталей',
  'services.detailModules.description': 'Открывайте вторичные отчеты только для размещения, rollout, политик или диагностики узлов.',
  'services.detailModules.collapsedTitle': 'Детали свернуты',
  'services.modules.placement.label': 'Размещение клиентов',
  'services.modules.restart.label': 'Перезапуск и rollout',
  'services.modules.layers.label': 'Сервисные слои',
  'services.modules.risks.label': 'Риски сервисов',
  'services.modules.nodes.label': 'Готовность узлов',
};

export const dictionaries: Record<Locale, Dictionary> = {
  en,
  'zh-CN': zhCN,
  'zh-TW': zhTW,
  ja,
  ko,
  ru,
};

export function normalizeLocale(value: string | null | undefined): Locale {
  const normalized = (value || '').trim().toLowerCase();
  if (normalized === 'zh-cn' || normalized === 'zh-hans' || normalized === 'zh') return 'zh-CN';
  if (normalized === 'zh-tw' || normalized === 'zh-hant' || normalized === 'zh-hk') return 'zh-TW';
  if (normalized.startsWith('ja')) return 'ja';
  if (normalized.startsWith('ko')) return 'ko';
  if (normalized.startsWith('ru')) return 'ru';
  if (normalized.startsWith('en')) return 'en';
  return DEFAULT_LOCALE;
}

export function interpolate(template: string, values?: Record<string, string | number>) {
  if (!values) return template;
  return template.replace(/\{(\w+)\}/g, (_, key: string) => (
    values[key] === undefined ? `{${key}}` : String(values[key])
  ));
}

export function translate(
  locale: Locale,
  key: string,
  values?: Record<string, string | number>
) {
  const message = dictionaries[locale]?.[key] ?? dictionaries[DEFAULT_LOCALE][key] ?? key;
  return interpolate(message, values);
}
