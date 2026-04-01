import React, { useMemo, useState } from 'react'
import { FuzzyPicker } from '../components/design-system/FuzzyPicker.js'
import { Text } from '../ink.js'
import { truncatePathMiddle } from '../utils/format.js'
import type { AssistantSession } from './sessionDiscovery.js'

type Props = {
  sessions: AssistantSession[]
  onSelect: (id: string) => void
  onCancel: () => void
}

export function AssistantSessionChooser({
  sessions,
  onSelect,
  onCancel,
}: Props): React.ReactNode {
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) {
      return sessions
    }

    return sessions.filter(session => {
      const haystack = [
        session.title,
        session.id,
        session.status,
        session.subtitle,
      ]
        .join(' ')
        .toLowerCase()
      return haystack.includes(normalized)
    })
  }, [query, sessions])

  return (
    <FuzzyPicker
      title="Assistant Sessions"
      placeholder="Filter sessions..."
      items={filtered}
      getKey={session => session.id}
      onQueryChange={setQuery}
      onSelect={session => onSelect(session.id)}
      onCancel={onCancel}
      emptyMessage="No assistant sessions found"
      selectAction="attach"
      visibleCount={8}
      direction="up"
      renderItem={(session, isFocused) => (
        <Text color={isFocused ? 'suggestion' : undefined}>
          {truncatePathMiddle(session.title, 60)}{' '}
          <Text dimColor>{session.subtitle}</Text>
        </Text>
      )}
      renderPreview={session => (
        <>
          <Text bold>{session.title}</Text>
          <Text dimColor>{session.subtitle}</Text>
          <Text>ID: {session.id}</Text>
        </>
      )}
    />
  )
}
