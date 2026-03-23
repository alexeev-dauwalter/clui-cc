import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { XIcon, FileTextIcon, ImageIcon, FileCodeIcon, FileIcon } from '@phosphor-icons/react'
import type { Attachment } from '../../shared/types'

const FILE_ICONS: Record<string, React.ReactNode> = {
  'image/png': <ImageIcon size={14} />,
  'image/jpeg': <ImageIcon size={14} />,
  'image/gif': <ImageIcon size={14} />,
  'image/webp': <ImageIcon size={14} />,
  'image/svg+xml': <ImageIcon size={14} />,
  'text/plain': <FileTextIcon size={14} />,
  'text/markdown': <FileTextIcon size={14} />,
  'application/json': <FileCodeIcon size={14} />,
  'text/yaml': <FileCodeIcon size={14} />,
  'text/toml': <FileCodeIcon size={14} />,
}

export function AttachmentChips({
  attachments,
  onRemove,
}: {
  attachments: Attachment[]
  onRemove: (id: string) => void
}) {
  if (attachments.length === 0) return null

  return (
    <div data-orbiter-ui className="flex gap-1.5 pb-1 overflow-x-auto">
      <AnimatePresence mode="popLayout">
        {attachments.map((a) => (
          <motion.div
            key={a.id}
            layout
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.85 }}
            transition={{ duration: 0.12 }}
            className="flex items-center gap-1.5 group flex-shrink-0 bg-surface-primary border border-surface-secondary rounded-[14px] max-w-[200px]"
            style={{
              padding: a.dataUrl ? '3px 8px 3px 3px' : '4px 8px',
            }}
          >
            {/* Image preview thumbnail */}
            {a.dataUrl ? (
              <img
                src={a.dataUrl}
                alt={a.name}
                className="rounded-[10px] object-cover flex-shrink-0 w-6 h-6"
              />
            ) : (
              <span className="flex-shrink-0 text-text-tertiary">
                {FILE_ICONS[a.mimeType || ''] || <FileIcon size={14} />}
              </span>
            )}

            {/* File name */}
            <span
              className="text-[11px] font-medium truncate min-w-0 flex-1 text-text-primary"
            >
              {a.name}
            </span>

            {/* Remove button */}
            <button
              onClick={() => onRemove(a.id)}
              className="flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-text-tertiary"
            >
              <XIcon size={10} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
