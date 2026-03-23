import { spawn, execSync, ChildProcess } from 'child_process'
import { existsSync } from 'fs'
import { EventEmitter } from 'events'
import { homedir } from 'os'
import { join, dirname } from 'path'
import { StreamParser } from '../stream-parser'
import { CodexNormalizer, type CodexEvent } from './event-normalizer'
import { log as _log } from '../logger'
import { getCliEnv } from '../cli-env'
import type { NormalizedEvent, RunOptions, EnrichedError } from '../../shared/types'

const MAX_RING_LINES = 100

function log(msg: string): void {
  _log('CodexRunManager', msg)
}

export interface RunHandle {
  runId: string
  sessionId: string | null
  process: ChildProcess
  pid: number | null
  startedAt: number
  stderrTail: string[]
  stdoutTail: string[]
  toolCallCount: number
  sawPermissionRequest: boolean
}

/**
 * CodexRunManager: spawns `codex exec --json` per run, parses NDJSON,
 * emits normalized events. Same public API as Claude RunManager.
 *
 * Events: 'normalized', 'raw', 'exit', 'error'
 */
export class CodexRunManager extends EventEmitter {
  private activeRuns = new Map<string, RunHandle>()
  private _finishedRuns = new Map<string, RunHandle>()
  private codexBinary: string

  constructor() {
    super()
    this.codexBinary = this._findCodexBinary()
    log(`Codex binary: ${this.codexBinary}`)
  }

  private _findCodexBinary(): string {
    // 1. Try to find the real Rust binary inside npm/yarn vendor dirs.
    //    The npm `@openai/codex` package installs a Node.js wrapper at `codex`
    //    which delegates to a platform-specific Rust binary. spawn() without
    //    shell doesn't handle shebangs, so we locate the real binary directly.
    const realBinary = this._findVendoredBinary()
    if (realBinary) return realBinary

    // 2. Direct path candidates (standalone install, not npm wrapper)
    const candidates = [
      '/usr/local/bin/codex',
      ...(process.platform === 'darwin'
        ? ['/opt/homebrew/bin/codex']
        : ['/usr/bin/codex', join(homedir(), '.local/bin/codex')]),
      join(homedir(), '.yarn/bin/codex'),
      join(homedir(), '.npm-global/bin/codex'),
    ]

    for (const c of candidates) {
      try {
        execSync(`test -x "${c}"`, { stdio: 'ignore' })
        return c
      } catch {}
    }

    // 3. Shell fallback — find whatever is in PATH
    const shellCommands: string[] = process.platform === 'darwin'
      ? ['/bin/zsh -ilc "whence -p codex"', '/bin/bash -lc "which codex"']
      : [`${process.env.SHELL || '/bin/bash'} -lc "which codex"`, '/bin/bash -lc "which codex"']

    for (const cmd of shellCommands) {
      try {
        const result = execSync(cmd, { encoding: 'utf-8', env: getCliEnv() }).trim()
        if (result) return result
      } catch {}
    }

    return 'codex'
  }

  /**
   * Find the real Rust codex binary inside npm/yarn vendor directories.
   * This mirrors the logic from the Node.js wrapper (@openai/codex/bin/codex).
   */
  private _findVendoredBinary(): string | null {
    const { platform, arch } = process
    let targetTriple: string | null = null

    if (platform === 'linux' || platform === 'android') {
      if (arch === 'x64') targetTriple = 'x86_64-unknown-linux-musl'
      else if (arch === 'arm64') targetTriple = 'aarch64-unknown-linux-musl'
    } else if (platform === 'darwin') {
      if (arch === 'x64') targetTriple = 'x86_64-apple-darwin'
      else if (arch === 'arm64') targetTriple = 'aarch64-apple-darwin'
    } else if (platform === 'win32') {
      if (arch === 'x64') targetTriple = 'x86_64-pc-windows-msvc'
      else if (arch === 'arm64') targetTriple = 'aarch64-pc-windows-msvc'
    }

    if (!targetTriple) return null

    const platformPkg: Record<string, string> = {
      'x86_64-unknown-linux-musl': '@openai/codex-linux-x64',
      'aarch64-unknown-linux-musl': '@openai/codex-linux-arm64',
      'x86_64-apple-darwin': '@openai/codex-darwin-x64',
      'aarch64-apple-darwin': '@openai/codex-darwin-arm64',
      'x86_64-pc-windows-msvc': '@openai/codex-win32-x64',
      'aarch64-pc-windows-msvc': '@openai/codex-win32-arm64',
    }
    const pkgName = platformPkg[targetTriple]
    if (!pkgName) return null

    const binaryName = platform === 'win32' ? 'codex.exe' : 'codex'

    // Search common global node_modules locations for the platform package
    const globalRoots = [
      join(homedir(), '.config/yarn/global/node_modules'),
      join(homedir(), '.npm-global/lib/node_modules'),
      '/usr/local/lib/node_modules',
      '/usr/lib/node_modules',
    ]

    // Also check npm root -g
    try {
      const npmRoot = execSync('npm root -g', { encoding: 'utf-8', timeout: 3000, env: getCliEnv() }).trim()
      if (npmRoot && !globalRoots.includes(npmRoot)) {
        globalRoots.unshift(npmRoot)
      }
    } catch {}

    for (const root of globalRoots) {
      const vendorBin = join(root, pkgName, 'vendor', targetTriple, 'codex', binaryName)
      if (existsSync(vendorBin)) {
        return vendorBin
      }
    }

    return null
  }

  private _getEnv(): NodeJS.ProcessEnv {
    const env = getCliEnv()
    const binDir = dirname(this.codexBinary)
    const extraDirs: string[] = [binDir]

    // For vendored binaries, also add the sibling `path/` directory
    // (contains helper binaries like codex-sandbox-helper)
    const archRoot = dirname(binDir) // .../vendor/<triple>
    const pathDir = join(archRoot, 'path')
    if (existsSync(pathDir)) {
      extraDirs.push(pathDir)
    }

    if (env.PATH) {
      const existing = env.PATH.split(':')
      for (const d of extraDirs) {
        if (!existing.includes(d)) {
          env.PATH = `${d}:${env.PATH}`
        }
      }
    }
    return env
  }

  startRun(requestId: string, options: RunOptions): RunHandle {
    const cwd = options.projectPath === '~' ? homedir() : options.projectPath

    const args: string[] = []

    if (options.sessionId) {
      // Resume existing session
      args.push('exec', 'resume', options.sessionId, '--json')
    } else {
      args.push('exec', '--json')
    }

    if (options.model) {
      args.push('--model', options.model)
    }

    // -C flag is only supported by `codex exec`, not `codex exec resume`
    if (!options.sessionId) {
      args.push('-C', cwd)
    }

    // Prompt goes as the last positional argument
    args.push(options.prompt)

    log(`Starting run ${requestId}`)

    const child = spawn(this.codexBinary, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd,
      env: this._getEnv(),
    })

    log(`Spawned PID: ${child.pid}`)

    const handle: RunHandle = {
      runId: requestId,
      sessionId: null,
      process: child,
      pid: child.pid || null,
      startedAt: Date.now(),
      stderrTail: [],
      stdoutTail: [],
      toolCallCount: 0,
      sawPermissionRequest: false,
    }

    // stdout → NDJSON parser → Codex normalizer → events
    const parser = StreamParser.fromStream(child.stdout!)
    const normalizer = new CodexNormalizer()

    parser.on('event', (raw: CodexEvent) => {
      // Track session/thread ID
      if (raw.type === 'thread.started') {
        handle.sessionId = (raw as any).thread_id
      }

      if (raw.type === 'approval.requested') {
        handle.sawPermissionRequest = true
      }

      this._ringPush(handle.stdoutTail, JSON.stringify(raw).substring(0, 300))
      this.emit('raw', requestId, raw)

      const normalized = normalizer.normalize(raw)
      for (const evt of normalized) {
        if (evt.type === 'tool_call') handle.toolCallCount++
        this.emit('normalized', requestId, evt)
      }
    })

    parser.on('parse-error', (line: string) => {
      log(`Parse error [${requestId}]: ${line.substring(0, 200)}`)
      this._ringPush(handle.stderrTail, `[parse-error] ${line.substring(0, 200)}`)
    })

    // stderr ring buffer
    child.stderr?.setEncoding('utf-8')
    child.stderr?.on('data', (data: string) => {
      const lines = data.split('\n').filter((l: string) => l.trim())
      for (const line of lines) {
        this._ringPush(handle.stderrTail, line)
      }
      log(`Stderr [${requestId}]: ${data.trim().substring(0, 500)}`)
    })

    // Process lifecycle
    child.on('close', (code, signal) => {
      log(`Process closed [${requestId}]: code=${code} signal=${signal}`)
      this._finishedRuns.set(requestId, handle)
      this.activeRuns.delete(requestId)
      this.emit('exit', requestId, code, signal, handle.sessionId)
      setTimeout(() => this._finishedRuns.delete(requestId), 5000)
    })

    child.on('error', (err) => {
      log(`Process error [${requestId}]: ${err.message}`)
      this._finishedRuns.set(requestId, handle)
      this.activeRuns.delete(requestId)
      this.emit('error', requestId, err)
      setTimeout(() => this._finishedRuns.delete(requestId), 5000)
    })

    this.activeRuns.set(requestId, handle)
    return handle
  }

  /**
   * Write to stdin — used for permission responses.
   * Codex expects JSON decisions on stdin.
   */
  writeToStdin(requestId: string, message: object): boolean {
    const handle = this.activeRuns.get(requestId)
    if (!handle) return false
    if (!handle.process.stdin || handle.process.stdin.destroyed) return false

    const json = JSON.stringify(message)
    log(`Writing to stdin [${requestId}]: ${json.substring(0, 200)}`)
    handle.process.stdin.write(json + '\n')
    return true
  }

  cancel(requestId: string): boolean {
    const handle = this.activeRuns.get(requestId)
    if (!handle) return false

    log(`Cancelling run ${requestId}`)
    handle.process.kill('SIGINT')

    setTimeout(() => {
      if (handle.process.exitCode === null) {
        log(`Force killing run ${requestId} (SIGINT did not terminate)`)
        handle.process.kill('SIGKILL')
      }
    }, 5000)

    return true
  }

  getEnrichedError(requestId: string, exitCode: number | null): EnrichedError {
    const handle = this.activeRuns.get(requestId) || this._finishedRuns.get(requestId)
    return {
      message: `Run failed with exit code ${exitCode}`,
      stderrTail: handle?.stderrTail.slice(-20) || [],
      stdoutTail: handle?.stdoutTail.slice(-20) || [],
      exitCode,
      elapsedMs: handle ? Date.now() - handle.startedAt : 0,
      toolCallCount: handle?.toolCallCount || 0,
      sawPermissionRequest: handle?.sawPermissionRequest || false,
    }
  }

  isRunning(requestId: string): boolean {
    return this.activeRuns.has(requestId)
  }

  getHandle(requestId: string): RunHandle | undefined {
    return this.activeRuns.get(requestId)
  }

  private _ringPush(buffer: string[], line: string): void {
    buffer.push(line)
    if (buffer.length > MAX_RING_LINES) {
      buffer.shift()
    }
  }
}
