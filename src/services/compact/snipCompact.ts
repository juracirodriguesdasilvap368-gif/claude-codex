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

const SNIP_TRIGGER_MESSAGES = 120
const SNIP_KEEP_RECENT = 60
const NUDGE_TOKEN_INTERVAL = 10_000

function isEnvTruthy(value: string | undefined): boolean {
  if (!value) return false
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase())
}

function isBoundary(message: Message): boolean {
  return (
    message.type === 'system' &&
    (message.subtype === 'snip_boundary' || message.subtype === 'compact_boundary')
  )
}

function estimateMessageTokens(message: Message): number {
  if (message.type === 'assistant') {
    const text = JSON.stringify(message.message.content)
    return Math.ceil(text.length / 4)
  }
  if (message.type === 'user') {
    const text =
      typeof message.message.content === 'string'
        ? message.message.content
        : JSON.stringify(message.message.content)
    return Math.ceil(text.length / 4)
  }
  if (message.type === 'system') {
    return Math.ceil((message.content ?? '').length / 4)
  }
  return 0
}

export function isSnipRuntimeEnabled(): boolean {
  return isEnvTruthy(process.env.CLAUDE_CODE_HISTORY_SNIP)
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
  if (!isSnipRuntimeEnabled()) {
    return false
  }

  let lastBoundary = -1
  for (let i = _messages.length - 1; i >= 0; i -= 1) {
    const message = _messages[i]!
    if (isBoundary(message) || isSnipMarkerMessage(message)) {
      lastBoundary = i
      break
    }
  }

  const segment = _messages.slice(lastBoundary + 1)
  const tokenCount = segment.reduce(
    (total, message) => total + estimateMessageTokens(message),
    0,
  )
  return tokenCount >= NUDGE_TOKEN_INTERVAL
}

export function snipCompactIfNeeded(
  messages: Message[],
  options?: { force?: boolean },
): SnipCompactResult {
  if (!isSnipRuntimeEnabled() && !options?.force) {
    return { messages, tokensFreed: 0 }
  }

  if (messages.length <= SNIP_TRIGGER_MESSAGES && !options?.force) {
    return { messages, tokensFreed: 0 }
  }

  let boundaryIndex = -1
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (isBoundary(messages[i]!)) {
      boundaryIndex = i
      break
    }
  }

  const prefix = boundaryIndex >= 0 ? messages.slice(0, boundaryIndex + 1) : []
  const tail = messages.slice(boundaryIndex + 1)
  if (tail.length <= SNIP_KEEP_RECENT) {
    return { messages, tokensFreed: 0 }
  }

  const removed = tail.slice(0, tail.length - SNIP_KEEP_RECENT)
  const keptTail = tail.slice(tail.length - SNIP_KEEP_RECENT)
  const removedCount = removed.length
  if (removedCount === 0) {
    return { messages, tokensFreed: 0 }
  }

  const anchor = keptTail[0] ?? messages[messages.length - 1]
  const boundaryMessage: SnipBoundaryMessage = {
    type: 'system',
    subtype: 'snip_boundary',
    level: 'info',
    content: `Snipped ${removedCount} older messages to reduce context pressure.`,
    uuid: `snip-${Date.now()}`,
    timestamp: anchor?.timestamp ?? new Date().toISOString(),
    parentUuid: anchor?.parentUuid ?? null,
    isMeta: false,
    snipMetadata: { removedCount },
  }

  return {
    messages: [...prefix, boundaryMessage, ...keptTail],
    tokensFreed: removed.reduce(
      (total, message) => total + estimateMessageTokens(message),
      0,
    ),
    boundaryMessage,
  }
}

