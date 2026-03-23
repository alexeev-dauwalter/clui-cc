import React, { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { TerminalIcon, CaretDownIcon, CheckIcon, FolderOpenIcon, PlusIcon, XIcon, ShieldCheckIcon } from '@phosphor-icons/react'
import { useSessionStore } from '../stores/sessionStore'
import { BACKEND_CONFIGS } from '../../shared/backend-config'
import type { BackendType } from '../../shared/types'
import { ClaudeIcon, CodexIcon } from './BackendIcons'
import { usePopoverLayer } from './PopoverLayer'
import { useColors } from '../theme'

/* ─── Model Picker (inline — tightly coupled to StatusBar) ─── */

/* ─── Backend Picker ─── */

function BackendPicker() {
  const tab = useSessionStore(
    (s) => s.tabs.find((t) => t.id === s.activeTabId),
    (a, b) => a === b || (!!a && !!b && a.status === b.status && a.backend === b.backend && a.messages.length === b.messages.length),
  )
  const codexAvailable = useSessionStore((s) => s.codexAvailable)
  const setTabBackend = useSessionStore((s) => s.setTabBackend)
  const popoverLayer = usePopoverLayer()
  const colors = useColors()

  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ bottom: 0, left: 0 })

  const isBusy = tab?.status === 'running' || tab?.status === 'connecting'
  const isLocked = (tab?.messages.length ?? 0) > 0
  const currentBackend: BackendType = tab?.backend || 'claude'

  const updatePos = useCallback(() => {
    if (!triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    setPos({ bottom: window.innerHeight - rect.top + 6, left: rect.left })
  }, [])

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

  const isDisabled = isBusy || isLocked

  const handleToggle = () => {
    if (isDisabled) return
    if (!open) updatePos()
    setOpen((o) => !o)
  }

  const Icon = currentBackend === 'claude' ? ClaudeIcon : CodexIcon

  return (
    <>
      <button
        ref={triggerRef}
        onClick={handleToggle}
        className={`flex items-center gap-0.5 text-[10px] rounded-full px-1.5 py-0.5 transition-colors text-text-tertiary ${!isDisabled ? 'hover:text-text-secondary' : ''}`}
        style={{ cursor: isDisabled ? 'not-allowed' : 'pointer' }}
        title={isLocked ? 'Backend is locked for this session' : isBusy ? 'Stop the task to switch backend' : 'Switch backend'}
      >
        <Icon size={11} />
        {BACKEND_CONFIGS[currentBackend].displayName}
        <CaretDownIcon size={10} style={{ opacity: 0.6 }} />
      </button>

      {popoverLayer && open && createPortal(
        <motion.div
          ref={popoverRef}
          data-orbiter-ui
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 4 }}
          transition={{ duration: 0.12 }}
          className="rounded-xl bg-popover-bg border border-popover-border"
          style={{
            position: 'fixed',
            bottom: pos.bottom,
            left: pos.left,
            width: 180,
            pointerEvents: 'auto',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            boxShadow: colors.popoverShadow,
          }}
        >
          <div className="py-1">
            {(['claude', 'codex'] as BackendType[]).map((b) => {
              const config = BACKEND_CONFIGS[b]
              const isSelected = b === currentBackend
              const disabled = b === 'codex' && !codexAvailable
              const BIcon = b === 'claude' ? ClaudeIcon : CodexIcon
              return (
                <button
                  key={b}
                  onClick={() => { if (!disabled) { setTabBackend(b); setOpen(false) } }}
                  className={`w-full flex items-center justify-between px-3 py-1.5 text-[11px] transition-colors ${disabled ? 'text-text-muted' : isSelected ? 'text-text-primary' : 'text-text-secondary'}`}
                  style={{
                    fontWeight: isSelected ? 600 : 400,
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    opacity: disabled ? 0.5 : 1,
                  }}
                  title={disabled ? 'Install Codex CLI' : undefined}
                >
                  <span className="flex items-center gap-1.5">
                    <BIcon size={12} />
                    {config.displayName}
                  </span>
                  {isSelected && <CheckIcon size={12} className="text-accent" />}
                </button>
              )
            })}
          </div>
        </motion.div>,
        popoverLayer,
      )}
    </>
  )
}

/* ─── Model Picker (inline — tightly coupled to StatusBar) ─── */

function ModelPicker() {
  const preferredModel = useSessionStore(
    (s) => s.tabs.find((t) => t.id === s.activeTabId)?.preferredModel ?? null,
    (a, b) => a === b,
  )
  const setPreferredModel = useSessionStore((s) => s.setPreferredModel)
  const tab = useSessionStore(
    (s) => s.tabs.find((t) => t.id === s.activeTabId),
    (a, b) => a === b || (!!a && !!b && a.status === b.status && a.sessionModel === b.sessionModel && a.backend === b.backend),
  )
  const backend = tab?.backend || 'claude'
  const models = BACKEND_CONFIGS[backend].fallbackModels
  const popoverLayer = usePopoverLayer()
  const colors = useColors()

  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ bottom: 0, left: 0 })

  const isBusy = tab?.status === 'running' || tab?.status === 'connecting'

  const updatePos = useCallback(() => {
    if (!triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    setPos({
      bottom: window.innerHeight - rect.top + 6,
      left: rect.left,
    })
  }, [])

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
    if (isBusy) return
    if (!open) updatePos()
    setOpen((o) => !o)
  }

  const activeLabel = (() => {
    if (preferredModel) {
      const m = models.find((m) => m.id === preferredModel)
      if (m) return m.label
    }
    if (tab?.sessionModel) {
      const m = models.find((m) => m.id === tab.sessionModel)
      if (m) return m.label
    }
    return models[0]?.label || 'Default'
  })()

  return (
    <>
      <button
        ref={triggerRef}
        onClick={handleToggle}
        className={`flex items-center gap-0.5 text-[10px] rounded-full px-1.5 py-0.5 transition-colors text-text-tertiary ${!isBusy ? 'hover:text-text-secondary' : ''}`}
        style={{ cursor: isBusy ? 'not-allowed' : 'pointer' }}
        title={isBusy ? 'Stop the task to change model' : 'Switch model'}
      >
        {activeLabel}
        <CaretDownIcon size={10} style={{ opacity: 0.6 }} />
      </button>

      {popoverLayer && open && createPortal(
        <motion.div
          ref={popoverRef}
          data-orbiter-ui
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 4 }}
          transition={{ duration: 0.12 }}
          className="rounded-xl bg-popover-bg border border-popover-border"
          style={{
            position: 'fixed',
            bottom: pos.bottom,
            left: pos.left,
            width: 192,
            pointerEvents: 'auto',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            boxShadow: colors.popoverShadow,
          }}
        >
          <div className="py-1">
            {models.map((m) => {
              const isSelected = preferredModel === m.id || (!preferredModel && m.id === models[0]?.id)
              return (
                <button
                  key={m.id}
                  onClick={() => { setPreferredModel(m.id); setOpen(false) }}
                  className={`w-full flex items-center justify-between px-3 py-1.5 text-[11px] transition-colors cursor-pointer ${isSelected ? 'text-text-primary' : 'text-text-secondary'}`}
                  style={{
                    fontWeight: isSelected ? 600 : 400,
                  }}
                >
                  {m.label}
                  {isSelected && <CheckIcon size={12} className="text-accent" />}
                </button>
              )
            })}
          </div>
        </motion.div>,
        popoverLayer,
      )}
    </>
  )
}

/* ─── Permission Mode Picker (global — affects all tabs) ─── */

function PermissionModePicker() {
  const permissionMode = useSessionStore((s) => s.permissionMode)
  const setPermissionMode = useSessionStore((s) => s.setPermissionMode)
  const popoverLayer = usePopoverLayer()
  const colors = useColors()

  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ bottom: 0, left: 0 })

  const updatePos = useCallback(() => {
    if (!triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    setPos({
      bottom: window.innerHeight - rect.top + 6,
      left: rect.left,
    })
  }, [])

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
    if (!open) updatePos()
    setOpen((o) => !o)
  }

  const isAuto = permissionMode === 'auto'

  return (
    <>
      <button
        ref={triggerRef}
        onClick={handleToggle}
        className="flex items-center gap-0.5 text-[10px] rounded-full px-1.5 py-0.5 transition-colors text-text-tertiary hover:text-text-secondary cursor-pointer"
        title="Permission mode (global)"
      >
        <ShieldCheckIcon size={11} weight={isAuto ? 'fill' : 'regular'} />
        {isAuto ? 'Auto' : 'Ask'}
        <CaretDownIcon size={10} style={{ opacity: 0.6 }} />
      </button>

      {popoverLayer && open && createPortal(
        <motion.div
          ref={popoverRef}
          data-orbiter-ui
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 4 }}
          transition={{ duration: 0.12 }}
          className="rounded-xl bg-popover-bg border border-popover-border"
          style={{
            position: 'fixed',
            bottom: pos.bottom,
            left: pos.left,
            width: 180,
            pointerEvents: 'auto',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            boxShadow: colors.popoverShadow,
          }}
        >
          <div className="py-1">
            <button
              onClick={() => { setPermissionMode('ask'); setOpen(false) }}
              className={`w-full flex items-center justify-between px-3 py-1.5 text-[11px] transition-colors cursor-pointer ${!isAuto ? 'text-text-primary' : 'text-text-secondary'}`}
              style={{
                fontWeight: !isAuto ? 600 : 400,
              }}
            >
              <span className="flex items-center gap-1.5">
                <ShieldCheckIcon size={12} />
                Ask
              </span>
              {!isAuto && <CheckIcon size={12} className="text-accent" />}
            </button>

            <div className="mx-2 my-0.5 h-px bg-popover-border" />

            <button
              onClick={() => { setPermissionMode('auto'); setOpen(false) }}
              className={`w-full flex items-center justify-between px-3 py-1.5 text-[11px] transition-colors cursor-pointer ${isAuto ? 'text-text-primary' : 'text-text-secondary'}`}
              style={{
                fontWeight: isAuto ? 600 : 400,
              }}
            >
              <span className="flex items-center gap-1.5">
                <ShieldCheckIcon size={12} weight="fill" />
                Auto
              </span>
              {isAuto && <CheckIcon size={12} className="text-accent" />}
            </button>
          </div>
        </motion.div>,
        popoverLayer,
      )}
    </>
  )
}

/* ─── StatusBar ─── */

/** Get a compact display path: basename for deep paths, ~ for home */
function compactPath(fullPath: string): string {
  if (fullPath === '~') return '~'
  const parts = fullPath.replace(/\/$/, '').split('/')
  return parts[parts.length - 1] || fullPath
}

export function StatusBar() {
  const tab = useSessionStore(
    (s) => s.tabs.find((t) => t.id === s.activeTabId),
    (a, b) => a === b || (!!a && !!b
      && a.status === b.status
      && a.backend === b.backend
      && a.additionalDirs === b.additionalDirs
      && a.hasChosenDirectory === b.hasChosenDirectory
      && a.workingDirectory === b.workingDirectory
      && a.claudeSessionId === b.claudeSessionId
    ),
  )
  const addDirectory = useSessionStore((s) => s.addDirectory)
  const removeDirectory = useSessionStore((s) => s.removeDirectory)
  const popoverLayer = usePopoverLayer()
  const colors = useColors()

  const [dirOpen, setDirOpen] = useState(false)
  const dirRef = useRef<HTMLButtonElement>(null)
  const dirPopRef = useRef<HTMLDivElement>(null)
  const [dirPos, setDirPos] = useState({ bottom: 0, left: 0 })

  // Close popover on outside click
  useEffect(() => {
    if (!dirOpen) return
    const handler = (e: MouseEvent) => {
      const target = e.target as Node
      if (dirRef.current?.contains(target)) return
      if (dirPopRef.current?.contains(target)) return
      setDirOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [dirOpen])

  if (!tab) return null

  const isRunning = tab.status === 'running' || tab.status === 'connecting'
  const isEmpty = tab.messages.length === 0
  const hasExtraDirs = tab.additionalDirs.length > 0

  const handleOpenInTerminal = () => {
    window.orbiter.openInTerminal(tab.claudeSessionId, tab.workingDirectory, tab.backend)
  }

  const handleDirClick = () => {
    if (isRunning) return
    if (!dirOpen && dirRef.current) {
      const rect = dirRef.current.getBoundingClientRect()
      setDirPos({
        bottom: window.innerHeight - rect.top + 6,
        left: rect.left,
      })
    }
    setDirOpen((o) => !o)
  }

  const handleAddDir = async () => {
    const dir = await window.orbiter.selectDirectory()
    if (dir) {
      addDirectory(dir)
    }
  }

  const dirTooltip = tab.hasChosenDirectory
    ? [tab.workingDirectory, ...tab.additionalDirs].join('\n')
    : 'Using home directory by default — click to choose a folder'

  return (
    <div
      className="flex items-center justify-between px-4 py-1.5"
      style={{ minHeight: 28 }}
    >
      {/* Left — directory + model picker */}
      <div className="flex items-center gap-2 text-[11px] min-w-0 text-text-tertiary">
        {/* Directory button */}
        <button
          ref={dirRef}
          onClick={handleDirClick}
          className="flex items-center gap-1 rounded-full px-1.5 py-0.5 transition-colors flex-shrink-0 text-text-tertiary hover:text-text-secondary"
          style={{
            cursor: isRunning ? 'not-allowed' : 'pointer',
            maxWidth: 140,
          }}
          title={dirTooltip}
          disabled={isRunning}
        >
          <FolderOpenIcon size={11} className="flex-shrink-0" />
          <span className="truncate">{tab.hasChosenDirectory ? compactPath(tab.workingDirectory) : '~'}</span>
          {hasExtraDirs && (
            <span className="text-text-tertiary font-semibold">+{tab.additionalDirs.length}</span>
          )}
        </button>

        {/* Directory popover */}
        {popoverLayer && dirOpen && createPortal(
          <motion.div
            ref={dirPopRef}
            data-orbiter-ui
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.12 }}
            className="rounded-xl bg-popover-bg border border-popover-border"
            style={{
              position: 'fixed',
              bottom: dirPos.bottom,
              left: dirPos.left,
              width: 220,
              pointerEvents: 'auto',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              boxShadow: colors.popoverShadow,
            }}
          >
            <div className="py-1.5 px-1">
              {/* Base directory */}
              <div className="px-2 py-1">
                <div className="text-[9px] uppercase tracking-wider mb-1 text-text-tertiary">
                  Base directory
                </div>
                <div className={`text-[11px] truncate ${tab.hasChosenDirectory ? 'text-text-secondary' : 'text-text-muted'}`} title={tab.hasChosenDirectory ? tab.workingDirectory : 'No folder selected — defaults to home directory'}>
                  {tab.hasChosenDirectory ? tab.workingDirectory : 'None (defaults to ~)'}
                </div>
              </div>

              {/* Additional directories */}
              {hasExtraDirs && (
                <>
                  <div className="mx-2 my-1 h-px bg-popover-border" />
                  <div className="px-2 py-1">
                    <div className="text-[9px] uppercase tracking-wider mb-1 text-text-tertiary">
                      Added directories
                    </div>
                    {tab.additionalDirs.map((dir) => (
                      <div key={dir} className="flex items-center justify-between py-0.5 group">
                        <span className="text-[11px] truncate mr-2 text-text-secondary" title={dir}>
                          {compactPath(dir)}
                        </span>
                        <button
                          onClick={() => removeDirectory(dir)}
                          className="flex-shrink-0 opacity-50 hover:opacity-100 transition-opacity cursor-pointer text-text-tertiary"
                          title="Remove directory"
                        >
                          <XIcon size={10} />
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              )}

              <div className="mx-2 my-1 h-px bg-popover-border" />

              {/* Add directory button */}
              <button
                onClick={handleAddDir}
                className="w-full flex items-center gap-1.5 px-2 py-1.5 text-[11px] transition-colors rounded-lg cursor-pointer text-accent hover:bg-surface-hover"
              >
                <PlusIcon size={10} />
                Add directory...
              </button>
            </div>
          </motion.div>,
          popoverLayer,
        )}

        <span className="text-text-muted text-[10px]">|</span>

        <BackendPicker />

        <span className="text-text-muted text-[10px]">|</span>

        <ModelPicker />

        <span className="text-text-muted text-[10px]">|</span>

        <PermissionModePicker />
      </div>

      {/* Right — Open in CLI */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <button
          onClick={handleOpenInTerminal}
          className="flex items-center gap-1 text-[11px] rounded-full px-2 py-0.5 transition-colors cursor-pointer text-text-tertiary hover:text-text-primary"
          title="Open this session in Terminal"
        >
          Open in CLI
          <TerminalIcon size={11} />
        </button>
      </div>
    </div>
  )
}
