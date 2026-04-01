import { createSignal } from '../utils/signal.js'
import { getInitialSettings } from '../utils/settings/settings.js'

type ProactiveState = {
  active: boolean
  paused: boolean
  contextBlocked: boolean
  nextTickAt: number | null
}

const DEFAULT_TICK_INTERVAL_MS = 60_000

const changed = createSignal()

let state: ProactiveState = {
  active: false,
  paused: false,
  contextBlocked: false,
  nextTickAt: null,
}

function notify(): void {
  changed.emit()
}

function isEnvTruthy(value: string | undefined): boolean {
  if (!value) return false
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase())
}

function isRuntimeEnabled(): boolean {
  return (
    isEnvTruthy(process.env.CLAUDE_CODE_PROACTIVE) ||
    isEnvTruthy(process.env.CLAUDE_CODE_KAIROS)
  )
}

function getTickIntervalMs(): number {
  const fromEnv = Number.parseInt(
    process.env.CLAUDE_CODE_PROACTIVE_TICK_MS ?? '',
    10,
  )
  if (Number.isFinite(fromEnv) && fromEnv > 0) {
    return fromEnv
  }

  const fromSettings = getInitialSettings().minSleepDurationMs
  if (typeof fromSettings === 'number' && Number.isFinite(fromSettings)) {
    if (fromSettings > 0) {
      return fromSettings
    }
  }

  return DEFAULT_TICK_INTERVAL_MS
}

function computeNextTickAt(baseTime: number = Date.now()): number {
  return baseTime + getTickIntervalMs()
}

export function subscribeToProactiveChanges(listener: () => void): () => void {
  return changed.subscribe(listener)
}

export function isProactiveActive(): boolean {
  return state.active && !state.paused
}

export function isProactivePaused(): boolean {
  return state.paused || state.contextBlocked
}

export function getNextTickAt(): number | null {
  return isProactiveActive() && !state.contextBlocked ? state.nextTickAt : null
}

export function scheduleNextTick(baseTime?: number): void {
  if (!state.active) {
    return
  }
  state = {
    ...state,
    nextTickAt: computeNextTickAt(baseTime),
  }
  notify()
}

export function activateProactive(_source: string = 'command'): void {
  state = {
    ...state,
    active: true,
    paused: false,
    contextBlocked: false,
    nextTickAt: computeNextTickAt(),
  }
  notify()
}

export function deactivateProactive(): void {
  state = {
    ...state,
    active: false,
    paused: false,
    contextBlocked: false,
    nextTickAt: null,
  }
  notify()
}

export function pauseProactive(): void {
  if (!state.paused) {
    state = { ...state, paused: true }
    notify()
  }
}

export function resumeProactive(): void {
  if (state.paused || state.contextBlocked) {
    state = {
      ...state,
      paused: false,
      nextTickAt: state.active ? (state.nextTickAt ?? computeNextTickAt()) : null,
    }
    notify()
  }
}

export function setContextBlocked(contextBlocked: boolean): void {
  if (state.contextBlocked !== contextBlocked) {
    state = {
      ...state,
      contextBlocked,
      nextTickAt:
        !contextBlocked && state.active
          ? (state.nextTickAt ?? computeNextTickAt())
          : state.nextTickAt,
    }
    notify()
  }
}

export function initProactive(): void {
  const active = isRuntimeEnabled()
  state = {
    ...state,
    active,
    nextTickAt: active ? computeNextTickAt() : null,
  }
  notify()
}

export function clearProactiveState(): void {
  state = {
    active: false,
    paused: false,
    contextBlocked: false,
    nextTickAt: null,
  }
  notify()
}
