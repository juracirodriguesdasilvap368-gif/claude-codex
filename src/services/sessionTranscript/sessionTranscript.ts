import type { Message } from '../../types/message.js'

let lastFlushedDate: string | null = null
let lastSegmentSize = 0

export async function writeSessionTranscriptSegment(
  messages: Message[],
): Promise<void> {
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
} {
  return { lastFlushedDate, lastSegmentSize }
}
