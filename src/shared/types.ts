// ─── Claude Code Stream Event Types (verified from v2.1.63) ───

export interface InitEvent {
  type: 'system'
  subtype: 'init'
  cwd: string
  session_id: string
  tools: string[]
  mcp_servers: Array<{ name: string; status: string }>
  model: string
  permissionMode: string
  agents: string[]
  skills: string[]
  plugins: string[]
  claude_code_version: string
  fast_mode_state: string
  uuid: string
}

export interface StreamEvent {
  type: 'stream_event'
  event: StreamSubEvent
  session_id: string
  parent_tool_use_id: string | null
  uuid: string
}

export type StreamSubEvent =
  | { type: 'message_start'; message: AssistantMessagePayload }
  | { type: 'content_block_start'; index: number; content_block: ContentBlock }
  | { type: 'content_block_delta'; index: number; delta: ContentDelta }
  | { type: 'content_block_stop'; index: number }
  | { type: 'message_delta'; delta: { stop_reason: string | null }; usage: UsageData; context_management?: unknown }
  | { type: 'message_stop' }

export interface ContentBlock {
  type: 'text' | 'tool_use'
  text?: string
  id?: string
  name?: string
  input?: Record<string, unknown>
}

export type ContentDelta =
  | { type: 'text_delta'; text: string }
  | { type: 'input_json_delta'; partial_json: string }

export interface AssistantEvent {
  type: 'assistant'
  message: AssistantMessagePayload
  parent_tool_use_id: string | null
  session_id: string
  uuid: string
}

export interface AssistantMessagePayload {
  model: string
  id: string
  role: 'assistant'
  content: ContentBlock[]
  stop_reason: string | null
  usage: UsageData
}

export interface RateLimitEvent {
  type: 'rate_limit_event'
  rate_limit_info: {
    status: string
    resetsAt: number
    rateLimitType: string
  }
  session_id: string
  uuid: string
}

export interface ResultEvent {
  type: 'result'
  subtype: 'success' | 'error'
  is_error: boolean
  duration_ms: number
  num_turns: number
  result: string
  total_cost_usd: number
  session_id: string
  usage: UsageData & {
    input_tokens: number
    output_tokens: number
    cache_read_input_tokens?: number
    cache_creation_input_tokens?: number
  }
  permission_denials: string[]
  uuid: string
}

export interface UsageData {
  input_tokens?: number
  output_tokens?: number
  cache_read_input_tokens?: number
  cache_creation_input_tokens?: number
  service_tier?: string
}

export interface PermissionEvent {
  type: 'permission_request'
  tool: { name: string; description?: string; input?: Record<string, unknown> }
  question_id: string
  options: Array<{ id: string; label: string; kind?: string }>
  session_id: string
  uuid: string
}

// Union of all possible top-level events
export type ClaudeEvent = InitEvent | StreamEvent | AssistantEvent | RateLimitEvent | ResultEvent | PermissionEvent | UnknownEvent

export interface UnknownEvent {
  type: string
  [key: string]: unknown
}

// ─── Backend Types ───

export type BackendType = 'claude' | 'codex'

// ─── Tab State Machine (v2 — from execution plan) ───

export type TabStatus = 'connecting' | 'idle' | 'running' | 'completed' | 'failed' | 'dead'

export interface PermissionRequest {
  questionId: string
  toolTitle: string
  toolDescription?: string
  toolInput?: Record<string, unknown>
  options: Array<{ optionId: string; kind?: string; label: string }>
}

export interface Attachment {
  id: string
  type: 'image' | 'file'
  name: string
  path: string
  mimeType?: string
  /** Base64 data URL for image previews */
  dataUrl?: string
  /** File size in bytes */
  size?: number
}

export interface TabState {
  id: string
  backend: BackendType
  claudeSessionId: string | null
  status: TabStatus
  activeRequestId: string | null
  hasUnread: boolean
  currentActivity: string
  permissionQueue: PermissionRequest[]
  /** Fallback card when tools were denied and no interactive permission is available */
  permissionDenied: { tools: Array<{ toolName: string; toolUseId: string }> } | null
  attachments: Attachment[]
  messages: Message[]
  title: string
  /** Last run's result data (cost, tokens, duration) */
  lastResult: RunResult | null
  /** Session metadata from init event */
  sessionModel: string | null
  sessionTools: string[]
  sessionMcpServers: Array<{ name: string; status: string }>
  sessionSkills: string[]
  sessionVersion: string | null
  /** Prompts waiting behind the current run (display text only) */
  queuedPrompts: string[]
  /** Working directory for this tab's Claude sessions */
  workingDirectory: string
  /** Whether the user explicitly chose a directory (vs. using default home) */
  hasChosenDirectory: boolean
  /** Extra directories accessible via --add-dir (session-preserving) */
  additionalDirs: string[]
  /** User's preferred model override for this tab (null = use default) */
  preferredModel: string | null
}

export interface Message {
  id: string
  role: 'user' | 'assistant' | 'tool' | 'system'
  content: string
  toolName?: string
  toolInput?: string
  toolStatus?: 'running' | 'completed' | 'error'
  timestamp: number
}

export interface RunResult {
  totalCostUsd: number
  durationMs: number
  numTurns: number
  usage: UsageData
  sessionId: string
}

// ─── Canonical Events (normalized from raw stream) ───

export type NormalizedEvent =
  | { type: 'session_init'; sessionId: string; tools: string[]; model: string; mcpServers: Array<{ name: string; status: string }>; skills: string[]; version: string; isWarmup?: boolean }
  | { type: 'text_chunk'; text: string }
  | { type: 'tool_call'; toolName: string; toolId: string; index: number }
  | { type: 'tool_call_update'; toolId: string; partialInput: string }
  | { type: 'tool_call_complete'; index: number }
  | { type: 'task_update'; message: AssistantMessagePayload }
  | { type: 'task_complete'; result: string; costUsd: number; durationMs: number; numTurns: number; usage: UsageData; sessionId: string; permissionDenials?: Array<{ toolName: string; toolUseId: string }> }
  | { type: 'error'; message: string; isError: boolean; sessionId?: string }
  | { type: 'session_dead'; exitCode: number | null; signal: string | null; stderrTail: string[] }
  | { type: 'rate_limit'; status: string; resetsAt: number; rateLimitType: string }
  | { type: 'usage'; usage: UsageData }
  | { type: 'permission_request'; questionId: string; toolName: string; toolDescription?: string; toolInput?: Record<string, unknown>; options: Array<{ id: string; label: string; kind?: string }> }

// ─── Run Options ───

export interface RunOptions {
  prompt: string
  projectPath: string
  sessionId?: string
  allowedTools?: string[]
  maxTurns?: number
  maxBudgetUsd?: number
  systemPrompt?: string
  model?: string
  /** Path to Orbiter-scoped settings file with hook config (passed via --settings) */
  hookSettingsPath?: string
  /** Extra directories to add via --add-dir (session-preserving) */
  addDirs?: string[]
  /** Which backend to use for this run */
  backend?: BackendType
}

// ─── Control Plane Types ───

export interface TabRegistryEntry {
  tabId: string
  backend: BackendType
  claudeSessionId: string | null
  status: TabStatus
  activeRequestId: string | null
  runPid: number | null
  createdAt: number
  lastActivityAt: number
  promptCount: number
}

export interface HealthReport {
  tabs: Array<{
    tabId: string
    status: TabStatus
    activeRequestId: string | null
    claudeSessionId: string | null
    alive: boolean
  }>
  queueDepth: number
}

export interface EnrichedError {
  message: string
  stderrTail: string[]
  stdoutTail?: string[]
  exitCode: number | null
  elapsedMs: number
  toolCallCount: number
  sawPermissionRequest?: boolean
  permissionDenials?: Array<{ tool_name: string; tool_use_id: string }>
}

// ─── Session History ───

export interface SessionMeta {
  sessionId: string
  slug: string | null
  firstMessage: string | null
  lastTimestamp: string
  size: number
}

export interface SessionLoadMessage {
  role: string
  content: string
  toolName?: string
  timestamp: number
}

// ─── Marketplace / Plugin Types ───

export type PluginStatus = 'not_installed' | 'checking' | 'installing' | 'installed' | 'failed'

export interface CatalogPlugin {
  id: string              // unique: `${repo}/${skillPath}` e.g. 'anthropics/skills/skills/xlsx'
  name: string            // from SKILL.md or plugin.json
  description: string     // from SKILL.md or plugin.json
  version: string         // from plugin.json or '0.0.0'
  author: string          // from plugin.json or marketplace entry
  marketplace: string     // marketplace name from marketplace.json
  repo: string            // 'anthropics/skills'
  sourcePath: string      // path within repo, e.g. 'skills/xlsx'
  installName: string     // individual skill name for SKILL.md skills, bundle name for CLI plugins
  category: string        // 'Agent Skills' | 'Knowledge Work' | 'Financial Services'
  tags: string[]          // Semantic use-case tags derived from name/description (e.g. 'Design', 'Finance')
  isSkillMd: boolean      // true = individual SKILL.md (direct install), false = CLI plugin (bundle install)
}

// ─── IPC Channel Names ───

export const IPC = {
  // Request-response (renderer → main)
  START: 'orbiter:start',
  CREATE_TAB: 'orbiter:create-tab',
  PROMPT: 'orbiter:prompt',
  CANCEL: 'orbiter:cancel',
  STOP_TAB: 'orbiter:stop-tab',
  RETRY: 'orbiter:retry',
  STATUS: 'orbiter:status',
  TAB_HEALTH: 'orbiter:tab-health',
  CLOSE_TAB: 'orbiter:close-tab',
  SELECT_DIRECTORY: 'orbiter:select-directory',
  OPEN_EXTERNAL: 'orbiter:open-external',
  OPEN_IN_TERMINAL: 'orbiter:open-in-terminal',
  ATTACH_FILES: 'orbiter:attach-files',
  TAKE_SCREENSHOT: 'orbiter:take-screenshot',
  TRANSCRIBE_AUDIO: 'orbiter:transcribe-audio',
  PASTE_IMAGE: 'orbiter:paste-image',
  GET_DIAGNOSTICS: 'orbiter:get-diagnostics',
  RESPOND_PERMISSION: 'orbiter:respond-permission',
  INIT_SESSION: 'orbiter:init-session',
  RESET_TAB_SESSION: 'orbiter:reset-tab-session',
  ANIMATE_HEIGHT: 'orbiter:animate-height',
  LIST_SESSIONS: 'orbiter:list-sessions',
  LOAD_SESSION: 'orbiter:load-session',
  LIST_CODEX_SESSIONS: 'orbiter:list-codex-sessions',
  LOAD_CODEX_SESSION: 'orbiter:load-codex-session',

  // One-way events (main → renderer)
  TEXT_CHUNK: 'orbiter:text-chunk',
  TOOL_CALL: 'orbiter:tool-call',
  TOOL_CALL_UPDATE: 'orbiter:tool-call-update',
  TOOL_CALL_COMPLETE: 'orbiter:tool-call-complete',
  TASK_UPDATE: 'orbiter:task-update',
  TASK_COMPLETE: 'orbiter:task-complete',
  SESSION_DEAD: 'orbiter:session-dead',
  SESSION_INIT: 'orbiter:session-init',
  ERROR: 'orbiter:error',
  RATE_LIMIT: 'orbiter:rate-limit',

  // Window management
  RESIZE_HEIGHT: 'orbiter:resize-height',
  SET_WINDOW_WIDTH: 'orbiter:set-window-width',
  HIDE_WINDOW: 'orbiter:hide-window',
  WINDOW_SHOWN: 'orbiter:window-shown',
  SET_IGNORE_MOUSE_EVENTS: 'orbiter:set-ignore-mouse-events',
  IS_VISIBLE: 'orbiter:is-visible',

  // Skill provisioning (main → renderer)
  SKILL_STATUS: 'orbiter:skill-status',

  // Platform
  GET_PLATFORM_INFO: 'orbiter:get-platform-info',

  // Theme
  GET_THEME: 'orbiter:get-theme',
  THEME_CHANGED: 'orbiter:theme-changed',

  // Marketplace
  MARKETPLACE_FETCH: 'orbiter:marketplace-fetch',
  MARKETPLACE_INSTALLED: 'orbiter:marketplace-installed',
  MARKETPLACE_INSTALL: 'orbiter:marketplace-install',
  MARKETPLACE_UNINSTALL: 'orbiter:marketplace-uninstall',

  // Permission mode
  SET_PERMISSION_MODE: 'orbiter:set-permission-mode',

  // Backend switching
  SET_TAB_BACKEND: 'orbiter:set-tab-backend',
  CHECK_BACKEND: 'orbiter:check-backend',

  // Legacy (kept for backward compat during migration)
  STREAM_EVENT: 'orbiter:stream-event',
  RUN_COMPLETE: 'orbiter:run-complete',
  RUN_ERROR: 'orbiter:run-error',
} as const
