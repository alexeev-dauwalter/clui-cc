import React, { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { ClockIcon, ChatCircleIcon } from '@phosphor-icons/react'
import { useSessionStore } from '../stores/sessionStore'
import { ClaudeIcon, CodexIcon } from './BackendIcons'
import { usePopoverLayer } from './PopoverLayer'
import { useColors } from '../theme'
import type { SessionMeta, BackendType } from '../../shared/types'

function formatTimeAgo(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(isoDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}K`
  return `${(bytes / (1024 * 1024)).toFixed(1)}M`
}

export function HistoryPicker() {
  const resumeSession = useSessionStore((s) => s.resumeSession)
  const codexAvailable = useSessionStore((s) => s.codexAvailable)
  const isExpanded = useSessionStore((s) => s.isExpanded)
  const activeTab = useSessionStore(
    (s) => s.tabs.find((t) => t.id === s.activeTabId),
    (a, b) => a === b || (!!a && !!b && a.hasChosenDirectory === b.hasChosenDirectory && a.workingDirectory === b.workingDirectory),
  )
  const staticInfo = useSessionStore((s) => s.staticInfo)
  const popoverLayer = usePopoverLayer()
  const colors = useColors()
  const effectiveProjectPath = activeTab?.hasChosenDirectory
    ? activeTab.workingDirectory
    : (staticInfo?.homePath || activeTab?.workingDirectory || '~')

  const [open, setOpen] = useState(false)
  const [historyTab, setHistoryTab] = useState<BackendType>('claude')
  const [sessions, setSessions] = useState<SessionMeta[]>([])
  const [loading, setLoading] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ right: number; top?: number; bottom?: number; maxHeight?: number }>({ right: 0 })

  const updatePos = useCallback(() => {
    if (!triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    if (isExpanded) {
      const top = rect.bottom + 6
      setPos({
        top,
        right: window.innerWidth - rect.right,
        maxHeight: window.innerHeight - top - 12,
      })
    } else {
      setPos({
        bottom: window.innerHeight - rect.top + 6,
        right: window.innerWidth - rect.right,
      })
    }
  }, [isExpanded])

  const loadSessions = useCallback(async (backend: BackendType) => {
    setLoading(true)
    try {
      const result = backend === 'codex'
        ? await window.orbiter.listCodexSessions(effectiveProjectPath)
        : await window.orbiter.listSessions(effectiveProjectPath)
      setSessions(result)
    } catch {
      setSessions([])
    }
    setLoading(false)
  }, [effectiveProjectPath])

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      const target = e.target as Node
      if (triggerRef.current?.contains(target)) return
      if (popoverRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const handleToggle = () => {
    if (!open) {
      updatePos()
      void loadSessions(historyTab)
    }
    setOpen((o) => !o)
  }

  const handleTabSwitch = (tab: BackendType) => {
    setHistoryTab(tab)
    void loadSessions(tab)
  }

  const handleSelect = (session: SessionMeta) => {
    setOpen(false)
    const title = session.firstMessage
      ? (session.firstMessage.length > 30 ? session.firstMessage.substring(0, 27) + '...' : session.firstMessage)
      : session.slug || 'Resumed'
    void resumeSession(session.sessionId, title, effectiveProjectPath, historyTab)
  }

  return (
    <>
      <button
        ref={triggerRef}
        onClick={handleToggle}
        className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full transition-colors cursor-pointer text-text-tertiary hover:text-text-primary"
        title="Resume a previous session"
      >
        <ClockIcon size={13} />
      </button>

      {popoverLayer && open && createPortal(
        <motion.div
          ref={popoverRef}
          data-orbiter-ui
          initial={{ opacity: 0, y: isExpanded ? -4 : 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: isExpanded ? -4 : 4 }}
          transition={{ duration: 0.12 }}
          className="rounded-xl bg-popover-bg border border-popover-border fixed w-[280px] pointer-events-auto backdrop-blur-[20px] overflow-hidden flex flex-col"
          style={{
            ...(pos.top != null ? { top: pos.top } : {}),
            ...(pos.bottom != null ? { bottom: pos.bottom } : {}),
            right: pos.right,
            WebkitBackdropFilter: 'blur(20px)',
            boxShadow: colors.popoverShadow,
            ...(pos.maxHeight != null ? { maxHeight: pos.maxHeight } : {}),
          }}
        >
          {/* Tab switcher */}
          <div className="flex items-center gap-1 px-2 pt-2 pb-1 flex-shrink-0">
            {(['claude', 'codex'] as BackendType[]).map((tab) => {
              const isActive = tab === historyTab
              const Icon = tab === 'claude' ? ClaudeIcon : CodexIcon
              const disabled = tab === 'codex' && !codexAvailable
              return (
                <button
                  key={tab}
                  onClick={() => !disabled && handleTabSwitch(tab)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-medium transition-colors"
                  style={{
                    background: isActive ? colors.surfacePrimary : 'transparent',
                    color: disabled ? colors.textMuted : isActive ? colors.textPrimary : colors.textTertiary,
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    opacity: disabled ? 0.5 : 1,
                  }}
                >
                  <Icon size={10} />
                  {tab === 'claude' ? 'Claude' : 'Codex'}
                </button>
              )
            })}
          </div>

          <div className="overflow-y-auto py-1" style={{ maxHeight: pos.maxHeight != null ? undefined : 180 }}>
            {loading && (
              <div className="px-3 py-4 text-center text-[11px] text-text-tertiary">
                Loading...
              </div>
            )}

            {!loading && sessions.length === 0 && (
              <div className="px-3 py-4 text-center text-[11px] text-text-tertiary">
                No previous sessions found
              </div>
            )}

            {!loading && sessions.map((session) => (
              <button
                key={session.sessionId}
                onClick={() => handleSelect(session)}
                className="w-full flex items-start gap-2.5 px-3 py-2 text-left transition-colors"
              >
                <ChatCircleIcon size={13} className="flex-shrink-0 mt-0.5 text-text-tertiary" />
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] truncate text-text-primary">
                    {session.firstMessage || session.slug || session.sessionId.substring(0, 8)}
                  </div>
                  <div className="flex items-center gap-2 text-[10px] mt-0.5 text-text-tertiary">
                    <span>{formatTimeAgo(session.lastTimestamp)}</span>
                    <span>{formatSize(session.size)}</span>
                    {session.slug && <span className="truncate">{session.slug}</span>}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </motion.div>,
        popoverLayer,
      )}
    </>
  )
}
