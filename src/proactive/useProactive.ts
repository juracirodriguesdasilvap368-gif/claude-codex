import { useEffect } from 'react'
import { getNextTickAt, initProactive } from './index.js'

type UseProactiveParams = {
  isLoading: boolean
  queuedCommandsLength: number
  hasActiveLocalJsxUI: boolean
  isInPlanMode: boolean
  onSubmitTick: (prompt: string) => void
  onQueueTick: (prompt: string) => void
}

export function useProactive({
  isLoading,
  queuedCommandsLength,
  hasActiveLocalJsxUI,
  isInPlanMode,
}: UseProactiveParams): void {
  useEffect(() => {
    initProactive()
  }, [])

  useEffect(() => {
    if (isLoading || queuedCommandsLength > 0 || hasActiveLocalJsxUI) return
    if (isInPlanMode) return
    void getNextTickAt()
  }, [hasActiveLocalJsxUI, isInPlanMode, isLoading, queuedCommandsLength])
}
