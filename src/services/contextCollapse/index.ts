import type { AssistantMessage, Message } from '../../types/message.js'
import { createSignal } from '../../utils/signal.js'
import {
  createDefaultStore,
  createStatsFromEntries,
  getContextCollapseStore,
  getEmptyContextCollapseStats,
  resetContextCollapseStore,
  setContextCollapseStore,
  type ContextCollapseStats,
} from './state.js'

type Listener = () => void

const changed = createSignal()

function notifyChange(): void {
  changed.emit()
}

function isEnvTruthy(value: string | undefined): boolean {
  if (!value) return false
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase())
}

function getRuntimeEnabled(): boolean {
  return isEnvTruthy(process.env.CLAUDE_CONTEXT_COLLAPSE)
}

export function initContextCollapse(): void {
  const current = getContextCollapseStore()
  setContextCollapseStore({
    ...current,
    enabled: getRuntimeEnabled(),
    stats:
      current.commits.length > 0 || current.snapshot
        ? createStatsFromEntries(current.commits, current.snapshot)
        : getEmptyContextCollapseStats(),
  })
  notifyChange()
}

export function isContextCollapseEnabled(): boolean {
  return getContextCollapseStore().enabled
}

export function subscribe(listener: Listener): () => void {
  return changed.subscribe(listener)
}

export function getStats(): ContextCollapseStats {
  return getContextCollapseStore().stats
}

export function resetContextCollapse(): void {
  const enabled = isContextCollapseEnabled()
  resetContextCollapseStore()
  if (enabled) {
    setContextCollapseStore({
      ...createDefaultStore(),
      enabled,
    })
  }
  notifyChange()
}

export async function applyCollapsesIfNeeded(
  messages: Message[],
): Promise<{ messages: Message[] }> {
  const current = getContextCollapseStore()
  if (!current.enabled) {
    return { messages }
  }
  if (current.snapshot) {
    setContextCollapseStore({
      ...current,
      stats: createStatsFromEntries(current.commits, current.snapshot),
    })
    notifyChange()
  }
  return { messages }
}

export function isWithheldPromptTooLong(
  _message: AssistantMessage | undefined,
  _isPromptTooLongMessage: (message: AssistantMessage) => boolean,
  _querySource: string,
): boolean {
  return false
}

export function recoverFromOverflow(messages: Message[]): {
  committed: number
  messages: Message[]
} {
  return { committed: 0, messages }
}
