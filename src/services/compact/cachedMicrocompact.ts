import {
  getCachedMCConfig as getCachedMCConfigFromFile,
  type CachedMCConfig,
} from './cachedMCConfig.js'

export type CacheEditsBlock = {
  type: 'cache_edits'
  edits: { type: 'delete'; cache_reference: string }[]
}

export type PinnedCacheEdits = {
  userMessageIndex: number
  block: CacheEditsBlock
}

export type CachedMCState = {
  registeredTools: Set<string>
  toolOrder: string[]
  deletedRefs: Set<string>
  pinnedEdits: PinnedCacheEdits[]
  pendingMessageGroups: string[][]
}

export function createCachedMCState(): CachedMCState {
  return {
    registeredTools: new Set(),
    toolOrder: [],
    deletedRefs: new Set(),
    pinnedEdits: [],
    pendingMessageGroups: [],
  }
}

export function getCachedMCConfig(): CachedMCConfig {
  return getCachedMCConfigFromFile()
}

export function isCachedMicrocompactEnabled(): boolean {
  return getCachedMCConfig().enabled
}

export function isModelSupportedForCacheEditing(model: string): boolean {
  const supportedModels = getCachedMCConfig().supportedModels
  return supportedModels.some(pattern => model.includes(pattern))
}

export function registerToolResult(
  state: CachedMCState,
  toolUseId: string,
): void {
  if (state.registeredTools.has(toolUseId)) {
    return
  }
  state.registeredTools.add(toolUseId)
  state.toolOrder.push(toolUseId)
}

export function registerToolMessage(
  state: CachedMCState,
  toolUseIds: string[],
): void {
  if (toolUseIds.length === 0) return
  state.pendingMessageGroups.push([...toolUseIds])
}

export function getToolResultsToDelete(state: CachedMCState): string[] {
  const config = getCachedMCConfig()
  const activeTools = state.toolOrder.filter(id => !state.deletedRefs.has(id))
  if (activeTools.length < config.triggerThreshold) {
    return []
  }

  const keepRecent = Math.max(1, config.keepRecent)
  const keep = new Set(activeTools.slice(-keepRecent))
  return activeTools.filter(id => !keep.has(id))
}

export function createCacheEditsBlock(
  state: CachedMCState,
  toolIds: string[],
): CacheEditsBlock | null {
  const edits = toolIds
    .filter(id => !state.deletedRefs.has(id))
    .map(id => {
      state.deletedRefs.add(id)
      return { type: 'delete' as const, cache_reference: id }
    })

  if (edits.length === 0) {
    return null
  }

  return {
    type: 'cache_edits',
    edits,
  }
}

export function markToolsSentToAPI(state: CachedMCState): void {
  state.pendingMessageGroups.length = 0
}

export function resetCachedMCState(state: CachedMCState): void {
  state.registeredTools.clear()
  state.toolOrder.length = 0
  state.deletedRefs.clear()
  state.pinnedEdits.length = 0
  state.pendingMessageGroups.length = 0
}
