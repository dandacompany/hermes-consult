// desktop/source.tsx
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore
} from "react";
import {
  host,
  Button,
  Input,
  Textarea,
  ListRow,
  ToggleRow,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  SegmentedControl,
  Badge,
  useI18n,
  usePluginI18n
} from "@hermes/plugin-sdk";

// desktop/i18n.ts
var en = {
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
  publicOriginHelp: "Point your HTTPS tunnel or reverse proxy to the local port below. Your private server address and credentials never go in the embed code.",
  port: "Local port",
  portHelp: "Use a different port for each Hermes profile.",
  subscription: "Allow subscription voice",
  subscriptionHelp: "Requires the consultation-enabled Hermes Live plugin and a Codex ChatGPT login on this computer. API voice works without Hermes Live.",
  keys: "Credentials",
  keysHelp: "Configure the OpenAI API key and optional Turnstile secret in this plugin\u2019s Agent settings. Restart the consultation server after changing credentials.",
  startServer: "Start server",
  stopServer: "Stop server",
  stopHelp: "Stopping ends active consultations. Keep this computer and Hermes running to receive calls.",
  serverRequired: "Start the consultation server to manage your assistants.",
  openConnection: "Set up connection",
  assistant: "Assistant",
  newAssistant: "New assistant",
  name: "Name",
  greeting: "Welcome message",
  engine: "Voice engine",
  api: "Official GPT-Live API",
  subscriptionEngine: "Hermes Live \xB7 subscription",
  engineHelp: "The voice engine and the Hermes model answering document questions are separate. Subscription limits and any model API charges still apply.",
  source: "Consultation knowledge",
  sourceHelp: "Add company information, services, prices and FAQs. Up to 40,000 characters. Do not include credentials or private customer data.",
  importFile: "Import TXT / Markdown",
  rules: "Answer rules",
  rulesHelp: "Define scope, tone, when to say \u201CI don\u2019t know\u201D, and when to refer the visitor to a person. Instructions cannot guarantee perfectly accurate answers.",
  enabled: "Accept consultations",
  enabledHelp: "Turn off and publish to block new consultations and end active ones. Visitors can still leave an inquiry.",
  maxSeconds: "Maximum consultation duration",
  maxSecondsHelp: "Seconds per consultation, including connection time.",
  maxConcurrent: "Concurrent consultations",
  maxConcurrentHelp: "New visitors wait when all slots are occupied.",
  dailySeconds: "Daily site allowance",
  dailySecondsHelp: "Total reserved seconds across all visitors, reset at midnight UTC.",
  dailyStarts: "Daily starts per visitor / IP",
  dailyStartsHelp: "Both limits apply. Visitors on a shared network share the IP allowance.",
  cooldownSeconds: "Wait before another consultation",
  cooldownSecondsHelp: "Seconds between starts, including after a failed connection.",
  budgetHelp: "The full duration is reserved at start and is not refunded for early exits. Counters survive server restarts. This is a usage limit, not an exact currency spending cap.",
  turnstile: "Turnstile public site key",
  turnstileHelp: "Optional bot verification. Register the public consultation hostname with Cloudflare and configure the matching secret in Agent settings. Verification failures block consultation starts.",
  origins: "Allowed website addresses",
  originsHelp: "One origin per line, for example https://example.com. Add www separately. Paths are not allowed.",
  snippet: "Embed code",
  snippetHelp: "Publish first, then paste this into the website\u2019s shared HTML before the closing body tag. HTTPS and microphone permission are required for voice.",
  copy: "Copy snippet",
  copied: "Embed code copied.",
  unpublishedHelp: "Save and publish this assistant to generate its embed code.",
  save: "Save draft",
  publish: "Save & publish",
  saved: "Draft saved. Visitors continue to use the published version.",
  published: "Published. New consultations use this version.",
  dirty: "Unpublished changes",
  refreshing: "Working\u2026",
  refresh: "Refresh",
  refreshStatus: "Refresh connection",
  inquiries: "Inquiries",
  sessions: "Recent consultations",
  noInquiries: "No inquiries yet.",
  noSessions: "No consultations yet.",
  selectFirst: "Save an assistant first to view activity.",
  sessionSummary: "{0} \xB7 {1} \xB7 reserved {2}s / used {3}s",
  active: "Active",
  ended: "Ended",
  interrupted: "Interrupted",
  expired: "Expired",
  paused: "Paused",
  disconnected: "Disconnected",
  errGeneric: "Could not complete the request. Check the connection and try again.",
  errBackend: "The plugin backend is unavailable. Enable the agent half of Hermes Consult for this profile.",
  errScope: "The profile or connection changed. Try again in the current settings page.",
  errInput: "Check the settings. Enter a name and at least one valid website origin.",
  errPort: "This port is already in use. Choose another port.",
  errRuntime: "Install Node.js 24 or later and use a built plugin package.",
  errLive: "Install the Hermes Live version that supports consultation voice.",
  errLimit: "A usage limit was reached. Wait before trying again.",
  errFile: "Choose a TXT or Markdown file with at most 40,000 characters.",
  errOrigin: "Enter a public HTTPS origin without a path.",
  errStart: "The consultation server did not start. Check the Node.js version and installation.",
  errNotRunning: "Start the consultation server first.",
  errNotFound: "The assistant was not found. Refresh and try again.",
  errConflict: "The request conflicts with the current state, such as the assistant limit. Refresh and try again.",
  errLlm: "Hermes plugin LLM access is unavailable. Enable the plugin and restart Hermes.",
  errLiveVersion: "This Hermes Live version uses an unsupported consultation API. Update Hermes Live.",
  language: "Answer language",
  languageHelp: "Language for written and spoken answers. Automatic uses the website page\u2019s language; visitors who use another language are answered in theirs.",
  languageAuto: "Automatic (page language)",
  defaultName: "Website assistant",
  defaultGreeting: "Hello. I\u2019m your AI assistant. How can I help?",
  defaultRules: "Answer from the published documents. If you do not know, offer to take an inquiry. Do not confirm payments, refunds or reservations.",
  setup: "Setup",
  setupHelp: "1. Start the server  \xB7  2. Add knowledge and limits  \xB7  3. Publish and embed",
  unsavedNew: "New assistant \xB7 not saved",
  privacy: "Audio and question text are not retained by the consultation server. Inquiries and usage records are retained for 30 days."
};
var ko = {
  title: "\uD648\uD398\uC774\uC9C0 \uC0C1\uB2F4\uBD07",
  subtitle: "\uB0B4 Hermes\uB97C \uD648\uD398\uC774\uC9C0\uC758 \uC74C\uC131 \uC0C1\uB2F4\uC6D0\uC73C\uB85C \uC5F0\uACB0\uD558\uC138\uC694.",
  connection: "\uC5F0\uACB0",
  bot: "\uC0C1\uB2F4\uBD07",
  knowledge: "\uC790\uB8CC\xB7\uADDC\uCE59",
  protection: "\uC0AC\uC6A9\uB7C9\xB7\uBCF4\uD638",
  install: "\uD648\uD398\uC774\uC9C0",
  activity: "\uD65C\uB3D9 \uAE30\uB85D",
  running: "\uC11C\uBC84 \uC2E4\uD589 \uC911",
  stopped: "\uC11C\uBC84 \uC911\uC9C0\uB428",
  connected: "Hermes \uC5F0\uACB0\uB428",
  offline: "Hermes \uBBF8\uC5F0\uACB0",
  unpublished: "\uBBF8\uAC8C\uC2DC",
  revision: "\uAC8C\uC2DC \uBC84\uC804 {0}",
  publicOrigin: "\uACF5\uAC1C HTTPS \uC8FC\uC18C",
  publicOriginHelp: "HTTPS \uD130\uB110\uC774\uB098 \uB9AC\uBC84\uC2A4 \uD504\uB85D\uC2DC\uB97C \uC544\uB798 \uB85C\uCEEC \uD3EC\uD2B8\uC5D0 \uC5F0\uACB0\uD558\uC138\uC694. \uB0B4\uBD80 \uC11C\uBC84 \uC8FC\uC18C\uC640 \uC778\uC99D\uC815\uBCF4\uB294 \uC0BD\uC785 \uCF54\uB4DC\uC5D0 \uB123\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.",
  port: "\uB85C\uCEEC \uD3EC\uD2B8",
  portHelp: "Hermes \uD504\uB85C\uD544\uB9C8\uB2E4 \uB2E4\uB978 \uD3EC\uD2B8\uB97C \uC0AC\uC6A9\uD558\uC138\uC694.",
  subscription: "\uAD6C\uB3C5 \uC74C\uC131 \uD5C8\uC6A9",
  subscriptionHelp: "\uC0C1\uB2F4 \uC5F0\uB3D9\uC744 \uC9C0\uC6D0\uD558\uB294 Hermes Live \uD50C\uB7EC\uADF8\uC778\uACFC \uC774 \uCEF4\uD4E8\uD130\uC758 Codex ChatGPT \uB85C\uADF8\uC778\uC774 \uD544\uC694\uD569\uB2C8\uB2E4. \uACF5\uC2DD API\uB294 Hermes Live \uC5C6\uC774 \uC0AC\uC6A9\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.",
  keys: "\uC778\uC99D\uC815\uBCF4",
  keysHelp: "OpenAI API \uD0A4\uC640 \uC120\uD0DD \uC0AC\uD56D\uC778 Turnstile \uBE44\uBC00 \uD0A4\uB294 \uC774 \uD50C\uB7EC\uADF8\uC778\uC758 Agent settings\uC5D0\uC11C \uC124\uC815\uD558\uC138\uC694. \uBCC0\uACBD \uD6C4 \uC0C1\uB2F4 \uC11C\uBC84\uB97C \uB2E4\uC2DC \uC2DC\uC791\uD558\uC138\uC694.",
  startServer: "\uC11C\uBC84 \uC2DC\uC791",
  stopServer: "\uC11C\uBC84 \uC911\uC9C0",
  stopHelp: "\uC911\uC9C0\uD558\uBA74 \uC9C4\uD589 \uC911\uC778 \uC0C1\uB2F4\uB3C4 \uC885\uB8CC\uB429\uB2C8\uB2E4. \uC0C1\uB2F4\uC744 \uBC1B\uC73C\uB824\uBA74 \uC774 \uCEF4\uD4E8\uD130\uC640 Hermes\uAC00 \uCF1C\uC838 \uC788\uC5B4\uC57C \uD569\uB2C8\uB2E4.",
  serverRequired: "\uC0C1\uB2F4\uBD07\uC744 \uAD00\uB9AC\uD558\uB824\uBA74 \uC0C1\uB2F4 \uC11C\uBC84\uB97C \uBA3C\uC800 \uC2DC\uC791\uD558\uC138\uC694.",
  openConnection: "\uC5F0\uACB0 \uC124\uC815\uD558\uAE30",
  assistant: "\uC0C1\uB2F4\uBD07",
  newAssistant: "\uC0C8 \uC0C1\uB2F4\uBD07",
  name: "\uC774\uB984",
  greeting: "\uCCAB \uC778\uC0AC",
  engine: "\uC74C\uC131 \uC5D4\uC9C4",
  api: "\uACF5\uC2DD GPT-Live API",
  subscriptionEngine: "Hermes Live \xB7 \uAD6C\uB3C5",
  engineHelp: "\uC74C\uC131 \uC5D4\uC9C4\uACFC \uC790\uB8CC \uB2F5\uBCC0\uC5D0 \uC4F0\uB294 Hermes \uBAA8\uB378\uC740 \uBCC4\uAC1C\uC785\uB2C8\uB2E4. \uAD6C\uB3C5 \uC0AC\uC6A9 \uD55C\uB3C4\uC640 \uBAA8\uB378\uC758 API \uBE44\uC6A9\uC774 \uC801\uC6A9\uB429\uB2C8\uB2E4.",
  source: "\uC0C1\uB2F4 \uC790\uB8CC",
  sourceHelp: "\uD68C\uC0AC \uC18C\uAC1C, \uC0C1\uD488, \uAC00\uACA9, FAQ \uB4F1\uC744 \uCD5C\uB300 40,000\uC790\uAE4C\uC9C0 \uB4F1\uB85D\uD558\uC138\uC694. \uC778\uC99D\uC815\uBCF4\uB098 \uACE0\uAC1D\uC758 \uBE44\uACF5\uAC1C \uC815\uBCF4\uB294 \uB123\uC9C0 \uB9C8\uC138\uC694.",
  importFile: "TXT / Markdown \uAC00\uC838\uC624\uAE30",
  rules: "\uB2F5\uBCC0 \uADDC\uCE59",
  rulesHelp: "\uB2F5\uBCC0 \uBC94\uC704\uC640 \uB9D0\uD22C, \uBAA8\uB97C \uB54C\uC758 \uB300\uC751, \uC0AC\uB78C\uC5D0\uAC8C \uB118\uAE38 \uC0C1\uD669\uC744 \uC815\uD558\uC138\uC694. \uC9C0\uCE68\uB9CC\uC73C\uB85C \uB2F5\uBCC0\uC758 \uC815\uD655\uC131\uC744 \uC644\uC804\uD788 \uBCF4\uC7A5\uD560 \uC218\uB294 \uC5C6\uC2B5\uB2C8\uB2E4.",
  enabled: "\uC0C1\uB2F4 \uC811\uC218",
  enabledHelp: "\uB044\uACE0 \uAC8C\uC2DC\uD558\uBA74 \uC0C8 \uC0C1\uB2F4\uC744 \uCC28\uB2E8\uD558\uACE0 \uC9C4\uD589 \uC911\uC778 \uC0C1\uB2F4\uB3C4 \uC885\uB8CC\uD569\uB2C8\uB2E4. \uBB38\uC758 \uB0A8\uAE30\uAE30\uB294 \uACC4\uC18D \uC0AC\uC6A9\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.",
  maxSeconds: "\uC0C1\uB2F4\uB2F9 \uCD5C\uB300 \uC2DC\uAC04",
  maxSecondsHelp: "\uC5F0\uACB0 \uC2DC\uAC04\uC744 \uD3EC\uD568\uD55C \uC0C1\uB2F4\uB2F9 \uC81C\uD55C \uC2DC\uAC04\uC785\uB2C8\uB2E4. \uB2E8\uC704: \uCD08.",
  maxConcurrent: "\uB3D9\uC2DC \uC0C1\uB2F4 \uC218",
  maxConcurrentHelp: "\uBAA8\uB4E0 \uC790\uB9AC\uAC00 \uC0AC\uC6A9 \uC911\uC774\uBA74 \uC0C8 \uBC29\uBB38\uC790\uC5D0\uAC8C \uB300\uAE30\uB97C \uC548\uB0B4\uD569\uB2C8\uB2E4.",
  dailySeconds: "\uC0AC\uC774\uD2B8 \uD558\uB8E8 \uC0AC\uC6A9 \uD55C\uB3C4",
  dailySecondsHelp: "\uBAA8\uB4E0 \uBC29\uBB38\uC790\uC758 \uC608\uC57D \uC2DC\uAC04\uC744 \uD569\uC0B0\uD569\uB2C8\uB2E4. UTC \uC790\uC815 \uAE30\uC900, \uB2E8\uC704: \uCD08.",
  dailyStarts: "\uBC29\uBB38\uC790\xB7IP\uBCC4 \uD558\uB8E8 \uC2DC\uC791 \uD69F\uC218",
  dailyStartsHelp: "\uB450 \uD55C\uB3C4\uB97C \uD568\uAED8 \uC801\uC6A9\uD569\uB2C8\uB2E4. \uAC19\uC740 \uB124\uD2B8\uC6CC\uD06C\uC758 \uBC29\uBB38\uC790\uB294 IP \uD55C\uB3C4\uB97C \uACF5\uC720\uD569\uB2C8\uB2E4.",
  cooldownSeconds: "\uB2E4\uC74C \uC0C1\uB2F4\uAE4C\uC9C0 \uB300\uAE30 \uC2DC\uAC04",
  cooldownSecondsHelp: "\uC5F0\uACB0 \uC2E4\uD328\uB97C \uD3EC\uD568\uD574 \uC0C1\uB2F4 \uC2DC\uC791 \uC0AC\uC774\uC5D0 \uD544\uC694\uD55C \uB300\uAE30 \uC2DC\uAC04\uC785\uB2C8\uB2E4. \uB2E8\uC704: \uCD08.",
  budgetHelp: "\uC2DC\uC791\uD560 \uB54C \uCD5C\uB300 \uC2DC\uAC04\uC744 \uC608\uC57D\uD558\uBA70 \uC870\uAE30 \uC885\uB8CC\uD574\uB3C4 \uBC18\uD658\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. \uAE30\uB85D\uC740 \uC11C\uBC84 \uC7AC\uC2DC\uC791 \uD6C4\uC5D0\uB3C4 \uC720\uC9C0\uB429\uB2C8\uB2E4. \uAE08\uC561 \uAE30\uC900\uC758 \uACFC\uAE08 \uC0C1\uD55C\uC740 \uC544\uB2D9\uB2C8\uB2E4.",
  turnstile: "Turnstile \uACF5\uAC1C \uC0AC\uC774\uD2B8 \uD0A4",
  turnstileHelp: "\uC120\uD0DD \uC0AC\uD56D\uC778 \uBD07 \uAC80\uC99D\uC785\uB2C8\uB2E4. \uACF5\uAC1C \uC0C1\uB2F4 \uD638\uC2A4\uD2B8\uB97C Cloudflare\uC5D0 \uB4F1\uB85D\uD558\uACE0 Agent settings\uC5D0 \uD574\uB2F9 \uBE44\uBC00 \uD0A4\uB97C \uC124\uC815\uD558\uC138\uC694. \uAC80\uC99D\uC5D0 \uC2E4\uD328\uD558\uBA74 \uC0C1\uB2F4\uC744 \uC2DC\uC791\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.",
  origins: "\uD5C8\uC6A9 \uD648\uD398\uC774\uC9C0 \uC8FC\uC18C",
  originsHelp: "https://example.com\uCC98\uB7FC \uD55C \uC904\uC5D0 \uD558\uB098\uC529 \uC785\uB825\uD558\uC138\uC694. www\uB294 \uBCC4\uB3C4\uB85C \uB4F1\uB85D\uD558\uBA70 \uACBD\uB85C\uB294 \uB123\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.",
  snippet: "\uD648\uD398\uC774\uC9C0 \uC0BD\uC785 \uCF54\uB4DC",
  snippetHelp: "\uAC8C\uC2DC \uD6C4 \uD648\uD398\uC774\uC9C0 \uACF5\uD1B5 HTML\uC758 body \uB2EB\uAE30 \uD0DC\uADF8 \uC55E\uC5D0 \uB123\uC73C\uC138\uC694. \uC74C\uC131 \uC0C1\uB2F4\uC5D0\uB294 HTTPS\uC640 \uB9C8\uC774\uD06C \uAD8C\uD55C\uC774 \uD544\uC694\uD569\uB2C8\uB2E4.",
  copy: "\uC0BD\uC785 \uCF54\uB4DC \uBCF5\uC0AC",
  copied: "\uC0BD\uC785 \uCF54\uB4DC\uB97C \uBCF5\uC0AC\uD588\uC2B5\uB2C8\uB2E4.",
  unpublishedHelp: "\uC0C1\uB2F4\uBD07\uC744 \uC800\uC7A5\uD558\uACE0 \uAC8C\uC2DC\uD558\uBA74 \uC0BD\uC785 \uCF54\uB4DC\uAC00 \uC0DD\uC131\uB429\uB2C8\uB2E4.",
  save: "\uCD08\uC548 \uC800\uC7A5",
  publish: "\uC800\uC7A5\uD558\uACE0 \uAC8C\uC2DC",
  saved: "\uCD08\uC548\uC744 \uC800\uC7A5\uD588\uC2B5\uB2C8\uB2E4. \uBC29\uBB38\uC790\uC5D0\uAC8C\uB294 \uAE30\uC874 \uAC8C\uC2DC \uBC84\uC804\uC774 \uC801\uC6A9\uB429\uB2C8\uB2E4.",
  published: "\uAC8C\uC2DC\uD588\uC2B5\uB2C8\uB2E4. \uC0C8 \uC0C1\uB2F4\uBD80\uD130 \uC801\uC6A9\uB429\uB2C8\uB2E4.",
  dirty: "\uAC8C\uC2DC\uD558\uC9C0 \uC54A\uC740 \uBCC0\uACBD",
  refreshing: "\uCC98\uB9AC \uC911\u2026",
  refresh: "\uC0C8\uB85C\uACE0\uCE68",
  refreshStatus: "\uC5F0\uACB0 \uC0C1\uD0DC \uC0C8\uB85C\uACE0\uCE68",
  inquiries: "\uC811\uC218 \uBB38\uC758",
  sessions: "\uCD5C\uADFC \uC0C1\uB2F4",
  noInquiries: "\uC544\uC9C1 \uC811\uC218\uB41C \uBB38\uC758\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4.",
  noSessions: "\uC544\uC9C1 \uC0C1\uB2F4 \uAE30\uB85D\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.",
  selectFirst: "\uC0C1\uB2F4\uBD07\uC744 \uBA3C\uC800 \uC800\uC7A5\uD558\uBA74 \uAE30\uB85D\uC744 \uBCFC \uC218 \uC788\uC2B5\uB2C8\uB2E4.",
  sessionSummary: "{0} \xB7 {1} \xB7 \uC608\uC57D {2}\uCD08 / \uC0AC\uC6A9 {3}\uCD08",
  active: "\uC0C1\uB2F4 \uC911",
  ended: "\uC885\uB8CC",
  interrupted: "\uC911\uB2E8",
  expired: "\uC2DC\uAC04 \uB9CC\uB8CC",
  paused: "\uC77C\uC2DC \uC911\uC9C0",
  disconnected: "\uC5F0\uACB0 \uD574\uC81C",
  errGeneric: "\uC694\uCCAD\uC744 \uCC98\uB9AC\uD558\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4. \uC5F0\uACB0\uC744 \uD655\uC778\uD558\uACE0 \uB2E4\uC2DC \uC2DC\uB3C4\uD558\uC138\uC694.",
  errBackend: "\uD50C\uB7EC\uADF8\uC778 \uBC31\uC5D4\uB4DC\uC5D0 \uC5F0\uACB0\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4. \uD604\uC7AC \uD504\uB85C\uD544\uC5D0\uC11C Hermes Consult\uC758 \uC5D0\uC774\uC804\uD2B8 \uAE30\uB2A5\uC744 \uD65C\uC131\uD654\uD558\uC138\uC694.",
  errScope: "\uD504\uB85C\uD544\uC774\uB098 \uC5F0\uACB0\uC774 \uBCC0\uACBD\uB418\uC5C8\uC2B5\uB2C8\uB2E4. \uD604\uC7AC \uC124\uC815 \uD654\uBA74\uC5D0\uC11C \uB2E4\uC2DC \uC2DC\uB3C4\uD558\uC138\uC694.",
  errInput: "\uC124\uC815\uC744 \uD655\uC778\uD558\uC138\uC694. \uC774\uB984\uACFC \uC62C\uBC14\uB978 \uD648\uD398\uC774\uC9C0 \uC8FC\uC18C\uAC00 \uD558\uB098 \uC774\uC0C1 \uD544\uC694\uD569\uB2C8\uB2E4.",
  errPort: "\uC774\uBBF8 \uC0AC\uC6A9 \uC911\uC778 \uD3EC\uD2B8\uC785\uB2C8\uB2E4. \uB2E4\uB978 \uD3EC\uD2B8\uB97C \uC120\uD0DD\uD558\uC138\uC694.",
  errRuntime: "Node.js 24 \uC774\uC0C1\uACFC \uBE4C\uB4DC\uB41C \uD50C\uB7EC\uADF8\uC778 \uD328\uD0A4\uC9C0\uAC00 \uD544\uC694\uD569\uB2C8\uB2E4.",
  errLive: "\uC0C1\uB2F4 \uC74C\uC131 \uC5F0\uB3D9\uC744 \uC9C0\uC6D0\uD558\uB294 Hermes Live \uBC84\uC804\uC744 \uC124\uCE58\uD558\uC138\uC694.",
  errLimit: "\uC0AC\uC6A9\uB7C9 \uD55C\uB3C4\uC5D0 \uB3C4\uB2EC\uD588\uC2B5\uB2C8\uB2E4. \uC7A0\uC2DC \uD6C4 \uB2E4\uC2DC \uC2DC\uB3C4\uD558\uC138\uC694.",
  errFile: "\uCD5C\uB300 40,000\uC790\uC758 TXT \uB610\uB294 Markdown \uD30C\uC77C\uC744 \uC120\uD0DD\uD558\uC138\uC694.",
  errOrigin: "\uACBD\uB85C \uC5C6\uB294 \uACF5\uAC1C HTTPS \uC8FC\uC18C\uB97C \uC785\uB825\uD558\uC138\uC694.",
  errStart: "\uC0C1\uB2F4 \uC11C\uBC84\uB97C \uC2DC\uC791\uD558\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4. Node.js \uBC84\uC804\uACFC \uC124\uCE58 \uC0C1\uD0DC\uB97C \uD655\uC778\uD558\uC138\uC694.",
  errNotRunning: "\uC0C1\uB2F4 \uC11C\uBC84\uB97C \uBA3C\uC800 \uC2DC\uC791\uD558\uC138\uC694.",
  errNotFound: "\uC0C1\uB2F4\uBD07\uC744 \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4. \uC0C8\uB85C \uACE0\uCE5C \uB4A4 \uB2E4\uC2DC \uC2DC\uB3C4\uD558\uC138\uC694.",
  errConflict: "\uC0C1\uB2F4\uBD07 \uAC1C\uC218 \uD55C\uB3C4 \uB4F1 \uD604\uC7AC \uC0C1\uD0DC\uC640 \uCDA9\uB3CC\uD558\uB294 \uC694\uCCAD\uC785\uB2C8\uB2E4. \uC0C8\uB85C \uACE0\uCE5C \uB4A4 \uB2E4\uC2DC \uC2DC\uB3C4\uD558\uC138\uC694.",
  errLlm: "Hermes \uD50C\uB7EC\uADF8\uC778 LLM \uC5F0\uACB0\uC744 \uC0AC\uC6A9\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4. \uD50C\uB7EC\uADF8\uC778\uC744 \uD65C\uC131\uD654\uD558\uACE0 Hermes\uB97C \uB2E4\uC2DC \uC2DC\uC791\uD558\uC138\uC694.",
  errLiveVersion: "\uC774 Hermes Live \uBC84\uC804\uC758 \uC0C1\uB2F4 API\uB294 \uC9C0\uC6D0\uB418\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. Hermes Live\uB97C \uC5C5\uB370\uC774\uD2B8\uD558\uC138\uC694.",
  language: "\uB2F5\uBCC0 \uC5B8\uC5B4",
  languageHelp: "\uAE00\uACFC \uC74C\uC131 \uB2F5\uBCC0\uC758 \uC5B8\uC5B4\uC785\uB2C8\uB2E4. \uC790\uB3D9\uC740 \uD648\uD398\uC774\uC9C0 \uD398\uC774\uC9C0 \uC5B8\uC5B4\uB97C \uB530\uB974\uBA70, \uB2E4\uB978 \uC5B8\uC5B4\uB97C \uC4F0\uB294 \uBC29\uBB38\uC790\uC5D0\uAC8C\uB294 \uADF8 \uC5B8\uC5B4\uB85C \uB2F5\uD569\uB2C8\uB2E4.",
  languageAuto: "\uC790\uB3D9 (\uD398\uC774\uC9C0 \uC5B8\uC5B4)",
  defaultName: "\uD648\uD398\uC774\uC9C0 \uC0C1\uB2F4\uC6D0",
  defaultGreeting: "\uC548\uB155\uD558\uC138\uC694. AI \uC0C1\uB2F4\uC6D0\uC785\uB2C8\uB2E4. \uBB34\uC5C7\uC744 \uB3C4\uC640\uB4DC\uB9B4\uAE4C\uC694?",
  defaultRules: "\uAC8C\uC2DC\uB41C \uC790\uB8CC\uC5D0 \uADFC\uAC70\uD574 \uB2F5\uD558\uC138\uC694. \uBAA8\uB974\uBA74 \uBB38\uC758 \uC811\uC218\uB97C \uC548\uB0B4\uD558\uC138\uC694. \uACB0\uC81C\xB7\uD658\uBD88\xB7\uC608\uC57D\uC744 \uD655\uC815\uD558\uC9C0 \uB9C8\uC138\uC694.",
  setup: "\uC124\uCE58 \uC21C\uC11C",
  setupHelp: "1. \uC11C\uBC84 \uC5F0\uACB0  \xB7  2. \uC790\uB8CC\uC640 \uD55C\uB3C4 \uC124\uC815  \xB7  3. \uAC8C\uC2DC \uD6C4 \uD648\uD398\uC774\uC9C0 \uC0BD\uC785",
  unsavedNew: "\uC0C8 \uC0C1\uB2F4\uBD07 \xB7 \uC800\uC7A5 \uC804",
  privacy: "\uC0C1\uB2F4 \uC11C\uBC84\uB294 \uC74C\uC131\uACFC \uC9C8\uBB38 \uB0B4\uC6A9\uC744 \uBCF4\uAD00\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. \uBB38\uC758\uC640 \uC0AC\uC6A9 \uAE30\uB85D\uC740 30\uC77C\uAC04 \uBCF4\uAD00\uD569\uB2C8\uB2E4."
};
var bundles = { en, ko };
function interpolate(message, ...values) {
  return message.replace(
    /\{(\d+)\}/g,
    (_, n) => String(values[Number(n)] ?? "")
  );
}
function errorKey(error) {
  const message = error instanceof Error ? error.message : String(error);
  const key = /(?:^|[^A-Za-z])HC:([A-Za-z]+)/.exec(message)?.[1];
  if (key) return key in en ? key : "errGeneric";
  if (/404|503|fetch|backend|ECONN/i.test(message)) return "errBackend";
  return "errGeneric";
}

// desktop/source.tsx
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
var tabs = [
  "connection",
  "bot",
  "knowledge",
  "protection",
  "install",
  "activity"
];
var defaults = (t) => ({
  turnstileSiteKey: "",
  name: t("defaultName"),
  greeting: t("defaultGreeting"),
  origins: [],
  engine: "subscription",
  language: "auto",
  rules: t("defaultRules"),
  knowledge: "",
  maxSeconds: 180,
  maxConcurrent: 1,
  dailySeconds: 1800,
  dailyStarts: 3,
  cooldownSeconds: 60,
  enabled: true
});
var languages = [
  ["en", "English"],
  ["ko", "\uD55C\uAD6D\uC5B4"],
  ["ja", "\u65E5\u672C\u8A9E"],
  ["zh", "\u4E2D\u6587"],
  ["es", "Espa\xF1ol"],
  ["fr", "Fran\xE7ais"],
  ["de", "Deutsch"],
  ["pt", "Portugu\xEAs"]
];
var muted = {
  color: "var(--ui-text-tertiary)",
  fontSize: "var(--conversation-caption-font-size)",
  lineHeight: "var(--conversation-caption-line-height)",
  margin: 0
};
var divider = "1px solid var(--ui-stroke-secondary)";
var controlWidth = { width: "min(100%, 22rem)" };
function Choice({
  label,
  value,
  options,
  onChange,
  disabled = false
}) {
  return /* @__PURE__ */ jsxs(Select, { value, onValueChange: onChange, disabled, children: [
    /* @__PURE__ */ jsx(SelectTrigger, { "aria-label": label, style: controlWidth, children: /* @__PURE__ */ jsx(SelectValue, {}) }),
    /* @__PURE__ */ jsx(SelectContent, { children: options.map((o) => /* @__PURE__ */ jsx(SelectItem, { value: o.id, children: o.label }, o.id)) })
  ] });
}
var source_default = {
  id: "hermes-consult",
  name: "hermes-consult",
  version: "0.2.3",
  description: "Website voice consultations",
  defaultEnabled: false,
  register(ctx) {
    ctx.i18n.register(bundles);
    function Panel() {
      const profile = useSyncExternalStore(
        (fn) => host.state.profile.subscribe(fn),
        () => host.state.profile.get()
      );
      const connection = useSyncExternalStore(
        (fn) => host.state.connectionId.subscribe(fn),
        () => host.state.connectionId.get()
      );
      return /* @__PURE__ */ jsx(Settings, {}, `${connection}:${profile}`);
    }
    function Settings() {
      const { locale } = useI18n(), translate = usePluginI18n("hermes-consult");
      const t = (key, ...values) => interpolate(translate(key), ...values);
      const scope = useRef([
        host.state.connectionId.get(),
        host.state.profile.get()
      ]);
      const active = useRef(true), sequence = useRef(0);
      const rest = (path, options) => {
        if (!active.current || scope.current[0] !== host.state.connectionId.get() || scope.current[1] !== host.state.profile.get())
          return Promise.reject(Error("HC:errScope"));
        return ctx.rest(path, options);
      };
      const [status, setStatus] = useState({
        running: false,
        publicOrigin: "",
        port: 4318,
        subscription: true
      });
      const [sites, setSites] = useState([]), [site, setSite] = useState(null), [draft, setDraft] = useState(() => defaults(t));
      const [tab, setTab] = useState("connection"), [notice, setNotice] = useState(null), [isError, setIsError] = useState(false), [busy, setBusy] = useState(false), [activity, setActivity] = useState(null);
      const dirty = site ? JSON.stringify(draft) !== JSON.stringify({ ...defaults(t), ...site.draft }) : true;
      const control = (path, body, method = body ? "POST" : "GET") => rest("/control", {
        method: "POST",
        body: { path, method, body },
        timeoutMs: 3e4
      });
      const run = async (fn) => {
        setBusy(true);
        setNotice(null);
        setIsError(false);
        try {
          await fn();
        } catch (e) {
          if (active.current) {
            setNotice(errorKey(e));
            setIsError(true);
          }
        } finally {
          if (active.current) setBusy(false);
        }
      };
      const choose = (s) => {
        setSite(s);
        setDraft({ ...defaults(t), ...s.draft });
        setActivity(null);
      };
      const refresh = async () => {
        const list = await control("/api/sites");
        if (active.current) setSites(list);
        return list;
      };
      const refreshStatus = async () => {
        const value = await rest("/status");
        if (!active.current) return;
        setStatus(value);
        if (value.running) {
          const list = await refresh();
          if (!site && list[0]) choose(list[0]);
        }
      };
      useEffect(() => {
        active.current = true;
        const id = ++sequence.current;
        rest("/status").then(async (value) => {
          if (!active.current || id !== sequence.current) return;
          setStatus(value);
          if (value.running) {
            const list = await control("/api/sites");
            if (active.current && id === sequence.current) {
              setSites(list);
              if (list[0]) choose(list[0]);
              setTab("bot");
            }
          }
        }).catch(() => {
          if (active.current) {
            setNotice("errBackend");
            setIsError(true);
          }
        });
        return () => {
          active.current = false;
          ++sequence.current;
        };
      }, []);
      const save = async (publish) => {
        const config = {
          ...draft,
          origins: draft.origins.map((s) => s.trim()).filter(Boolean)
        };
        let selected = site;
        if (selected) await control(`/api/sites/${selected.id}`, config, "PUT");
        else {
          selected = await control("/api/sites", config);
          if (active.current) setSite(selected);
        }
        if (publish) await control(`/api/sites/${selected.id}/publish`, {});
        const list = await refresh();
        if (!active.current) return;
        choose(list.find((s) => s.id === selected.id));
        setNotice(publish ? "published" : "saved");
      };
      const textRow = (key, title, description, rows = 0) => /* @__PURE__ */ jsx(
        ListRow,
        {
          title: t(title),
          description: description ? t(description) : void 0,
          wide: rows > 0,
          action: rows ? void 0 : /* @__PURE__ */ jsx(
            Input,
            {
              "aria-label": t(title),
              value: draft[key],
              style: controlWidth,
              onChange: (e) => setDraft({ ...draft, [key]: e.target.value })
            }
          ),
          below: rows ? /* @__PURE__ */ jsx(
            Textarea,
            {
              "aria-label": t(title),
              rows,
              value: draft[key],
              style: { width: "100%", marginTop: 12, resize: "vertical" },
              maxLength: key === "knowledge" ? 4e4 : key === "rules" ? 6e3 : 500,
              onChange: (e) => setDraft({ ...draft, [key]: e.target.value })
            }
          ) : void 0
        }
      );
      const footer = tab !== "connection" && tab !== "activity" && status.running;
      return /* @__PURE__ */ jsxs(
        "section",
        {
          lang: locale,
          style: {
            maxWidth: 960,
            minWidth: 0,
            paddingBlock: 12,
            fontSize: "var(--conversation-text-font-size)"
          },
          children: [
            /* @__PURE__ */ jsxs(
              "div",
              {
                style: {
                  display: "flex",
                  alignItems: "start",
                  justifyContent: "space-between",
                  gap: 16,
                  marginBottom: 16
                },
                children: [
                  /* @__PURE__ */ jsxs("div", { style: { display: "grid", gap: 6 }, children: [
                    /* @__PURE__ */ jsx("p", { style: { margin: 0 }, children: t("subtitle") }),
                    /* @__PURE__ */ jsx("p", { style: muted, children: t("setupHelp") })
                  ] }),
                  /* @__PURE__ */ jsx(Badge, { variant: status.running ? "success" : "muted", children: t(status.running ? "running" : "stopped") })
                ]
              }
            ),
            /* @__PURE__ */ jsx(
              "div",
              {
                style: {
                  overflowX: "auto",
                  paddingBottom: 12,
                  borderBottom: divider
                },
                children: /* @__PURE__ */ jsx(
                  SegmentedControl,
                  {
                    value: tab,
                    onChange: setTab,
                    options: tabs.map((id) => ({ id, label: t(id) })),
                    disabled: busy
                  }
                )
              }
            ),
            status.running && tab !== "connection" && /* @__PURE__ */ jsxs(
              "div",
              {
                role: "group",
                "aria-label": t("assistant"),
                style: {
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  flexWrap: "wrap",
                  paddingBlock: 16,
                  borderBottom: divider
                },
                children: [
                  /* @__PURE__ */ jsx(
                    Choice,
                    {
                      label: t("assistant"),
                      value: site?.id ?? "new",
                      options: [
                        { id: "new", label: t("newAssistant") },
                        ...sites.map((s) => ({ id: s.id, label: s.draft.name }))
                      ],
                      onChange: (id) => {
                        const s = sites.find((s2) => s2.id === id);
                        if (s) choose(s);
                        else {
                          setSite(null);
                          setDraft(defaults(t));
                          setActivity(null);
                        }
                      },
                      disabled: busy
                    }
                  ),
                  /* @__PURE__ */ jsx(
                    Button,
                    {
                      variant: "outline",
                      disabled: busy,
                      onClick: () => {
                        setSite(null);
                        setDraft(defaults(t));
                        setActivity(null);
                        setTab("bot");
                      },
                      children: t("newAssistant")
                    }
                  ),
                  /* @__PURE__ */ jsx("span", { style: muted, children: site ? t("revision", site.revision) : t("unsavedNew") })
                ]
              }
            ),
            /* @__PURE__ */ jsxs(
              "fieldset",
              {
                disabled: busy,
                style: { border: 0, padding: 0, minWidth: 0, margin: 0 },
                children: [
                  tab === "connection" ? /* @__PURE__ */ jsxs(Fragment, { children: [
                    /* @__PURE__ */ jsx(
                      ListRow,
                      {
                        title: t("publicOrigin"),
                        description: t("publicOriginHelp"),
                        action: /* @__PURE__ */ jsx(
                          Input,
                          {
                            "aria-label": t("publicOrigin"),
                            placeholder: "https://consult.example.com",
                            style: controlWidth,
                            disabled: status.running,
                            value: status.publicOrigin,
                            onChange: (e) => setStatus({
                              ...status,
                              publicOrigin: e.target.value.trim()
                            })
                          }
                        )
                      }
                    ),
                    /* @__PURE__ */ jsx(
                      ListRow,
                      {
                        title: t("port"),
                        description: t("portHelp"),
                        action: /* @__PURE__ */ jsx(
                          Input,
                          {
                            "aria-label": t("port"),
                            type: "number",
                            min: 1024,
                            max: 65535,
                            style: { width: 120 },
                            disabled: status.running,
                            value: status.port,
                            onChange: (e) => setStatus({ ...status, port: Number(e.target.value) })
                          }
                        )
                      }
                    ),
                    /* @__PURE__ */ jsx(
                      ToggleRow,
                      {
                        label: t("subscription"),
                        description: t("subscriptionHelp"),
                        disabled: status.running,
                        checked: status.subscription,
                        onChange: (subscription) => setStatus({ ...status, subscription })
                      }
                    ),
                    /* @__PURE__ */ jsx(ListRow, { title: t("keys"), description: t("keysHelp") }),
                    /* @__PURE__ */ jsx(
                      ListRow,
                      {
                        title: t(status.running ? "running" : "stopped"),
                        description: t("stopHelp"),
                        action: /* @__PURE__ */ jsxs("div", { style: { display: "flex", gap: 8, flexWrap: "wrap" }, children: [
                          /* @__PURE__ */ jsx(
                            Button,
                            {
                              variant: "outline",
                              onClick: () => void run(refreshStatus),
                              children: t("refreshStatus")
                            }
                          ),
                          /* @__PURE__ */ jsx(
                            Button,
                            {
                              variant: status.running ? "destructive" : "default",
                              onClick: () => void run(async () => {
                                const value = await rest(
                                  status.running ? "/stop" : "/start",
                                  {
                                    method: "POST",
                                    body: status.running ? {} : status,
                                    timeoutMs: 6e4
                                  }
                                );
                                if (!active.current) return;
                                setStatus(value);
                                if (value.running) {
                                  const list = await refresh();
                                  if (!site && list[0]) choose(list[0]);
                                }
                              }),
                              children: t(status.running ? "stopServer" : "startServer")
                            }
                          )
                        ] })
                      }
                    )
                  ] }) : !status.running ? /* @__PURE__ */ jsx(
                    ListRow,
                    {
                      title: t("serverRequired"),
                      action: /* @__PURE__ */ jsx(Button, { onClick: () => setTab("connection"), children: t("openConnection") })
                    }
                  ) : /* @__PURE__ */ jsx(Fragment, { children: /* @__PURE__ */ jsxs("div", { style: { borderTop: divider }, children: [
                    tab === "bot" && /* @__PURE__ */ jsxs(Fragment, { children: [
                      textRow("name", "name"),
                      textRow("greeting", "greeting", void 0, 3),
                      /* @__PURE__ */ jsx(
                        ListRow,
                        {
                          title: t("engine"),
                          description: t("engineHelp"),
                          action: /* @__PURE__ */ jsx(
                            Choice,
                            {
                              label: t("engine"),
                              value: draft.engine,
                              options: [
                                {
                                  id: "subscription",
                                  label: t("subscriptionEngine")
                                },
                                { id: "api", label: t("api") }
                              ],
                              onChange: (engine) => setDraft({ ...draft, engine })
                            }
                          )
                        }
                      ),
                      /* @__PURE__ */ jsx(
                        ListRow,
                        {
                          title: t("language"),
                          description: t("languageHelp"),
                          action: /* @__PURE__ */ jsx(
                            Choice,
                            {
                              label: t("language"),
                              value: draft.language,
                              options: [
                                { id: "auto", label: t("languageAuto") },
                                ...languages.map(([id, label]) => ({ id, label }))
                              ],
                              onChange: (language) => setDraft({ ...draft, language })
                            }
                          )
                        }
                      ),
                      /* @__PURE__ */ jsx(Badge, { variant: site?.online ? "success" : "muted", children: t(site?.online ? "connected" : "offline") })
                    ] }),
                    tab === "knowledge" && /* @__PURE__ */ jsxs(Fragment, { children: [
                      textRow("knowledge", "source", "sourceHelp", 12),
                      /* @__PURE__ */ jsx(
                        Input,
                        {
                          type: "file",
                          "aria-label": t("importFile"),
                          accept: ".txt,.md,text/plain,text/markdown",
                          onChange: (e) => {
                            const f = e.target.files?.[0];
                            if (f)
                              void run(async () => {
                                if (f.size > 16e4) throw Error("HC:errFile");
                                const text = await f.text();
                                if (text.length > 4e4)
                                  throw Error("HC:errFile");
                                if (active.current)
                                  setDraft({ ...draft, knowledge: text });
                              });
                          }
                        }
                      ),
                      textRow("rules", "rules", "rulesHelp", 6)
                    ] }),
                    tab === "protection" && /* @__PURE__ */ jsxs(Fragment, { children: [
                      /* @__PURE__ */ jsx(
                        ToggleRow,
                        {
                          label: t("enabled"),
                          description: t("enabledHelp"),
                          checked: draft.enabled,
                          onChange: (enabled) => setDraft({ ...draft, enabled })
                        }
                      ),
                      [
                        ["maxSeconds", 30, 600],
                        ["maxConcurrent", 1, 5],
                        ["dailySeconds", 60, 86400],
                        ["dailyStarts", 1, 100],
                        ["cooldownSeconds", 0, 3600]
                      ].map(([key, min, max]) => /* @__PURE__ */ jsx(
                        ListRow,
                        {
                          title: t(key),
                          description: t(`${key}Help`),
                          action: /* @__PURE__ */ jsx(
                            Input,
                            {
                              "aria-label": t(key),
                              type: "number",
                              style: { width: 120 },
                              min,
                              max,
                              value: draft[key],
                              onChange: (e) => setDraft({
                                ...draft,
                                [key]: Number(e.target.value)
                              })
                            }
                          )
                        },
                        key
                      )),
                      /* @__PURE__ */ jsx("p", { style: { ...muted, paddingBlock: 12 }, children: t("budgetHelp") }),
                      textRow(
                        "turnstileSiteKey",
                        "turnstile",
                        "turnstileHelp"
                      )
                    ] }),
                    tab === "install" && /* @__PURE__ */ jsxs(Fragment, { children: [
                      /* @__PURE__ */ jsx(
                        ListRow,
                        {
                          title: t("origins"),
                          description: t("originsHelp"),
                          wide: true,
                          below: /* @__PURE__ */ jsx(
                            Textarea,
                            {
                              "aria-label": t("origins"),
                              rows: 4,
                              style: { width: "100%", marginTop: 12 },
                              placeholder: "https://example.com",
                              value: draft.origins.join("\n"),
                              onChange: (e) => setDraft({
                                ...draft,
                                origins: e.target.value.split("\n")
                              })
                            }
                          )
                        }
                      ),
                      /* @__PURE__ */ jsx(
                        ListRow,
                        {
                          title: t("snippet"),
                          description: t("snippetHelp"),
                          wide: true,
                          action: site?.published ? /* @__PURE__ */ jsx(
                            Button,
                            {
                              variant: "outline",
                              onClick: () => void run(async () => {
                                await navigator.clipboard.writeText(
                                  site.snippet
                                );
                                setNotice("copied");
                              }),
                              children: t("copy")
                            }
                          ) : void 0,
                          below: site?.published ? /* @__PURE__ */ jsx(
                            Textarea,
                            {
                              "aria-label": t("snippet"),
                              readOnly: true,
                              rows: 3,
                              value: site.snippet,
                              style: {
                                marginTop: 12,
                                width: "100%",
                                fontFamily: "var(--font-mono)"
                              }
                            }
                          ) : /* @__PURE__ */ jsx("p", { style: { ...muted, marginTop: 12 }, children: t("unpublishedHelp") })
                        }
                      )
                    ] }),
                    tab === "activity" && /* @__PURE__ */ jsxs(Fragment, { children: [
                      /* @__PURE__ */ jsx(
                        ListRow,
                        {
                          title: t("activity"),
                          description: t("privacy"),
                          action: /* @__PURE__ */ jsx(
                            Button,
                            {
                              variant: "outline",
                              disabled: !site,
                              onClick: () => void run(async () => {
                                const result = await control(
                                  `/api/sites/${site.id}/activity`
                                );
                                if (active.current) setActivity(result);
                              }),
                              children: t("refresh")
                            }
                          )
                        }
                      ),
                      !site ? /* @__PURE__ */ jsx("p", { style: muted, children: t("selectFirst") }) : activity && /* @__PURE__ */ jsxs(Fragment, { children: [
                        /* @__PURE__ */ jsx(
                          ListRow,
                          {
                            title: t("inquiries"),
                            wide: true,
                            below: /* @__PURE__ */ jsx("div", { children: activity.leads.length ? activity.leads.map((l) => /* @__PURE__ */ jsx(
                              ListRow,
                              {
                                title: l.name,
                                description: l.contact,
                                below: /* @__PURE__ */ jsx(
                                  "p",
                                  {
                                    style: {
                                      whiteSpace: "pre-wrap",
                                      overflowWrap: "anywhere"
                                    },
                                    children: l.message
                                  }
                                )
                              },
                              l.id
                            )) : /* @__PURE__ */ jsx("p", { style: muted, children: t("noInquiries") }) })
                          }
                        ),
                        /* @__PURE__ */ jsx(
                          ListRow,
                          {
                            title: t("sessions"),
                            wide: true,
                            below: /* @__PURE__ */ jsx("div", { children: activity.sessions.length ? activity.sessions.map((s) => /* @__PURE__ */ jsx("p", { style: muted, children: t(
                              "sessionSummary",
                              new Date(s.started).toLocaleString(
                                locale
                              ),
                              t(s.status),
                              s.reserved,
                              s.used
                            ) }, s.id)) : /* @__PURE__ */ jsx("p", { style: muted, children: t("noSessions") }) })
                          }
                        )
                      ] })
                    ] })
                  ] }) }),
                  footer && /* @__PURE__ */ jsxs(
                    "div",
                    {
                      style: {
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        flexWrap: "wrap",
                        paddingTop: 16,
                        marginTop: 16,
                        borderTop: divider
                      },
                      children: [
                        /* @__PURE__ */ jsx(
                          Button,
                          {
                            variant: "outline",
                            onClick: () => void run(() => save(false)),
                            children: t("save")
                          }
                        ),
                        /* @__PURE__ */ jsx(Button, { onClick: () => void run(() => save(true)), children: t("publish") }),
                        dirty && /* @__PURE__ */ jsx("span", { style: muted, children: t("dirty") })
                      ]
                    }
                  )
                ]
              }
            ),
            /* @__PURE__ */ jsx(
              "div",
              {
                role: isError ? "alert" : "status",
                "aria-live": "polite",
                style: {
                  ...muted,
                  minHeight: 24,
                  paddingTop: 12,
                  color: isError ? "var(--destructive)" : void 0
                },
                children: busy ? t("refreshing") : notice ? t(notice) : ""
              }
            )
          ]
        }
      );
    }
    const registerPage = () => ctx.registerSettingsPage({
      id: "settings",
      title: "hermes-consult",
      icon: "comment-discussion",
      render: () => /* @__PURE__ */ jsx(Panel, {})
    });
    let dispose = registerPage();
    ctx.i18n.onLocaleChange(() => {
      dispose();
      dispose = registerPage();
    });
    ctx.onDispose(() => dispose());
  }
};
export {
  source_default as default
};
