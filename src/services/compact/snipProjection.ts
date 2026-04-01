import type { Message } from '../../types/message.js'

export function isSnipBoundaryMessage(message: unknown): boolean {
  return (
    typeof message === 'object' &&
    message !== null &&
    'type' in message &&
    message.type === 'system' &&
    'subtype' in message &&
    message.subtype === 'snip_boundary'
  )
}

export function projectSnippedView<T extends Message>(messages: T[]): T[] {
  return messages.filter(message => {
    if (isSnipBoundaryMessage(message)) {
      return true
    }
    return !('snipMarker' in message && message.snipMarker === true)
  })
}

