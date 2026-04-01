import type { AssistantMessage, Message } from '../../types/message.js'
import { randomUUID } from '../../utils/crypto.js'
import { createSignal } from '../../utils/signal.js'
import { isPromptTooLongMessage } from '../api/errors.js'
import { projectView } from './operations.js'
import { persistCommit, persistSnapshot } from './persist.js'
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
    collapseId: String(Date.now()),
    summaryUuid: randomUUID(),
    summaryContent: `<collapsed id="${Date.now()}">${first.summary}</collapsed>`,
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

  void persistCommit({
    collapseId: commit.collapseId,
    summaryUuid: commit.summaryUuid,
    summaryContent: commit.summaryContent,
    summary: commit.summary,
    firstArchivedUuid: commit.firstArchivedUuid,
    lastArchivedUuid: commit.lastArchivedUuid,
  })
  void persistSnapshot({
    staged: next.snapshot?.staged ?? [],
    armed: next.snapshot?.armed ?? false,
    lastSpawnTokens: next.snapshot?.lastSpawnTokens ?? 0,
  })

  return {
    committed: 1,
    messages: projectView(messages),
  }
}
