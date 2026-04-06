import { useCallback, useEffect, useRef, useState } from 'react'
import { useSessionManager } from './useSessionManager'
import Sidebar from './Sidebar'
import Message from './Message'
import Search from './Search'

type Theme = 'dark' | 'light'

function getInitialTheme(): Theme {
  const saved = localStorage.getItem('claude-theme')
  if (saved === 'light' || saved === 'dark') return saved
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

export default function App() {
  const {
    sessions,
    activeSessionId,
    activeMessages,
    activeStatus,
    providers,
    createSession,
    switchSession,
    deleteSession,
    sendMessage,
    respondToApproval,
  } = useSessionManager()

  const [input, setInput] = useState('')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [theme, setTheme] = useState<Theme>(getInitialTheme)
  const [showSearch, setShowSearch] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const messageRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  // Apply theme
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('claude-theme', theme)
  }, [theme])

  const toggleTheme = useCallback(() => {
    setTheme(t => t === 'dark' ? 'light' : 'dark')
  }, [])

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [activeMessages])

  // Global keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey

      // Ctrl/Cmd + K: Search
      if (mod && e.key === 'k') {
        e.preventDefault()
        setShowSearch(s => !s)
      }
      // Ctrl/Cmd + N: New session
      if (mod && e.key === 'n') {
        e.preventDefault()
        createSession()
      }
      // Ctrl/Cmd + B: Toggle sidebar
      if (mod && e.key === 'b') {
        e.preventDefault()
        setSidebarCollapsed(c => !c)
      }
      // Ctrl/Cmd + Shift + E: Export
      if (mod && e.shiftKey && e.key === 'E') {
        e.preventDefault()
        handleExport()
      }
      // Escape: Close search
      if (e.key === 'Escape' && showSearch) {
        setShowSearch(false)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showSearch, createSession])

  // Auto-resize textarea
  const handleInput = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    const el = e.target
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`
  }, [])

  const handleSend = useCallback(() => {
    const text = input.trim()
    if (!text) return
    sendMessage(text)
    setInput('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }, [input, sendMessage])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }, [handleSend])

  const handleFileUpload = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const isText = file.type.startsWith('text/') ||
      /\.(md|json|ts|tsx|js|jsx|py|rs|go|yaml|yml|toml|xml|html|css|sh|sql|c|cpp|h|java|rb|php|swift|kt)$/.test(file.name)

    if (isText && file.size < 1024 * 512) {
      const text = await file.text()
      const content = `Here is the file \`${file.name}\` (${formatSize(file.size)}):\n\n\`\`\`\n${text}\n\`\`\``
      sendMessage(content)
    } else {
      sendMessage(`[File: ${file.name}, ${formatSize(file.size)}, type: ${file.type || 'unknown'}]`)
    }
    e.target.value = ''
  }, [sendMessage])

  const handleExport = useCallback(() => {
    if (activeMessages.length === 0) return
    const lines = activeMessages.map(m => {
      const time = new Date(m.timestamp).toLocaleTimeString()
      const prefix = m.type === 'user' ? 'You' :
                     m.type === 'assistant' ? 'Claude' :
                     m.type === 'tool-use' ? `Tool: ${m.toolName}` :
                     m.type === 'tool-result' ? 'Result' :
                     m.type === 'approval' ? `Permission: ${m.toolName}` : 'System'
      return `[${time}] ${prefix}\n${m.content}\n`
    })
    const blob = new Blob([lines.join('\n---\n\n')], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `claude-session-${new Date().toISOString().slice(0, 10)}.md`
    a.click()
    URL.revokeObjectURL(url)
  }, [activeMessages])

  const handleScrollTo = useCallback((messageId: string) => {
    const el = messageRefs.current.get(messageId)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el.style.outline = '2px solid var(--accent)'
      setTimeout(() => { el.style.outline = '' }, 2000)
    }
  }, [])

  const statusLabel = {
    disconnected: 'Disconnected',
    connecting: 'Connecting...',
    connected: 'Connected',
  }[activeStatus]

  return (
    <div className="app">
      <Sidebar
        sessions={sessions}
        activeSessionId={activeSessionId}
        providers={providers}
        onSwitch={switchSession}
        onNew={createSession}
        onDelete={deleteSession}
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(c => !c)}
      />
      <div className="main-panel">
        <div className="header">
          <h1>Claude</h1>
          <div className="header-actions">
            <button
              className="theme-toggle"
              onClick={toggleTheme}
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
            >
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
            <button
              className="theme-toggle"
              onClick={() => setShowSearch(true)}
              title="Search messages (Ctrl+K)"
            >
              🔍
            </button>
            <button
              className="theme-toggle"
              onClick={handleExport}
              title="Export chat (Ctrl+Shift+E)"
              disabled={activeMessages.length === 0}
            >
              📥
            </button>
            <div className="status">
              <span className={`status-dot ${activeStatus}`} />
              <span>{statusLabel}</span>
            </div>
          </div>
        </div>

        <div className="messages">
          {activeMessages.length === 0 && (
            <div className="message system">
              {activeStatus === 'connected'
                ? 'Session ready. Type a message to begin.'
                : activeStatus === 'connecting'
                ? 'Starting session...'
                : 'Not connected'}
            </div>
          )}
          {activeMessages.map(msg => (
            <div key={msg.id} ref={el => { if (el) messageRefs.current.set(msg.id, el) }}>
              <Message
                message={msg}
                onApprove={(reqId) => respondToApproval(reqId, true)}
                onDeny={(reqId) => respondToApproval(reqId, false)}
              />
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        <div className="input-area">
          <input
            ref={fileInputRef}
            type="file"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
          <button
            className="upload-btn"
            onClick={handleFileUpload}
            disabled={activeStatus !== 'connected'}
            title="Upload file"
          >
            📎
          </button>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder="Type a message... (Enter to send, Shift+Enter for newline)"
            rows={1}
            disabled={activeStatus !== 'connected'}
          />
          <button
            className="send-btn"
            onClick={handleSend}
            disabled={activeStatus !== 'connected' || !input.trim()}
          >
            Send
          </button>
        </div>
      </div>

      {showSearch && (
        <Search
          messages={activeMessages}
          onClose={() => setShowSearch(false)}
          onScrollTo={handleScrollTo}
        />
      )}
    </div>
  )
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}
