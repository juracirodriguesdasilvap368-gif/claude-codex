import { createSignal } from '../utils/signal.js'

type ProactiveState = {
  active: boolean
  paused: boolean
  contextBlocked: boolean
  nextTickAt: number | null
}

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

export function subscribeToProactiveChanges(listener: () => void): () => void {
  return changed.subscribe(listener)
}

export function isProactiveActive(): boolean {
  return state.active && !state.paused
}

export function getNextTickAt(): number | null {
  return isProactiveActive() && !state.contextBlocked ? state.nextTickAt : null
}

export function pauseProactive(): void {
  if (!state.paused) {
    state = { ...state, paused: true }
    notify()
  }
}

export function resumeProactive(): void {
  if (state.paused) {
    state = { ...state, paused: false }
    notify()
  }
}

export function setContextBlocked(contextBlocked: boolean): void {
  if (state.contextBlocked !== contextBlocked) {
    state = { ...state, contextBlocked }
    notify()
  }
}

export function initProactive(): void {
  const active = isRuntimeEnabled()
  state = {
    ...state,
    active,
    nextTickAt: active ? Date.now() + 60_000 : null,
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
