import React, { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import {
  TrashIcon, CpuIcon, CurrencyDollarIcon, QuestionIcon, HardDrivesIcon, SparkleIcon,
} from '@phosphor-icons/react'
import { usePopoverLayer } from './PopoverLayer'
import { useColors } from '../theme'

export interface SlashCommand {
  command: string
  description: string
  icon: React.ReactNode
}

export const SLASH_COMMANDS: SlashCommand[] = [
  { command: '/clear', description: 'Clear conversation history', icon: <TrashIcon size={13} /> },
  { command: '/cost', description: 'Show token usage and cost', icon: <CurrencyDollarIcon size={13} /> },
  { command: '/model', description: 'Show current model info', icon: <CpuIcon size={13} /> },
  { command: '/mcp', description: 'Show MCP server status', icon: <HardDrivesIcon size={13} /> },
  { command: '/skills', description: 'Show available skills', icon: <SparkleIcon size={13} /> },
  { command: '/help', description: 'Show available commands', icon: <QuestionIcon size={13} /> },
]

interface Props {
  filter: string
  selectedIndex: number
  onSelect: (cmd: SlashCommand) => void
  anchorRect: DOMRect | null
  extraCommands?: SlashCommand[]
}

export function getFilteredCommands(filter: string): SlashCommand[] {
  return getFilteredCommandsWithExtras(filter, [])
}

export function getFilteredCommandsWithExtras(filter: string, extraCommands: SlashCommand[]): SlashCommand[] {
  const q = filter.toLowerCase()
  const merged: SlashCommand[] = [...SLASH_COMMANDS]
  for (const cmd of extraCommands) {
    if (!merged.some((c) => c.command === cmd.command)) {
      merged.push(cmd)
    }
  }
  return merged.filter((c) => c.command.startsWith(q))
}

export function SlashCommandMenu({ filter, selectedIndex, onSelect, anchorRect, extraCommands = [] }: Props) {
  const listRef = useRef<HTMLDivElement>(null)
  const popoverLayer = usePopoverLayer()
  const filtered = getFilteredCommandsWithExtras(filter, extraCommands)
  const colors = useColors()

  useEffect(() => {
    if (!listRef.current) return
    const item = listRef.current.children[selectedIndex] as HTMLElement | undefined
    item?.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex])

  if (filtered.length === 0 || !anchorRect || !popoverLayer) return null

  return createPortal(
    <motion.div
      data-orbiter-ui
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 4 }}
      transition={{ duration: 0.12 }}
      style={{
        position: 'fixed',
        bottom: window.innerHeight - anchorRect.top + 4,
        left: anchorRect.left + 12,
        right: window.innerWidth - anchorRect.right + 12,
        pointerEvents: 'auto',
      }}
    >
      <div
        ref={listRef}
        className="overflow-y-auto rounded-xl py-1 bg-popover-bg border border-popover-border max-h-[220px] backdrop-blur-[20px]"
        style={{ boxShadow: colors.popoverShadow }}
      >
        {filtered.map((cmd, i) => {
          const isSelected = i === selectedIndex
          return (
            <button
              key={cmd.command}
              onClick={() => onSelect(cmd)}
              className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-left transition-colors hover:bg-accent-light ${isSelected ? 'bg-accent-light' : 'bg-transparent'}`}
            >
              <span
                className={`flex items-center justify-center w-6 h-6 rounded-md flex-shrink-0 ${isSelected ? 'bg-accent-soft text-accent' : 'bg-surface-hover text-text-tertiary'}`}
              >
                {cmd.icon}
              </span>
              <div className="min-w-0 flex-1">
                <span
                  className={`text-[12px] font-mono font-medium transition-colors ${isSelected ? 'text-accent' : 'text-text-primary'}`}
                >
                  {cmd.command}
                </span>
                <span
                  className="text-[11px] ml-2 text-text-tertiary"
                >
                  {cmd.description}
                </span>
              </div>
            </button>
          )
        })}
      </div>
    </motion.div>,
    popoverLayer,
  )
}
