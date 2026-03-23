import React from 'react'
import { motion } from 'framer-motion'
import { ShieldWarningIcon, TerminalIcon, ArrowSquareOutIcon } from '@phosphor-icons/react'
import { useColors } from '../theme'

interface Props {
  tools: Array<{ toolName: string; toolUseId: string }>
  sessionId: string | null
  projectPath: string
  onDismiss: () => void
}

export function PermissionDeniedCard({ tools, sessionId, projectPath, onDismiss }: Props) {
  const colors = useColors()

  const handleOpenInCli = () => {
    if (sessionId) {
      window.orbiter.openInTerminal(sessionId, projectPath)
    }
    onDismiss()
  }

  const toolNames = [...new Set(tools.map((t) => t.toolName))]

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -4, scale: 0.97 }}
      transition={{ duration: 0.2 }}
      className="mx-4 mb-2"
    >
      <div
        style={{ boxShadow: `0 2px 12px ${colors.statusErrorBg}` }}
        className="overflow-hidden bg-container-bg border border-permission-denied-border rounded-[14px]"
      >
        {/* Header */}
        <div
          className="flex items-center gap-2 px-3 py-2 bg-status-error-bg border-b border-permission-denied-header-border"
        >
          <ShieldWarningIcon size={14} className="text-status-error" />
          <span className="text-[12px] font-semibold text-status-error">
            Tools Denied by Permission Settings
          </span>
        </div>

        {/* Body */}
        <div className="px-3 py-2">
          <p className="text-[11px] leading-[1.5] mb-2 text-text-secondary">
            Interactive approvals are not supported in the current CLI mode.
            {toolNames.length > 0 && (
              <> Denied: <span className="text-text-primary">{toolNames.join(', ')}</span>.</>
            )}
          </p>

          {/* Tool list */}
          {tools.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {toolNames.map((name) => (
                <span
                  key={name}
                  className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-md bg-surface-primary text-text-tertiary border border-surface-secondary"
                >
                  <TerminalIcon size={10} />
                  {name}
                </span>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-1.5">
            {sessionId && (
              <button
                onClick={handleOpenInCli}
                className="text-[11px] font-medium px-3 py-1.5 rounded-full transition-colors cursor-pointer flex items-center gap-1.5 bg-accent-light text-accent hover:bg-accent-soft border border-accent-border-medium"
              >
                <ArrowSquareOutIcon size={12} />
                Open in CLI
              </button>
            )}
            <button
              onClick={onDismiss}
              className="text-[11px] font-medium px-3 py-1.5 rounded-full transition-colors cursor-pointer bg-surface-hover text-text-tertiary hover:bg-surface-active border border-surface-secondary"
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
