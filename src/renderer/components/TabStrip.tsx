import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { PlusIcon, XIcon } from '@phosphor-icons/react'
import { useSessionStore } from '../stores/sessionStore'
import { ClaudeIcon, CodexIcon } from './BackendIcons'
import { HistoryPicker } from './HistoryPicker'
import { SettingsPopover } from './SettingsPopover'
import { useColors } from '../theme'
import type { TabStatus } from '../../shared/types'

function StatusDot({ status, hasUnread, hasPermission }: { status: TabStatus; hasUnread: boolean; hasPermission: boolean }) {
  const colors = useColors()
  let bg: string = colors.statusIdle
  let pulse = false
  let glow = false

  if (status === 'dead' || status === 'failed') {
    bg = colors.statusError
  } else if (hasPermission) {
    bg = colors.statusPermission
    glow = true
  } else if (status === 'connecting' || status === 'running') {
    bg = colors.statusRunning
    pulse = true
  } else if (hasUnread) {
    bg = colors.statusComplete
  }

  return (
    <span
      className={`w-[6px] h-[6px] rounded-full flex-shrink-0 ${pulse ? 'animate-pulse-dot' : ''}`}
      style={{
        background: bg,
        ...(glow ? { boxShadow: `0 0 6px 2px ${colors.statusPermissionGlow}` } : {}),
      }}
    />
  )
}

export function TabStrip() {
  const tabs = useSessionStore((s) => s.tabs)
  const activeTabId = useSessionStore((s) => s.activeTabId)
  const selectTab = useSessionStore((s) => s.selectTab)
  const createTab = useSessionStore((s) => s.createTab)
  const closeTab = useSessionStore((s) => s.closeTab)
  const colors = useColors()

  // Show backend icon only when tabs use mixed backends
  const hasMixedBackends = tabs.length > 1 && new Set(tabs.map((t) => t.backend)).size > 1

  return (
    <div
      data-orbiter-ui
      className="flex items-center no-drag py-2"
    >
      {/* Scrollable tabs area — clipped by master card edge */}
      <div className="relative min-w-0 flex-1">
        <div
          className="flex items-center gap-1 overflow-x-auto min-w-0"
          style={{
            scrollbarWidth: 'none',
            paddingLeft: 8,
            // Extra right breathing room so clipped tabs fade out before the edge.
            paddingRight: 14,
            // Right-only content fade so the parent card's own animated background
            // shows through cleanly in both collapsed and expanded states.
            maskImage: 'linear-gradient(to right, black 0%, black calc(100% - 40px), transparent 100%)',
            WebkitMaskImage: 'linear-gradient(to right, black 0%, black calc(100% - 40px), transparent 100%)',
          }}
        >
          <AnimatePresence mode="popLayout">
            {tabs.map((tab) => {
              const isActive = tab.id === activeTabId
              return (
                <motion.div
                  key={tab.id}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.15 }}
                  onClick={() => selectTab(tab.id)}
                  className={`group flex items-center gap-1.5 cursor-pointer select-none flex-shrink-0 max-w-[160px] transition-all duration-150 rounded-full px-2.5 py-1 text-[12px] border ${isActive ? 'bg-tab-active border-tab-active-border text-text-primary font-medium' : 'bg-transparent border-transparent text-text-tertiary hover:text-text-secondary'}`}
                >
                  <StatusDot status={tab.status} hasUnread={tab.hasUnread} hasPermission={tab.permissionQueue.length > 0} />
                  {hasMixedBackends && (
                    tab.backend === 'codex'
                      ? <CodexIcon size={9} className="text-text-muted shrink-0" />
                      : <ClaudeIcon size={9} className="text-text-muted shrink-0" />
                  )}
                  <span className="truncate flex-1">{tab.title}</span>
                  {tabs.length > 1 && (
                    <button
                      onClick={(e) => { e.stopPropagation(); closeTab(tab.id) }}
                      className={`flex-shrink-0 rounded-full w-4 h-4 flex items-center justify-center transition-opacity cursor-pointer text-text-secondary ${isActive ? 'opacity-50' : 'opacity-0'} hover:opacity-100`}
                    >
                      <XIcon size={10} />
                    </button>
                  )}
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      </div>

      {/* Pinned action buttons — always visible on the right */}
      <div className="flex items-center gap-0.5 flex-shrink-0 ml-1 pr-2">
        <button
          onClick={() => createTab()}
          className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full transition-colors cursor-pointer text-text-tertiary hover:text-text-primary"
          title="New tab"
        >
          <PlusIcon size={14} />
        </button>

        <HistoryPicker />

        <SettingsPopover />
      </div>
    </div>
  )
}
