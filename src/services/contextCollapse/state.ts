import type {
  ContextCollapseCommitEntry,
  ContextCollapseSnapshotEntry,
} from '../../types/logs.js'

export type ContextCollapseHealth = {
  totalSpawns: number
  totalErrors: number
  totalEmptySpawns: number
  emptySpawnWarningEmitted: boolean
  lastError: string | null
}

export type ContextCollapseStats = {
  collapsedSpans: number
  collapsedMessages: number
  stagedSpans: number
  health: ContextCollapseHealth
}

export type ContextCollapseStore = {
  enabled: boolean
  commits: ContextCollapseCommitEntry[]
  snapshot?: ContextCollapseSnapshotEntry
  stats: ContextCollapseStats
}

const DEFAULT_HEALTH: ContextCollapseHealth = {
  totalSpawns: 0,
  totalErrors: 0,
  totalEmptySpawns: 0,
  emptySpawnWarningEmitted: false,
  lastError: null,
}

const DEFAULT_STATS: ContextCollapseStats = {
  collapsedSpans: 0,
  collapsedMessages: 0,
  stagedSpans: 0,
  health: { ...DEFAULT_HEALTH },
}

function cloneStats(stats: ContextCollapseStats): ContextCollapseStats {
  return {
    collapsedSpans: stats.collapsedSpans,
    collapsedMessages: stats.collapsedMessages,
    stagedSpans: stats.stagedSpans,
    health: { ...stats.health },
  }
}

export function createDefaultStore(): ContextCollapseStore {
  return {
    enabled: false,
    commits: [],
    snapshot: undefined,
    stats: cloneStats(DEFAULT_STATS),
  }
}

export function estimateCollapsedMessages(
  commits: ContextCollapseCommitEntry[],
): number {
  return commits.reduce((total, commit) => {
    return total + Math.max(1, commit.summaryContent.split('\n').length)
  }, 0)
}

export function createStatsFromEntries(
  commits: ContextCollapseCommitEntry[],
  snapshot?: ContextCollapseSnapshotEntry,
): ContextCollapseStats {
  return {
    collapsedSpans: commits.length,
    collapsedMessages: estimateCollapsedMessages(commits),
    stagedSpans: snapshot?.staged.length ?? 0,
    health: {
      ...DEFAULT_HEALTH,
      totalSpawns: commits.length + (snapshot?.staged.length ?? 0),
    },
  }
}

let store = createDefaultStore()

export function getContextCollapseStore(): ContextCollapseStore {
  return store
}

export function setContextCollapseStore(next: ContextCollapseStore): void {
  store = next
}

export function resetContextCollapseStore(): void {
  store = createDefaultStore()
}

export function getEmptyContextCollapseStats(): ContextCollapseStats {
  return cloneStats(DEFAULT_STATS)
}
