import type { Message, SystemMessage } from '../../types/message.js'

export type SnipBoundaryMessage = SystemMessage & {
  subtype: 'snip_boundary'
  snipMetadata?: {
    removedCount: number
  }
}

export type SnipMarkerMessage = Message & {
  snipMarker?: true
}

export type SnipCompactResult = {
  messages: Message[]
  tokensFreed: number
  boundaryMessage?: SnipBoundaryMessage
}

export function isSnipRuntimeEnabled(): boolean {
  return true
}

export function isSnipMarkerMessage(message: unknown): message is SnipMarkerMessage {
  return (
    typeof message === 'object' &&
    message !== null &&
    'snipMarker' in message &&
    message.snipMarker === true
  )
}

export function shouldNudgeForSnips(_messages: Message[]): boolean {
  return false
}

export function snipCompactIfNeeded(
  messages: Message[],
  _options?: { force?: boolean },
): SnipCompactResult {
  return {
    messages,
    tokensFreed: 0,
  }
}

