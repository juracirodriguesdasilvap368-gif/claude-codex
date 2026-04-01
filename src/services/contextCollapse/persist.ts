import type {
  ContextCollapseCommitEntry,
  ContextCollapseSnapshotEntry,
} from '../../types/logs.js'
import {
  recordContextCollapseCommit,
  recordContextCollapseSnapshot,
} from '../../utils/sessionStorage.js'
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

export async function persistCommit(
  commit: Pick<
    ContextCollapseCommitEntry,
    | 'collapseId'
    | 'summaryUuid'
    | 'summaryContent'
    | 'summary'
    | 'firstArchivedUuid'
    | 'lastArchivedUuid'
  >,
): Promise<void> {
  await recordContextCollapseCommit(commit)
}

export async function persistSnapshot(
  snapshot: Pick<
    ContextCollapseSnapshotEntry,
    'staged' | 'armed' | 'lastSpawnTokens'
  >,
): Promise<void> {
  await recordContextCollapseSnapshot(snapshot)
}
