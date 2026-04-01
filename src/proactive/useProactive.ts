import { useEffect } from 'react'
import { TICK_TAG } from '../constants/xml.js'
import {
  getNextTickAt,
  initProactive,
  isProactiveActive,
  scheduleNextTick,
} from './index.js'

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
  onSubmitTick,
  onQueueTick,
}: UseProactiveParams): void {
  useEffect(() => {
    initProactive()
  }, [])

  useEffect(() => {
    const timer = setInterval(() => {
      if (!isProactiveActive()) {
        return
      }

      const nextTickAt = getNextTickAt()
      if (nextTickAt === null || Date.now() < nextTickAt) {
        return
      }

      const tickContent = `<${TICK_TAG}>${new Date().toLocaleTimeString()}</${TICK_TAG}>`

      if (isInPlanMode || hasActiveLocalJsxUI) {
        scheduleNextTick()
        return
      }

      if (isLoading || queuedCommandsLength > 0) {
        onQueueTick(tickContent)
      } else {
        onSubmitTick(tickContent)
      }

      scheduleNextTick()
    }, 1000)

    return () => {
      clearInterval(timer)
    }
  }, [
    hasActiveLocalJsxUI,
    isInPlanMode,
    isLoading,
    onQueueTick,
    onSubmitTick,
    queuedCommandsLength,
  ])
}
