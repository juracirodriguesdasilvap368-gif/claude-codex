import type { Message } from '../../types/message.js'
import { appendFile, mkdir } from 'fs/promises'
import { dirname, join } from 'path'
import { getSessionId } from '../../bootstrap/state.js'
import { getTranscriptPath } from '../../utils/sessionStorage.js'
import { jsonStringify } from '../../utils/slowOperations.js'

let lastFlushedDate: string | null = null
let lastSegmentSize = 0
let lastSegmentHash: string | null = null

type SessionTranscriptSegment = {
  type: 'session-transcript-segment'
  sessionId: string
  at: string
  day: string
  messageCount: number
  messageUuids: string[]
}

function computeSegmentHash(messages: Message[]): string {
  return messages.map(message => message.uuid).join('|')
}

function buildSegmentPath(): string {
  const transcriptPath = getTranscriptPath()
  return join(dirname(transcriptPath), `${getSessionId()}.segments.jsonl`)
}

function toSegment(messages: Message[]): SessionTranscriptSegment {
  const now = new Date()
  return {
    type: 'session-transcript-segment',
    sessionId: String(getSessionId()),
    at: now.toISOString(),
    day: now.toISOString().slice(0, 10),
    messageCount: messages.length,
    messageUuids: messages.map(message => message.uuid),
  }
}

export async function writeSessionTranscriptSegment(
  messages: Message[],
): Promise<void> {
  const hash = computeSegmentHash(messages)
  if (hash === lastSegmentHash) {
    return
  }

  const segmentPath = buildSegmentPath()
  await mkdir(dirname(segmentPath), { recursive: true })
  await appendFile(segmentPath, `${jsonStringify(toSegment(messages))}\n`, 'utf8')

  lastSegmentHash = hash
  lastSegmentSize = messages.length
}

export async function flushOnDateChange(
  messages: Message[],
  currentDate: string,
): Promise<void> {
  if (lastFlushedDate === currentDate) return
  lastFlushedDate = currentDate
  await writeSessionTranscriptSegment(messages)
}

export function getSessionTranscriptState(): {
  lastFlushedDate: string | null
  lastSegmentSize: number
  lastSegmentHash: string | null
} {
  return { lastFlushedDate, lastSegmentSize, lastSegmentHash }
}
