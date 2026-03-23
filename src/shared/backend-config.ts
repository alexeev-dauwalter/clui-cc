import type { BackendType } from './types'

export interface BackendModelEntry {
  id: string
  label: string
}

export interface BackendConfig {
  type: BackendType
  displayName: string
  cliCommand: string
  /** Fallback model list — used until CLI returns actual list */
  fallbackModels: BackendModelEntry[]
  defaultModel: string
}

export const BACKEND_CONFIGS: Record<BackendType, BackendConfig> = {
  claude: {
    type: 'claude',
    displayName: 'Claude',
    cliCommand: 'claude',
    fallbackModels: [
      { id: 'claude-opus-4-6', label: 'Opus 4.6' },
      { id: 'claude-sonnet-4-6', label: 'Sonnet 4.6' },
      { id: 'claude-haiku-4-5-20251001', label: 'Haiku 4.5' },
    ],
    defaultModel: 'claude-opus-4-6',
  },
  codex: {
    type: 'codex',
    displayName: 'Codex',
    cliCommand: 'codex',
    fallbackModels: [
      { id: 'gpt-5.4', label: '5.4' },
      { id: 'gpt-5.4-mini', label: '5.4 Mini' },
      { id: 'gpt-5.3-codex', label: '5.3 Codex' },
      { id: 'gpt-5.2-codex', label: '5.2 Codex' },
      { id: 'gpt-5.2', label: '5.2' },
      { id: 'gpt-5.1-codex-max', label: '5.1 Max' },
      { id: 'gpt-5.1-codex-mini', label: '5.1 Mini' },
    ],
    defaultModel: 'gpt-5.4',
  },
}
