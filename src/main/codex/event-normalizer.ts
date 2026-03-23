import type { NormalizedEvent } from '../../shared/types'
import { log } from '../logger'

// ─── Codex NDJSON Event Types (codex-cli 0.101.0, verified format) ───

interface CodexItem {
  id: string
  type: 'agent_message' | 'reasoning' | 'command_execution' | 'file_change' | 'mcp_tool_call'
  text?: string
  command?: string
  aggregated_output?: string
  exit_code?: number | null
  status?: string
}

interface CodexThreadStarted {
  type: 'thread.started'
  thread_id: string
  model?: string
  tools?: string[]
}

interface CodexTurnStarted {
  type: 'turn.started'
}

interface CodexItemStarted {
  type: 'item.started'
  item: CodexItem
}

interface CodexItemUpdated {
  type: 'item.updated'
  item: CodexItem
  delta?: string
  partial_input?: string
}

interface CodexItemCompleted {
  type: 'item.completed'
  item: CodexItem
}

interface CodexTurnCompleted {
  type: 'turn.completed'
  usage?: { input_tokens?: number; cached_input_tokens?: number; output_tokens?: number }
}

interface CodexTurnFailed {
  type: 'turn.failed'
  error?: string | { message: string }
}

interface CodexErrorEvent {
  type: 'error'
  message?: string
  error?: string
}

interface CodexApprovalRequest {
  type: 'approval.requested'
  question_id: string
  tool_name: string
  tool_input?: Record<string, unknown>
}

interface CodexUnknownEvent {
  type: string
  [key: string]: unknown
}

export type CodexEvent =
  | CodexThreadStarted
  | CodexTurnStarted
  | CodexItemStarted
  | CodexItemUpdated
  | CodexItemCompleted
  | CodexTurnCompleted
  | CodexTurnFailed
  | CodexErrorEvent
  | CodexApprovalRequest
  | CodexUnknownEvent

const TOOL_ITEM_TYPES = new Set(['command_execution', 'file_change', 'mcp_tool_call'])

/**
 * Stateful normalizer for Codex NDJSON events.
 * Tracks threadId (absent from turn.completed) and accumulated text.
 * Create one instance per run.
 */
export class CodexNormalizer {
  private threadId = ''
  private streamedItems = new Set<string>()
  private accumulatedText = ''

  normalize(raw: CodexEvent): NormalizedEvent[] {
    switch (raw.type) {
      case 'thread.started': {
        const ev = raw as CodexThreadStarted
        this.threadId = ev.thread_id
        return [{
          type: 'session_init',
          sessionId: ev.thread_id,
          tools: ev.tools || [],
          model: ev.model || '',
          mcpServers: [],
          skills: [],
          version: 'codex',
        }]
      }

      case 'turn.started':
        return []

      case 'item.started': {
        const ev = raw as CodexItemStarted
        const item = ev.item
        if (!item) return []

        if (TOOL_ITEM_TYPES.has(item.type)) {
          // Extract shell command from full path (e.g. "/usr/bin/zsh -lc ls" → "ls")
          const fullCmd = item.command || item.type
          const lcMatch = fullCmd.match(/-lc\s+(.+)$/)
          const shellCmd = lcMatch ? lcMatch[1] : fullCmd

          const events: NormalizedEvent[] = [
            { type: 'tool_call', toolName: 'Bash', toolId: item.id, index: 0 },
          ]
          // Send command as tool input so the tool card shows what's being run
          if (shellCmd) {
            events.push({
              type: 'tool_call_update',
              toolId: item.id,
              partialInput: JSON.stringify({ command: shellCmd }),
            })
          }
          return events
        }
        return []
      }

      case 'item.updated': {
        const ev = raw as CodexItemUpdated
        const item = ev.item
        if (!item) return []

        if (item.type === 'agent_message' && ev.delta) {
          this.streamedItems.add(item.id)
          this.accumulatedText += ev.delta
          return [{ type: 'text_chunk', text: ev.delta }]
        }
        if (TOOL_ITEM_TYPES.has(item.type) && ev.partial_input) {
          return [{
            type: 'tool_call_update',
            toolId: item.id,
            partialInput: ev.partial_input,
          }]
        }
        return []
      }

      case 'item.completed': {
        const ev = raw as CodexItemCompleted
        const item = ev.item
        if (!item) return []

        // Reasoning items — emit as thinking block
        if (item.type === 'reasoning') {
          if (item.text) return [{ type: 'thinking_chunk', text: item.text }]
          return []
        }

        // Tool completed — emit output before marking complete
        if (TOOL_ITEM_TYPES.has(item.type)) {
          const events: NormalizedEvent[] = []
          if (item.aggregated_output) {
            events.push({
              type: 'tool_call_update',
              toolId: item.id,
              partialInput: JSON.stringify({ output: item.aggregated_output, exit_code: item.exit_code }),
            })
          }
          events.push({ type: 'tool_call_complete', index: 0 })
          return events
        }

        // Agent message completed — emit text if not already streamed via deltas
        if (item.type === 'agent_message') {
          if (!this.streamedItems.has(item.id) && item.text) {
            this.accumulatedText += item.text
            return [{ type: 'text_chunk', text: item.text }]
          }
          this.streamedItems.delete(item.id)
        }
        return []
      }

      case 'turn.completed': {
        const ev = raw as CodexTurnCompleted
        const result = this.accumulatedText
        this.streamedItems.clear()
        this.accumulatedText = ''

        const usage = ev.usage || {}
        return [{
          type: 'task_complete',
          result,
          costUsd: 0,
          durationMs: 0,
          numTurns: 1,
          usage: {
            input_tokens: usage.input_tokens,
            output_tokens: usage.output_tokens,
            cache_read_input_tokens: usage.cached_input_tokens,
          },
          sessionId: this.threadId,
        }]
      }

      case 'turn.failed': {
        const ev = raw as CodexTurnFailed
        const errMsg = typeof ev.error === 'object' && ev.error?.message
          ? ev.error.message
          : typeof ev.error === 'string'
            ? ev.error
            : 'Turn failed'
        return [{
          type: 'error',
          message: errMsg,
          isError: true,
          sessionId: this.threadId,
        }]
      }

      case 'error': {
        const ev = raw as CodexErrorEvent
        return [{
          type: 'error',
          message: ev.message || ev.error || 'Unknown Codex error',
          isError: true,
        }]
      }

      case 'approval.requested': {
        const ev = raw as CodexApprovalRequest
        return [{
          type: 'permission_request',
          questionId: `codex-${ev.question_id}`,
          toolName: ev.tool_name,
          toolDescription: undefined,
          toolInput: ev.tool_input,
          options: [
            { id: 'accept', label: 'Allow', kind: 'allow' },
            { id: 'decline', label: 'Deny', kind: 'deny' },
          ],
        }]
      }

      default:
        if (raw.type) {
          log('CodexNormalizer', `Unhandled event type: ${raw.type}`)
        }
        return []
    }
  }
}
