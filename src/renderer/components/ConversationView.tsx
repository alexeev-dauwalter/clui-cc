import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  FileTextIcon, PencilSimpleIcon, FileArrowUpIcon, TerminalIcon, MagnifyingGlassIcon, GlobeIcon,
  RobotIcon, QuestionIcon, WrenchIcon, FolderOpenIcon, CopyIcon, CheckIcon, CaretRightIcon, CaretDownIcon,
  SpinnerGapIcon, ArrowCounterClockwiseIcon, SquareIcon,
} from '@phosphor-icons/react'
import { useSessionStore } from '../stores/sessionStore'
import { PermissionCard } from './PermissionCard'
import { PermissionDeniedCard } from './PermissionDeniedCard'
import { useColors, useThemeStore } from '../theme'
import type { Message } from '../../shared/types'

// ─── Constants ───

const INITIAL_RENDER_CAP = 100
const PAGE_SIZE = 100
const REMARK_PLUGINS = [remarkGfm] // Hoisted — prevents re-parse on every render

// ─── Types ───

type GroupedItem =
  | { kind: 'user'; message: Message }
  | { kind: 'assistant'; message: Message }
  | { kind: 'system'; message: Message }
  | { kind: 'tool-group'; messages: Message[] }

// ─── Helpers ───

function groupMessages(messages: Message[]): GroupedItem[] {
  const result: GroupedItem[] = []
  let toolBuf: Message[] = []

  const flushTools = () => {
    if (toolBuf.length > 0) {
      result.push({ kind: 'tool-group', messages: [...toolBuf] })
      toolBuf = []
    }
  }

  for (const msg of messages) {
    if (msg.role === 'tool') {
      toolBuf.push(msg)
    } else {
      flushTools()
      if (msg.role === 'user') result.push({ kind: 'user', message: msg })
      else if (msg.role === 'assistant') result.push({ kind: 'assistant', message: msg })
      else result.push({ kind: 'system', message: msg })
    }
  }
  flushTools()
  return result
}

// ─── Main Component ───

export function ConversationView() {
  const tabs = useSessionStore((s) => s.tabs)
  const activeTabId = useSessionStore((s) => s.activeTabId)
  const sendMessage = useSessionStore((s) => s.sendMessage)
  const staticInfo = useSessionStore((s) => s.staticInfo)
  const scrollRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const [hovered, setHovered] = useState(false)
  const [renderOffset, setRenderOffset] = useState(0) // 0 = show from tail
  const isNearBottomRef = useRef(true)
  const prevTabIdRef = useRef(activeTabId)
  const colors = useColors()
  const expandedUI = useThemeStore((s) => s.expandedUI)

  const tab = tabs.find((t) => t.id === activeTabId)

  // Reset render offset and scroll state when switching tabs
  useEffect(() => {
    if (activeTabId !== prevTabIdRef.current) {
      prevTabIdRef.current = activeTabId
      setRenderOffset(0)
      isNearBottomRef.current = true
    }
  }, [activeTabId])

  // Track whether user is scrolled near the bottom
  const handleScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    isNearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60
  }, [])

  // Auto-scroll when content changes and user is near bottom.
  const msgCount = tab?.messages.length ?? 0
  const lastMsg = tab?.messages[tab.messages.length - 1]
  const permissionQueueLen = tab?.permissionQueue?.length ?? 0
  const queuedCount = tab?.queuedPrompts?.length ?? 0
  const scrollTrigger = `${msgCount}:${lastMsg?.content?.length ?? 0}:${permissionQueueLen}:${queuedCount}`

  useEffect(() => {
    if (isNearBottomRef.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [scrollTrigger])

  // Group only the visible slice of messages
  const allMessages = tab?.messages ?? []
  const totalCount = allMessages.length
  const startIndex = Math.max(0, totalCount - INITIAL_RENDER_CAP - renderOffset * PAGE_SIZE)
  const visibleMessages = startIndex > 0 ? allMessages.slice(startIndex) : allMessages
  const hasOlder = startIndex > 0

  const grouped = useMemo(
    () => groupMessages(visibleMessages),
    [visibleMessages],
  )

  const hiddenCount = totalCount - visibleMessages.length

  const handleLoadOlder = useCallback(() => {
    setRenderOffset((o) => o + 1)
  }, [])

  if (!tab) return null

  const isRunning = tab.status === 'running' || tab.status === 'connecting'
  const isDead = tab.status === 'dead'
  const isFailed = tab.status === 'failed'
  const showInterrupt = isRunning && tab.messages.some((m) => m.role === 'user')

  if (tab.messages.length === 0) {
    return <EmptyState />
  }

  // Messages from before initial render cap are "historical" — no motion
  const historicalThreshold = Math.max(0, totalCount - 20)

  const handleRetry = () => {
    const lastUserMsg = [...tab.messages].reverse().find((m) => m.role === 'user')
    if (lastUserMsg) {
      sendMessage(lastUserMsg.content)
    }
  }

  return (
    <div
      data-orbiter-ui
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Scrollable messages area */}
      <div
        ref={scrollRef}
        className="overflow-y-auto overflow-x-hidden px-4 pt-2 conversation-selectable"
        style={{ maxHeight: expandedUI ? 460 : 336, paddingBottom: 28 }}
        onScroll={handleScroll}
      >
        {/* Load older button */}
        {hasOlder && (
          <div className="flex justify-center py-2">
            <button
              onClick={handleLoadOlder}
              className="text-[11px] px-3 py-1 rounded-full transition-colors cursor-pointer text-text-tertiary hover:bg-surface-hover border border-tool-border"
            >
              Load {Math.min(PAGE_SIZE, hiddenCount)} older messages ({hiddenCount} hidden)
            </button>
          </div>
        )}

        <div className="space-y-1 relative">
          {grouped.map((item, idx) => {
            const msgIndex = startIndex + idx
            const isHistorical = msgIndex < historicalThreshold

            switch (item.kind) {
              case 'user':
                return <UserMessage key={item.message.id} message={item.message} skipMotion={isHistorical} />
              case 'assistant':
                return <AssistantMessage key={item.message.id} message={item.message} skipMotion={isHistorical} />
              case 'tool-group':
                return <ToolGroup key={`tg-${item.messages[0].id}`} tools={item.messages} skipMotion={isHistorical} />
              case 'system':
                return <SystemMessage key={item.message.id} message={item.message} skipMotion={isHistorical} />
              default:
                return null
            }
          })}
        </div>

        {/* Permission card (shows first item from queue) */}
        <AnimatePresence>
          {tab.permissionQueue.length > 0 && (
            <PermissionCard
              tabId={tab.id}
              permission={tab.permissionQueue[0]}
              queueLength={tab.permissionQueue.length}
            />
          )}
        </AnimatePresence>

        {/* Permission denied fallback card */}
        <AnimatePresence>
          {tab.permissionDenied && (
            <PermissionDeniedCard
              tools={tab.permissionDenied.tools}
              sessionId={tab.claudeSessionId}
              projectPath={staticInfo?.projectPath || process.cwd()}
              onDismiss={() => {
                useSessionStore.setState((s) => ({
                  tabs: s.tabs.map((t) =>
                    t.id === tab.id ? { ...t, permissionDenied: null } : t
                  ),
                }))
              }}
            />
          )}
        </AnimatePresence>

        {/* Queued prompts */}
        <AnimatePresence>
          {tab.queuedPrompts.map((prompt, i) => (
            <QueuedMessage key={`queued-${i}`} content={prompt} />
          ))}
        </AnimatePresence>

        <div ref={bottomRef} />
      </div>

      {/* Activity row — overlaps bottom of scroll area as a fade strip */}
      <div
        className="flex items-center justify-between px-4 relative"
        style={{
          height: 28,
          minHeight: 28,
          marginTop: -28,
          background: `linear-gradient(to bottom, transparent, ${colors.containerBg} 70%)`,
          zIndex: 2,
        }}
      >
        {/* Left: status indicator */}
        <div className="flex items-center gap-1.5 text-[11px] min-w-0">
          {isRunning && (
            <span className="flex items-center gap-1.5">
              <span className="flex gap-[3px]">
                <span className="w-[4px] h-[4px] rounded-full animate-bounce-dot bg-status-running" style={{ animationDelay: '0ms' }} />
                <span className="w-[4px] h-[4px] rounded-full animate-bounce-dot bg-status-running" style={{ animationDelay: '150ms' }} />
                <span className="w-[4px] h-[4px] rounded-full animate-bounce-dot bg-status-running" style={{ animationDelay: '300ms' }} />
              </span>
              <span className="text-text-secondary">{tab.currentActivity || 'Working...'}</span>
            </span>
          )}

          {isDead && (
            <span className="text-status-error text-[11px]">Session ended unexpectedly</span>
          )}

          {isFailed && (
            <span className="flex items-center gap-1.5">
              <span className="text-status-error text-[11px]">Failed</span>
              <button
                onClick={handleRetry}
                className="flex items-center gap-1 rounded-full px-2 py-0.5 transition-colors cursor-pointer text-accent hover:bg-accent-soft"
                style={{ fontSize: 11 }}
              >
                <ArrowCounterClockwiseIcon size={10} />
                Retry
              </button>
            </span>
          )}
        </div>

        {/* Right: interrupt button when running */}
        <div className="flex items-center flex-shrink-0">
          <AnimatePresence>
            {showInterrupt && (
              <InterruptButton tabId={tab.id} />
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}

// ─── Empty State (directory picker before first message) ───

function EmptyState() {
  const setBaseDirectory = useSessionStore((s) => s.setBaseDirectory)
  const [shortcutLabel, setShortcutLabel] = useState('⌥ + Space')

  useEffect(() => {
    window.orbiter.getPlatformInfo().then(({ platform, isWayland }) => {
      if (platform === 'linux') {
        setShortcutLabel('Ctrl + Alt + Space')
      }
    }).catch(() => {})
  }, [])

  const handleChooseFolder = async () => {
    const dir = await window.orbiter.selectDirectory()
    if (dir) {
      setBaseDirectory(dir)
    }
  }

  return (
    <div
      className="flex flex-col items-center justify-center px-4 py-3 gap-1.5 min-h-[80px]"
    >
      <button
        onClick={handleChooseFolder}
        className="flex items-center gap-1.5 text-[12px] px-3 py-1.5 rounded-lg transition-all text-accent bg-surface-hover cursor-pointer border-none hover:brightness-125"
      >
        <FolderOpenIcon size={13} />
        Choose folder
      </button>
      <span className="text-[11px] text-text-tertiary">
        Press <strong className="text-text-secondary">{shortcutLabel}</strong> to show/hide this overlay
      </span>
    </div>
  )
}

// ─── Copy Button ───

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {}
  }

  return (
    <motion.button
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.12 }}
      onClick={handleCopy}
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[11px] cursor-pointer flex-shrink-0 border-none ${copied ? 'bg-status-complete-bg text-status-complete' : 'bg-transparent text-text-tertiary'}`}
      title="Copy response"
    >
      {copied ? <CheckIcon size={11} /> : <CopyIcon size={11} />}
      <span>{copied ? 'Copied' : 'Copy'}</span>
    </motion.button>
  )
}

// ─── Interrupt Button ───

function InterruptButton({ tabId }: { tabId: string }) {
  const handleStop = () => {
    window.orbiter.stopTab(tabId)
  }

  return (
    <motion.button
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.12 }}
      onClick={handleStop}
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[11px] cursor-pointer flex-shrink-0 transition-colors text-status-error border-none hover:bg-status-error-bg"
      title="Stop current task"
    >
      <SquareIcon size={9} weight="fill" />
      <span>Interrupt</span>
    </motion.button>
  )
}

// ─── User Message ───

function UserMessage({ message, skipMotion }: { message: Message; skipMotion?: boolean }) {
  const content = (
    <div
      className="text-[13px] leading-[1.5] px-3 py-1.5 max-w-[85%] bg-user-bubble text-user-bubble-text border border-user-bubble-border"
      style={{ borderRadius: '14px 14px 4px 14px' }}
    >
      {message.content}
    </div>
  )

  if (skipMotion) {
    return <div className="flex justify-end py-1.5">{content}</div>
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15 }}
      className="flex justify-end py-1.5"
    >
      {content}
    </motion.div>
  )
}

// ─── Queued Message (waiting at bottom until processed) ───

function QueuedMessage({ content }: { content: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.15 }}
      className="flex justify-end py-1.5"
    >
      <div
        className="text-[13px] leading-[1.5] px-3 py-1.5 max-w-[85%] bg-user-bubble text-user-bubble-text border border-dashed border-user-bubble-border opacity-60"
        style={{ borderRadius: '14px 14px 4px 14px' }}
      >
        {content}
      </div>
    </motion.div>
  )
}

// ─── Table scroll wrapper — fade edges when horizontally scrollable ───

function TableScrollWrapper({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [fade, setFade] = useState<string | undefined>(undefined)
  const prevFade = useRef<string | undefined>(undefined)

  const update = useCallback(() => {
    const el = ref.current
    if (!el) return
    const { scrollLeft, scrollWidth, clientWidth } = el
    let next: string | undefined
    if (scrollWidth <= clientWidth + 1) {
      next = undefined
    } else {
      const l = scrollLeft > 1
      const r = scrollLeft + clientWidth < scrollWidth - 1
      next = l && r
        ? 'linear-gradient(to right, transparent, black 24px, black calc(100% - 24px), transparent)'
        : l
          ? 'linear-gradient(to right, transparent, black 24px)'
          : r
            ? 'linear-gradient(to right, black calc(100% - 24px), transparent)'
            : undefined
    }
    if (next !== prevFade.current) {
      prevFade.current = next
      setFade(next)
    }
  }, [])

  useEffect(() => {
    update()
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(update)
    ro.observe(el)
    const table = el.querySelector('table')
    if (table) ro.observe(table)
    return () => ro.disconnect()
  }, [update])

  return (
    <div
      ref={ref}
      onScroll={update}
      style={{
        overflowX: 'auto',
        scrollbarWidth: 'thin',
        maskImage: fade,
        WebkitMaskImage: fade,
      }}
    >
      <table>{children}</table>
    </div>
  )
}

// ─── Image card — graceful fallback when src returns 404 ───

function ImageCard({ src, alt }: { src?: string; alt?: string }) {
  const [failed, setFailed] = useState(false)
  // Reset failed state when src changes (e.g. during streaming)
  useEffect(() => { setFailed(false) }, [src])
  const label = alt || 'Image'
  const open = () => { if (src) window.orbiter.openExternal(String(src)) }

  if (failed || !src) {
    return (
      <button
        type="button"
        className="inline-flex items-center gap-1.5 my-1 px-2.5 py-1.5 rounded-md text-[12px] cursor-pointer bg-surface-primary text-accent border border-tool-border"
        onClick={open}
        title={src}
      >
        <GlobeIcon size={12} />
        Image unavailable{alt ? ` — ${alt}` : ''}
      </button>
    )
  }

  return (
    <button
      type="button"
      className="block my-2 rounded-lg overflow-hidden border text-left cursor-pointer border-tool-border bg-surface-primary"
      onClick={open}
      title={src}
    >
      <img
        src={src}
        alt={label}
        className="block w-full max-h-[260px] object-cover"
        loading="lazy"
        onError={() => setFailed(true)}
      />
      {alt && (
        <div className="px-2 py-1 text-[11px] text-text-tertiary">
          {alt}
        </div>
      )}
    </button>
  )
}

// ─── Assistant Message (memoized — only re-renders when content changes) ───

const AssistantMessage = React.memo(function AssistantMessage({
  message,
  skipMotion,
}: {
  message: Message
  skipMotion?: boolean
}) {
  const markdownComponents = useMemo(() => ({
    table: ({ children }: any) => <TableScrollWrapper>{children}</TableScrollWrapper>,
    a: ({ href, children }: any) => (
      <button
        type="button"
        className="underline decoration-dotted underline-offset-2 cursor-pointer text-accent"
        onClick={() => {
          if (href) window.orbiter.openExternal(String(href))
        }}
      >
        {children}
      </button>
    ),
    img: ({ src, alt }: any) => <ImageCard src={src} alt={alt} />,
  }), [])

  const inner = (
    <div className="group/msg relative">
      <div className="text-[13px] leading-[1.6] prose-cloud min-w-0 max-w-[92%]">
        <Markdown remarkPlugins={REMARK_PLUGINS} components={markdownComponents}>
          {message.content}
        </Markdown>
      </div>
      {/* Copy button — always in DOM, shown via CSS :hover (no React state needed).
          Absolute positioning so it never shifts the text layout. */}
      {message.content.trim() && (
        <div className="absolute bottom-0 right-0 opacity-0 group-hover/msg:opacity-100 transition-opacity duration-100">
          <CopyButton text={message.content} />
        </div>
      )}
    </div>
  )

  if (skipMotion) {
    return <div className="py-1">{inner}</div>
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15 }}
      className="py-1"
    >
      {inner}
    </motion.div>
  )
}, (prev, next) => prev.message.content === next.message.content && prev.skipMotion === next.skipMotion)

// ─── Tool Group (collapsible timeline — Claude Code style) ───

/** Build a short description from tool name + input for the collapsed summary */
function toolSummary(tools: Message[]): string {
  if (tools.length === 0) return ''
  // Use first tool's context for summary
  const first = tools[0]
  const desc = getToolDescription(first.toolName || 'Tool', first.toolInput)
  if (tools.length === 1) return desc
  return `${desc} and ${tools.length - 1} more tool${tools.length > 2 ? 's' : ''}`
}

/** Short human-readable description from tool name + input */
function getToolDescription(name: string, input?: string): string {
  if (!input) return name

  // Try to extract a meaningful short description from the input JSON
  try {
    const parsed = JSON.parse(input)
    switch (name) {
      case 'Read': return `Read ${parsed.file_path || parsed.path || 'file'}`
      case 'Edit': return `Edit ${parsed.file_path || 'file'}`
      case 'Write': return `Write ${parsed.file_path || 'file'}`
      case 'Glob': return `Search files: ${parsed.pattern || ''}`
      case 'Grep': return `Search: ${parsed.pattern || ''}`
      case 'Bash': {
        const cmd = parsed.command || ''
        return cmd.length > 60 ? `${cmd.substring(0, 57)}...` : cmd || 'Bash'
      }
      case 'WebSearch': return `Search: ${parsed.query || parsed.search_query || ''}`
      case 'WebFetch': return `Fetch: ${parsed.url || ''}`
      case 'Agent': return `Agent: ${(parsed.prompt || parsed.description || '').substring(0, 50)}`
      default: return name
    }
  } catch {
    // Input is not JSON or is partial — show truncated raw
    const trimmed = input.trim()
    if (trimmed.length > 60) return `${name}: ${trimmed.substring(0, 57)}...`
    return trimmed ? `${name}: ${trimmed}` : name
  }
}

function ToolGroup({ tools, skipMotion }: { tools: Message[]; skipMotion?: boolean }) {
  const hasRunning = tools.some((t) => t.toolStatus === 'running')
  const [expanded, setExpanded] = useState(false)

  const isOpen = expanded || hasRunning

  if (isOpen) {
    const inner = (
      <div className="py-1">
        {/* Collapse header — click to close */}
        {!hasRunning && (
          <div
            className="flex items-center gap-1 cursor-pointer mb-1.5"
            onClick={() => setExpanded(false)}
          >
            <CaretDownIcon size={10} className="text-text-muted" />
            <span className="text-[11px] text-text-muted">
              Used {tools.length} tool{tools.length !== 1 ? 's' : ''}
            </span>
          </div>
        )}

        {/* Timeline */}
        <div className="relative pl-6">
          {/* Vertical line */}
          <div
            className="absolute left-[10px] top-1 bottom-1 w-px bg-timeline-line"
          />

          <div className="space-y-3">
            {tools.map((tool) => {
              const isRunning = tool.toolStatus === 'running'
              const toolName = tool.toolName || 'Tool'
              const desc = getToolDescription(toolName, tool.toolInput)

              return (
                <div key={tool.id} className="relative">
                  {/* Timeline node */}
                  <div
                    className={`absolute -left-6 top-[1px] w-[20px] h-[20px] rounded-full flex items-center justify-center ${isRunning ? 'bg-tool-running-bg border border-tool-running-border' : 'bg-tool-bg border border-tool-border'}`}
                  >
                    {isRunning
                      ? <SpinnerGapIcon size={10} className="animate-spin text-status-running" />
                      : <ToolIcon name={toolName} size={10} />
                    }
                  </div>

                  {/* Tool description */}
                  <div className="min-w-0">
                    <span
                      className={`text-[12px] leading-[1.4] block truncate ${isRunning ? 'text-text-secondary' : 'text-text-tertiary'}`}
                    >
                      {desc}
                    </span>

                    {/* Result badge */}
                    {!isRunning && (
                      <span
                        className={`inline-block text-[10px] mt-0.5 px-1.5 py-[1px] rounded ${tool.toolStatus === 'error' ? 'bg-status-error-bg text-status-error' : 'bg-surface-hover text-text-muted'}`}
                      >
                        Result
                      </span>
                    )}

                    {isRunning && (
                      <span className="text-[10px] mt-0.5 block text-text-muted">
                        running...
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    )

    if (skipMotion) return inner

    return (
      <motion.div
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: 'auto' }}
        exit={{ opacity: 0, height: 0 }}
        transition={{ duration: 0.15 }}
      >
        {inner}
      </motion.div>
    )
  }

  // Collapsed state — summary text + chevron, no container
  const summary = toolSummary(tools)

  const inner = (
    <div
      className="flex items-start gap-1 cursor-pointer py-[2px]"
      onClick={() => setExpanded(true)}
    >
      <CaretRightIcon size={10} className="flex-shrink-0 mt-[2px] text-text-tertiary" />
      <span className="text-[11px] leading-[1.4] text-text-tertiary">
        {summary}
      </span>
    </div>
  )

  if (skipMotion) return <div className="py-0.5">{inner}</div>

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.12 }}
      className="py-0.5"
    >
      {inner}
    </motion.div>
  )
}

// ─── System Message ───

function SystemMessage({ message, skipMotion }: { message: Message; skipMotion?: boolean }) {
  const isError = message.content.startsWith('Error:') || message.content.includes('unexpectedly')

  const inner = (
    <div
      className={`text-[11px] leading-[1.5] px-2.5 py-1 rounded-lg inline-block whitespace-pre-wrap ${isError ? 'bg-status-error-bg text-status-error' : 'bg-surface-hover text-text-tertiary'}`}
    >
      {message.content}
    </div>
  )

  if (skipMotion) return <div className="py-0.5">{inner}</div>

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.15 }}
      className="py-0.5"
    >
      {inner}
    </motion.div>
  )
}

// ─── Tool Icon mapping ───

function ToolIcon({ name, size = 12 }: { name: string; size?: number }) {
  const ICONS: Record<string, React.ReactNode> = {
    Read: <FileTextIcon size={size} />,
    Edit: <PencilSimpleIcon size={size} />,
    Write: <FileArrowUpIcon size={size} />,
    Bash: <TerminalIcon size={size} />,
    Glob: <FolderOpenIcon size={size} />,
    Grep: <MagnifyingGlassIcon size={size} />,
    WebSearch: <GlobeIcon size={size} />,
    WebFetch: <GlobeIcon size={size} />,
    Agent: <RobotIcon size={size} />,
    AskUserQuestion: <QuestionIcon size={size} />,
  }

  return (
    <span className="flex items-center text-text-tertiary">
      {ICONS[name] || <WrenchIcon size={size} />}
    </span>
  )
}
