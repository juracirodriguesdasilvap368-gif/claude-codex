import type { Message } from '../../types/message.js'
import { getContextCollapseStore } from './state.js'

function createSummaryMessage(template: Message, summary: string, uuid: string): Message {
  return {
    type: 'system',
    subtype: 'informational',
    level: 'info',
    content: summary,
    isMeta: false,
    uuid,
    timestamp: template.timestamp,
    parentUuid: template.parentUuid ?? null,
  }
}

export function projectView(messages: Message[]): Message[] {
  const { commits } = getContextCollapseStore()
  if (commits.length === 0 || messages.length === 0) {
    return messages
  }

  let projected = messages
  for (const commit of commits) {
    const start = projected.findIndex(m => m.uuid === commit.firstArchivedUuid)
    const end = projected.findIndex(m => m.uuid === commit.lastArchivedUuid)
    if (start === -1 || end === -1 || start > end) {
      continue
    }
    const first = projected[start]!
    const summaryMessage = createSummaryMessage(
      first,
      commit.summaryContent,
      commit.summaryUuid,
    )
    projected = [
      ...projected.slice(0, start),
      summaryMessage,
      ...projected.slice(end + 1),
    ]
  }

  return projected
}
