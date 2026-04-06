import { useState } from 'react'
import type { SessionHandle, ProviderInfo } from './useSessionManager'

interface SidebarProps {
  sessions: SessionHandle[]
  activeSessionId: string | null
  providers: ProviderInfo[]
  onSwitch: (id: string) => void
  onNew: (provider?: string, model?: string) => void
  onDelete: (id: string) => void
  collapsed: boolean
  onToggle: () => void
}

export default function Sidebar({
  sessions,
  activeSessionId,
  providers,
  onSwitch,
  onNew,
  onDelete,
  collapsed,
  onToggle,
}: SidebarProps) {
  const [selectedProvider, setSelectedProvider] = useState(providers[0]?.id ?? '')
  const [selectedModel, setSelectedModel] = useState(providers[0]?.defaultModel ?? '')

  // Keep selection in sync when providers load
  const currentProvider = providers.find(p => p.id === selectedProvider) ?? providers[0]

  if (collapsed) {
    return (
      <div className="sidebar collapsed">
        <button className="sidebar-toggle" onClick={onToggle} title="Expand sidebar">
          ☰
        </button>
      </div>
    )
  }

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <span className="sidebar-title">Sessions</span>
        <div className="sidebar-actions">
          <button className="sidebar-toggle" onClick={onToggle} title="Collapse sidebar">◀</button>
        </div>
      </div>

      {/* Model Selector */}
      {providers.length > 0 && (
        <div className="model-selector">
          <select
            value={selectedProvider}
            onChange={e => {
              const pId = e.target.value
              setSelectedProvider(pId)
              const p = providers.find(x => x.id === pId)
              if (p) setSelectedModel(p.defaultModel)
            }}
            className="model-select"
          >
            {providers.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          {currentProvider && currentProvider.models.length > 1 && (
            <select
              value={selectedModel}
              onChange={e => setSelectedModel(e.target.value)}
              className="model-select"
            >
              {currentProvider.models.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          )}
          <button
            className="sidebar-btn new-session-btn"
            onClick={() => onNew(selectedProvider || undefined, selectedModel || undefined)}
            title="New session with selected model"
          >
            + New Session
          </button>
        </div>
      )}
      {providers.length === 0 && (
        <div className="model-selector">
          <button className="sidebar-btn new-session-btn" onClick={() => onNew()}>
            + New Session
          </button>
        </div>
      )}

      <div className="session-list">
        {sessions.map(session => (
          <div
            key={session.id}
            className={`session-item ${session.id === activeSessionId ? 'active' : ''}`}
            onClick={() => onSwitch(session.id)}
          >
            <div className="session-item-header">
              <span className={`status-dot ${session.status}`} />
              <span className="session-label">
                {formatTime(session.createdAt)}
              </span>
              <span className="session-model-badge">{session.model || session.provider}</span>
              <button
                className="session-delete"
                onClick={(e) => {
                  e.stopPropagation()
                  onDelete(session.id)
                }}
                title="Delete session"
              >
                ×
              </button>
            </div>
            <div className="session-preview">
              {getPreview(session)}
            </div>
          </div>
        ))}
        {sessions.length === 0 && (
          <div className="session-empty">No sessions yet</div>
        )}
      </div>
    </div>
  )
}

function formatTime(ts: number): string {
  const d = new Date(ts)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function getPreview(session: SessionHandle): string {
  // Find last user message for preview
  for (let i = session.messages.length - 1; i >= 0; i--) {
    const msg = session.messages[i]!
    if (msg.type === 'user') {
      return msg.content.length > 40 ? msg.content.slice(0, 40) + '…' : msg.content
    }
  }
  return session.status === 'connected' ? 'Ready' : session.status
}
