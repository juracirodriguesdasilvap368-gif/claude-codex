import type { AssistantMessage, Message } from '../../types/message.js'
import { createSignal } from '../../utils/signal.js'
import { isPromptTooLongMessage } from '../api/errors.js'
import { projectView } from './operations.js'
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
  _toolUseContext?: unknown,
  _querySource?: string,
): Promise<{ messages: Message[] }> {
  const current = getContextCollapseStore()
  if (!current.enabled) {
    return { messages }
  }
  const projected = projectView(messages)
  if (current.snapshot) {
    setContextCollapseStore({
      ...current,
      stats: createStatsFromEntries(current.commits, current.snapshot),
    })
    notifyChange()
  }
  return { messages: projected }
}

export function isWithheldPromptTooLong(
  message: AssistantMessage | undefined,
  isPromptTooLongPredicate: (message: AssistantMessage) => boolean,
  _querySource: string,
): boolean {
  if (!getContextCollapseStore().enabled || !message) {
    return false
  }
  return isPromptTooLongPredicate(message) || isPromptTooLongMessage(message)
}

export function recoverFromOverflow(messages: Message[]): {
  committed: number
  messages: Message[]
} {
  const current = getContextCollapseStore()
  if (!current.enabled || !current.snapshot || current.snapshot.staged.length === 0) {
    return { committed: 0, messages }
  }

  const [first, ...rest] = current.snapshot.staged
  if (!first) {
    return { committed: 0, messages }
  }

  const commit = {
    type: 'marble-origami-commit' as const,
    sessionId: current.snapshot.sessionId,
    collapseId: `${Date.now()}`,
    summaryUuid: `collapse-${Date.now()}`,
    summaryContent: first.summary,
    summary: first.summary,
    firstArchivedUuid: first.startUuid,
    lastArchivedUuid: first.endUuid,
  }

  const next = {
    ...current,
    commits: [...current.commits, commit],
    snapshot: {
      ...current.snapshot,
      staged: rest,
    },
  }
  setContextCollapseStore({
    ...next,
    stats: createStatsFromEntries(next.commits, next.snapshot),
  })
  notifyChange()

  return {
    committed: 1,
    messages: projectView(messages),
  }
}
