import type {
  ContextCollapseCommitEntry,
  ContextCollapseSnapshotEntry,
} from '../../types/logs.js'
import {
  createDefaultStore,
  createStatsFromEntries,
  getContextCollapseStore,
  setContextCollapseStore,
} from './state.js'

export function restoreFromEntries(
  commits: ContextCollapseCommitEntry[],
  snapshot?: ContextCollapseSnapshotEntry,
): void {
  const current = getContextCollapseStore()
  const next = createDefaultStore()
  setContextCollapseStore({
    ...next,
    enabled: current.enabled,
    commits: [...commits],
    snapshot,
    stats: createStatsFromEntries(commits, snapshot),
  })
}
