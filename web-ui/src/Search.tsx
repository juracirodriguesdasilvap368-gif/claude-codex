import { useState, useCallback, useRef, useEffect } from 'react'
import type { UIMessage } from './types'

interface SearchProps {
  messages: UIMessage[]
  onClose: () => void
  onScrollTo: (messageId: string) => void
}

export default function Search({ messages, onClose, onScrollTo }: SearchProps) {
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const results = query.trim()
    ? messages.filter(m =>
        (m.type === 'user' || m.type === 'assistant' || m.type === 'tool-result') &&
        m.content.toLowerCase().includes(query.toLowerCase())
      )
    : []

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose()
    }
  }, [onClose])

  return (
    <div className="search-overlay" onClick={onClose}>
      <div className="search-box" onClick={e => e.stopPropagation()}>
        <input
          ref={inputRef}
          className="search-input"
          placeholder="Search messages... (Esc to close)"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <div className="search-results">
          {query.trim() && results.length === 0 && (
            <div className="search-empty">No matches found</div>
          )}
          {results.map(msg => (
            <div
              key={msg.id}
              className="search-result"
              onClick={() => {
                onScrollTo(msg.id)
                onClose()
              }}
            >
              <div>{highlightText(msg.content, query)}</div>
              <div className="search-result-meta">
                {msg.type} · {new Date(msg.timestamp).toLocaleTimeString()}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function highlightText(text: string, query: string): React.ReactNode {
  const snippet = getSnippet(text, query, 80)
  const parts = snippet.split(new RegExp(`(${escapeRegex(query)})`, 'gi'))
  return parts.map((part, i) =>
    part.toLowerCase() === query.toLowerCase()
      ? <span key={i} className="highlight">{part}</span>
      : part
  )
}

function getSnippet(text: string, query: string, maxLen: number): string {
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return text.slice(0, maxLen)
  const start = Math.max(0, idx - 30)
  const end = Math.min(text.length, idx + query.length + 50)
  let snippet = text.slice(start, end)
  if (start > 0) snippet = '…' + snippet
  if (end < text.length) snippet = snippet + '…'
  return snippet
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
