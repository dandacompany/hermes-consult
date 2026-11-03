export const en = {
  title: "Website consultation",
  subtitle: "Connect your website to a voice assistant powered by your Hermes.",
  connection: "Connection",
  bot: "Assistant",
  knowledge: "Knowledge",
  protection: "Usage & safety",
  install: "Website",
  activity: "Activity",
  running: "Server running",
  stopped: "Server stopped",
  connected: "Hermes connected",
  offline: "Hermes offline",
  unpublished: "Not published",
  revision: "Published version {0}",
  publicOrigin: "Public HTTPS address",
  publicOriginHelp:
    "Point your HTTPS tunnel or reverse proxy to the local port below. Your private server address and credentials never go in the embed code.",
  port: "Local port",
  portHelp: "Use a different port for each Hermes profile.",
  subscription: "Allow subscription voice",
  subscriptionHelp:
    "Requires the consultation-enabled Hermes Live plugin and a Codex ChatGPT login on this computer. API voice works without Hermes Live.",
  keys: "Credentials",
  keysHelp:
    "Configure the OpenAI API key and optional Turnstile secret in this plugin’s Agent settings. Restart the consultation server after changing credentials.",
  startServer: "Start server",
  stopServer: "Stop server",
  stopHelp:
    "Stopping ends active consultations. Keep this computer and Hermes running to receive calls.",
  serverRequired: "Start the consultation server to manage your assistants.",
  openConnection: "Set up connection",
  assistant: "Assistant",
  newAssistant: "New assistant",
  name: "Name",
  greeting: "Welcome message",
  engine: "Voice engine",
  api: "Official GPT-Live API",
  subscriptionEngine: "Hermes Live · subscription",
  engineHelp:
    "The voice engine and the Hermes model answering document questions are separate. Subscription limits and any model API charges still apply.",
  source: "Consultation knowledge",
  sourceHelp:
    "Add company information, services, prices and FAQs. Up to 40,000 characters. Do not include credentials or private customer data.",
  importFile: "Import TXT / Markdown",
  rules: "Answer rules",
  rulesHelp:
    "Define scope, tone, when to say “I don’t know”, and when to refer the visitor to a person. Instructions cannot guarantee perfectly accurate answers.",
  enabled: "Accept consultations",
  enabledHelp:
    "Turn off and publish to block new consultations and end active ones. Visitors can still leave an inquiry.",
  maxSeconds: "Maximum consultation duration",
  maxSecondsHelp: "Seconds per consultation, including connection time.",
  maxConcurrent: "Concurrent consultations",
  maxConcurrentHelp: "New visitors wait when all slots are occupied.",
  dailySeconds: "Daily site allowance",
  dailySecondsHelp:
    "Total reserved seconds across all visitors, reset at midnight UTC.",
  dailyStarts: "Daily starts per visitor / IP",
  dailyStartsHelp:
    "Both limits apply. Visitors on a shared network share the IP allowance.",
  cooldownSeconds: "Wait before another consultation",
  cooldownSecondsHelp:
    "Seconds between starts, including after a failed connection.",
  budgetHelp:
    "The full duration is reserved at start and is not refunded for early exits. Counters survive server restarts. This is a usage limit, not an exact currency spending cap.",
  turnstile: "Turnstile public site key",
  turnstileHelp:
    "Optional bot verification. Register the public consultation hostname with Cloudflare and configure the matching secret in Agent settings. Verification failures block consultation starts.",
  origins: "Allowed website addresses",
  originsHelp:
    "One origin per line, for example https://example.com. Add www separately. Paths are not allowed.",
  snippet: "Embed code",
  snippetHelp:
    "Publish first, then paste this into the website’s shared HTML before the closing body tag. HTTPS and microphone permission are required for voice.",
  copy: "Copy snippet",
  copied: "Embed code copied.",
  unpublishedHelp:
    "Save and publish this assistant to generate its embed code.",
  save: "Save draft",
  publish: "Save & publish",
  saved: "Draft saved. Visitors continue to use the published version.",
  published: "Published. New consultations use this version.",
  dirty: "Unpublished changes",
  refreshing: "Working…",
  refresh: "Refresh",
  refreshStatus: "Refresh connection",
  inquiries: "Inquiries",
  sessions: "Recent consultations",
  noInquiries: "No inquiries yet.",
  noSessions: "No consultations yet.",
  selectFirst: "Save an assistant first to view activity.",
  sessionSummary: "{0} · {1} · reserved {2}s / used {3}s",
  active: "Active",
  ended: "Ended",
  interrupted: "Interrupted",
  expired: "Expired",
  paused: "Paused",
  disconnected: "Disconnected",
  errGeneric:
    "Could not complete the request. Check the connection and try again.",
  errBackend:
    "The plugin backend is unavailable. Enable the agent half of Hermes Consult for this profile.",
  errScope:
    "The profile or connection changed. Try again in the current settings page.",
  errInput:
    "Check the settings. Enter a name and at least one valid website origin.",
  errPort: "This port is already in use. Choose another port.",
  errRuntime: "Install Node.js 24 or later and use a built plugin package.",
  errLive: "Install the Hermes Live version that supports consultation voice.",
  errLimit: "A usage limit was reached. Wait before trying again.",
  errFile: "Choose a TXT or Markdown file with at most 40,000 characters.",
  defaultName: "Website assistant",
  defaultGreeting: "Hello. I’m your AI assistant. How can I help?",
  defaultRules:
    "Answer from the published documents. If you do not know, offer to take an inquiry. Do not confirm payments, refunds or reservations.",
  setup: "Setup",
  setupHelp:
    "1. Start the server  ·  2. Add knowledge and limits  ·  3. Publish and embed",
  unsavedNew: "New assistant · not saved",
  privacy:
    "Audio and question text are not retained by the consultation server. Inquiries and usage records are retained for 30 days.",
};
export type Key = keyof typeof en;
export const ko: Record<Key, string> = {
  title: "홈페이지 상담봇",
  subtitle: "내 Hermes를 홈페이지의 음성 상담원으로 연결하세요.",
  connection: "연결",
  bot: "상담봇",
  knowledge: "자료·규칙",
  protection: "사용량·보호",
  install: "홈페이지",
  activity: "활동 기록",
  running: "서버 실행 중",
  stopped: "서버 중지됨",
  connected: "Hermes 연결됨",
  offline: "Hermes 미연결",
  unpublished: "미게시",
  revision: "게시 버전 {0}",
  publicOrigin: "공개 HTTPS 주소",
  publicOriginHelp:
    "HTTPS 터널이나 리버스 프록시를 아래 로컬 포트에 연결하세요. 내부 서버 주소와 인증정보는 삽입 코드에 넣지 않습니다.",
  port: "로컬 포트",
  portHelp: "Hermes 프로필마다 다른 포트를 사용하세요.",
  subscription: "구독 음성 허용",
  subscriptionHelp:
    "상담 연동을 지원하는 Hermes Live 플러그인과 이 컴퓨터의 Codex ChatGPT 로그인이 필요합니다. 공식 API는 Hermes Live 없이 사용할 수 있습니다.",
  keys: "인증정보",
  keysHelp:
    "OpenAI API 키와 선택 사항인 Turnstile 비밀 키는 이 플러그인의 Agent settings에서 설정하세요. 변경 후 상담 서버를 다시 시작하세요.",
  startServer: "서버 시작",
  stopServer: "서버 중지",
  stopHelp:
    "중지하면 진행 중인 상담도 종료됩니다. 상담을 받으려면 이 컴퓨터와 Hermes가 켜져 있어야 합니다.",
  serverRequired: "상담봇을 관리하려면 상담 서버를 먼저 시작하세요.",
  openConnection: "연결 설정하기",
  assistant: "상담봇",
  newAssistant: "새 상담봇",
  name: "이름",
  greeting: "첫 인사",
  engine: "음성 엔진",
  api: "공식 GPT-Live API",
  subscriptionEngine: "Hermes Live · 구독",
  engineHelp:
    "음성 엔진과 자료 답변에 쓰는 Hermes 모델은 별개입니다. 구독 사용 한도와 모델의 API 비용이 적용됩니다.",
  source: "상담 자료",
  sourceHelp:
    "회사 소개, 상품, 가격, FAQ 등을 최대 40,000자까지 등록하세요. 인증정보나 고객의 비공개 정보는 넣지 마세요.",
  importFile: "TXT / Markdown 가져오기",
  rules: "답변 규칙",
  rulesHelp:
    "답변 범위와 말투, 모를 때의 대응, 사람에게 넘길 상황을 정하세요. 지침만으로 답변의 정확성을 완전히 보장할 수는 없습니다.",
  enabled: "상담 접수",
  enabledHelp:
    "끄고 게시하면 새 상담을 차단하고 진행 중인 상담도 종료합니다. 문의 남기기는 계속 사용할 수 있습니다.",
  maxSeconds: "상담당 최대 시간",
  maxSecondsHelp: "연결 시간을 포함한 상담당 제한 시간입니다. 단위: 초.",
  maxConcurrent: "동시 상담 수",
  maxConcurrentHelp: "모든 자리가 사용 중이면 새 방문자에게 대기를 안내합니다.",
  dailySeconds: "사이트 하루 사용 한도",
  dailySecondsHelp:
    "모든 방문자의 예약 시간을 합산합니다. UTC 자정 기준, 단위: 초.",
  dailyStarts: "방문자·IP별 하루 시작 횟수",
  dailyStartsHelp:
    "두 한도를 함께 적용합니다. 같은 네트워크의 방문자는 IP 한도를 공유합니다.",
  cooldownSeconds: "다음 상담까지 대기 시간",
  cooldownSecondsHelp:
    "연결 실패를 포함해 상담 시작 사이에 필요한 대기 시간입니다. 단위: 초.",
  budgetHelp:
    "시작할 때 최대 시간을 예약하며 조기 종료해도 반환하지 않습니다. 기록은 서버 재시작 후에도 유지됩니다. 금액 기준의 과금 상한은 아닙니다.",
  turnstile: "Turnstile 공개 사이트 키",
  turnstileHelp:
    "선택 사항인 봇 검증입니다. 공개 상담 호스트를 Cloudflare에 등록하고 Agent settings에 해당 비밀 키를 설정하세요. 검증에 실패하면 상담을 시작하지 않습니다.",
  origins: "허용 홈페이지 주소",
  originsHelp:
    "https://example.com처럼 한 줄에 하나씩 입력하세요. www는 별도로 등록하며 경로는 넣지 않습니다.",
  snippet: "홈페이지 삽입 코드",
  snippetHelp:
    "게시 후 홈페이지 공통 HTML의 body 닫기 태그 앞에 넣으세요. 음성 상담에는 HTTPS와 마이크 권한이 필요합니다.",
  copy: "삽입 코드 복사",
  copied: "삽입 코드를 복사했습니다.",
  unpublishedHelp: "상담봇을 저장하고 게시하면 삽입 코드가 생성됩니다.",
  save: "초안 저장",
  publish: "저장하고 게시",
  saved: "초안을 저장했습니다. 방문자에게는 기존 게시 버전이 적용됩니다.",
  published: "게시했습니다. 새 상담부터 적용됩니다.",
  dirty: "게시하지 않은 변경",
  refreshing: "처리 중…",
  refresh: "새로고침",
  refreshStatus: "연결 상태 새로고침",
  inquiries: "접수 문의",
  sessions: "최근 상담",
  noInquiries: "아직 접수된 문의가 없습니다.",
  noSessions: "아직 상담 기록이 없습니다.",
  selectFirst: "상담봇을 먼저 저장하면 기록을 볼 수 있습니다.",
  sessionSummary: "{0} · {1} · 예약 {2}초 / 사용 {3}초",
  active: "상담 중",
  ended: "종료",
  interrupted: "중단",
  expired: "시간 만료",
  paused: "일시 중지",
  disconnected: "연결 해제",
  errGeneric: "요청을 처리하지 못했습니다. 연결을 확인하고 다시 시도하세요.",
  errBackend:
    "플러그인 백엔드에 연결할 수 없습니다. 현재 프로필에서 Hermes Consult의 에이전트 기능을 활성화하세요.",
  errScope:
    "프로필이나 연결이 변경되었습니다. 현재 설정 화면에서 다시 시도하세요.",
  errInput:
    "설정을 확인하세요. 이름과 올바른 홈페이지 주소가 하나 이상 필요합니다.",
  errPort: "이미 사용 중인 포트입니다. 다른 포트를 선택하세요.",
  errRuntime: "Node.js 24 이상과 빌드된 플러그인 패키지가 필요합니다.",
  errLive: "상담 음성 연동을 지원하는 Hermes Live 버전을 설치하세요.",
  errLimit: "사용량 한도에 도달했습니다. 잠시 후 다시 시도하세요.",
  errFile: "최대 40,000자의 TXT 또는 Markdown 파일을 선택하세요.",
  defaultName: "홈페이지 상담원",
  defaultGreeting: "안녕하세요. AI 상담원입니다. 무엇을 도와드릴까요?",
  defaultRules:
    "게시된 자료에 근거해 답하세요. 모르면 문의 접수를 안내하세요. 결제·환불·예약을 확정하지 마세요.",
  setup: "설치 순서",
  setupHelp:
    "1. 서버 연결  ·  2. 자료와 한도 설정  ·  3. 게시 후 홈페이지 삽입",
  unsavedNew: "새 상담봇 · 저장 전",
  privacy:
    "상담 서버는 음성과 질문 내용을 보관하지 않습니다. 문의와 사용 기록은 30일간 보관합니다.",
};
export const bundles = { en, ko };
export type Translate = (key: Key, ...values: unknown[]) => string;
export function interpolate(message: string, ...values: unknown[]) {
  return message.replace(/\{(\d+)\}/g, (_, n) =>
    String(values[Number(n)] ?? ""),
  );
}
export function format(locale: string, key: Key, ...values: unknown[]) {
  return interpolate((locale.startsWith("ko") ? ko : en)[key], ...values);
}
export function errorKey(error: unknown): Key {
  const message = error instanceof Error ? error.message : String(error);
  if (message.startsWith("HC:"))
    return message.slice(3) in en ? (message.slice(3) as Key) : "errGeneric";
  if (/이미 사용 중인 포트/.test(message)) return "errPort";
  if (/Node.js|빌드된 플러그인/.test(message)) return "errRuntime";
  if (/Hermes Live/.test(message)) return "errLive";
  if (/400|입력값|HTTPS 주소/.test(message)) return "errInput";
  if (/429/.test(message)) return "errLimit";
  if (/404|503|fetch|backend|ECONN/i.test(message)) return "errBackend";
  return "errGeneric";
}
