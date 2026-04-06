import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  ConnectionStatus,
  SDKMessage,
  UIMessage,
} from './types'

let nextId = 0
function uid(): string {
  return `msg-${++nextId}-${Date.now()}`
}

// Reconnect config
const RECONNECT_BASE_MS = 1000
const RECONNECT_MAX_MS = 30000
const RECONNECT_MAX_ATTEMPTS = 10

export interface SessionHandle {
  id: string
  status: ConnectionStatus
  createdAt: number
  provider: string
  model: string
  messages: UIMessage[]
}

export interface ProviderInfo {
  id: string
  name: string
  models: string[]
  defaultModel: string
}

interface UseSessionManagerReturn {
  sessions: SessionHandle[]
  activeSessionId: string | null
  activeMessages: UIMessage[]
  activeStatus: ConnectionStatus
  providers: ProviderInfo[]
  createSession: (provider?: string, model?: string) => Promise<void>
  switchSession: (id: string) => void
  deleteSession: (id: string) => Promise<void>
  sendMessage: (text: string) => void
  respondToApproval: (requestId: string, allow: boolean) => void
}

export function useSessionManager(): UseSessionManagerReturn {
  const [sessions, setSessions] = useState<SessionHandle[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [providers, setProviders] = useState<ProviderInfo[]>([])
  const wsRefs = useRef<Map<string, WebSocket>>(new Map())
  const reconnectAttempts = useRef<Map<string, number>>(new Map())
  const reconnectTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  // Store wsUrl per session for reconnection
  const wsUrlRefs = useRef<Map<string, string>>(new Map())

  // Fetch providers on mount
  useEffect(() => {
    fetch('/api/providers')
      .then(r => r.json())
      .then(d => setProviders(d.providers ?? []))
      .catch(() => {})
  }, [])

  const updateSession = useCallback((id: string, update: Partial<SessionHandle>) => {
    setSessions(prev =>
      prev.map(s => s.id === id ? { ...s, ...update } : s)
    )
  }, [])

  const addMessageToSession = useCallback((sessionId: string, msg: UIMessage) => {
    setSessions(prev =>
      prev.map(s =>
        s.id === sessionId
          ? { ...s, messages: [...s.messages, msg] }
          : s
      )
    )
  }, [])

  // For streaming: append text to the last assistant message if it exists,
  // otherwise create a new one. This merges incremental chunks into a single bubble.
  const appendAssistantText = useCallback((sessionId: string, text: string) => {
    setSessions(prev =>
      prev.map(s => {
        if (s.id !== sessionId) return s
        const msgs = [...s.messages]
        const last = msgs[msgs.length - 1]
        if (last && last.type === 'assistant') {
          // Append to existing assistant message
          msgs[msgs.length - 1] = { ...last, content: last.content + text }
          return { ...s, messages: msgs }
        }
        // Create new assistant message
        msgs.push({
          id: uid(),
          type: 'assistant',
          content: text,
          timestamp: Date.now(),
        })
        return { ...s, messages: msgs }
      })
    )
  }, [])

  const handleSDKMessage = useCallback((sessionId: string, data: SDKMessage) => {
    switch (data.type) {
      case 'assistant': {
        const content = data.message?.content
        if (!Array.isArray(content)) break
        for (const block of content) {
          if (block.type === 'text') {
            // Use streaming merge — append to last assistant bubble
            appendAssistantText(sessionId, block.text)
          } else if (block.type === 'tool_use') {
            addMessageToSession(sessionId, {
              id: uid(),
              type: 'tool-use',
              content: JSON.stringify(block.input, null, 2),
              timestamp: Date.now(),
              toolName: block.name,
              toolInput: block.input,
            })
          }
        }
        break
      }

      case 'result': {
        const content = data.message?.content
        if (!Array.isArray(content)) break
        for (const block of content) {
          if (block.type === 'text') {
            addMessageToSession(sessionId, {
              id: uid(),
              type: 'tool-result',
              content: block.text,
              timestamp: Date.now(),
            })
          }
        }
        if (data.total_cost_usd) {
          addMessageToSession(sessionId, {
            id: uid(),
            type: 'system',
            content: `Cost: $${data.total_cost_usd.toFixed(4)} | ${data.num_turns} turns | ${((data.duration_ms ?? 0) / 1000).toFixed(1)}s`,
            timestamp: Date.now(),
          })
        }
        break
      }

      case 'control_request': {
        if (data.request?.subtype === 'can_use_tool') {
          addMessageToSession(sessionId, {
            id: uid(),
            type: 'approval',
            content: JSON.stringify(data.request.input, null, 2),
            timestamp: Date.now(),
            toolName: data.request.tool_name,
            toolInput: data.request.input,
            requestId: data.request_id,
          })
        }
        break
      }

      case 'user': {
        const content = data.message?.content
        let text = ''
        if (typeof content === 'string') {
          text = content
        } else if (Array.isArray(content)) {
          text = content
            .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
            .map(b => b.text)
            .join('')
        }
        if (text) {
          addMessageToSession(sessionId, {
            id: uid(),
            type: 'user',
            content: text,
            timestamp: Date.now(),
          })
        }
        break
      }

      case 'system': {
        if (data.subtype === 'session_ended') {
          addMessageToSession(sessionId, {
            id: uid(),
            type: 'system',
            content: `Session ended (exit code: ${data.exit_code})`,
            timestamp: Date.now(),
          })
          updateSession(sessionId, { status: 'disconnected' })
        } else if (data.subtype === 'session_status') {
          updateSession(sessionId, { status: 'connected' })
        }
        break
      }
    }
  }, [addMessageToSession, appendAssistantText, updateSession])

  const connectWS = useCallback((sessionId: string, wsUrl: string) => {
    // Store URL for reconnection
    wsUrlRefs.current.set(sessionId, wsUrl)
    // Reset reconnect counter on fresh connect
    reconnectAttempts.current.set(sessionId, 0)

    const doConnect = () => {
      const resolvedUrl = wsUrl.replace(/ws:\/\/[^/]+/, `ws://${location.host}`)
      const ws = new WebSocket(resolvedUrl)
      wsRefs.current.set(sessionId, ws)

      ws.onopen = () => {
        updateSession(sessionId, { status: 'connected' })
        reconnectAttempts.current.set(sessionId, 0) // reset on success
        addMessageToSession(sessionId, {
          id: uid(),
          type: 'system',
          content: reconnectAttempts.current.get(sessionId) === 0
            ? '' // suppress on first connect
            : 'Reconnected',
          timestamp: Date.now(),
        })
      }

      ws.onclose = (e) => {
        wsRefs.current.delete(sessionId)
        // Don't reconnect if session was manually deleted (code 1000)
        if (e.code === 1000) {
          updateSession(sessionId, { status: 'disconnected' })
          return
        }
        // Attempt reconnect with exponential backoff
        const attempts = reconnectAttempts.current.get(sessionId) ?? 0
        if (attempts < RECONNECT_MAX_ATTEMPTS) {
          const delay = Math.min(RECONNECT_BASE_MS * Math.pow(2, attempts), RECONNECT_MAX_MS)
          updateSession(sessionId, { status: 'connecting' })
          addMessageToSession(sessionId, {
            id: uid(),
            type: 'system',
            content: `Connection lost. Reconnecting in ${(delay / 1000).toFixed(0)}s... (${attempts + 1}/${RECONNECT_MAX_ATTEMPTS})`,
            timestamp: Date.now(),
          })
          reconnectAttempts.current.set(sessionId, attempts + 1)
          const timer = setTimeout(doConnect, delay)
          reconnectTimers.current.set(sessionId, timer)
        } else {
          updateSession(sessionId, { status: 'disconnected' })
          addMessageToSession(sessionId, {
            id: uid(),
            type: 'system',
            content: 'Connection lost. Max reconnect attempts reached.',
            timestamp: Date.now(),
          })
        }
      }

      ws.onerror = () => {
        // onclose will fire after this, handled there
      }

      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data)
          handleSDKMessage(sessionId, msg)
        } catch {
          // ignore
        }
      }
    }

    doConnect()
  }, [handleSDKMessage, updateSession, addMessageToSession])

  const createSession = useCallback(async (provider?: string, model?: string) => {
    try {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, model }),
      })
      const data = await res.json()
      const newSession: SessionHandle = {
        id: data.session_id,
        status: 'connecting',
        createdAt: Date.now(),
        provider: data.provider ?? provider ?? '',
        model: data.model ?? model ?? '',
        messages: [],
      }
      setSessions(prev => [...prev, newSession])
      setActiveSessionId(data.session_id)
      connectWS(data.session_id, data.ws_url)
    } catch (err) {
      console.error('Failed to create session:', err)
    }
  }, [connectWS])

  const switchSession = useCallback((id: string) => {
    setActiveSessionId(id)
  }, [])

  const deleteSession = useCallback(async (id: string) => {
    // Cancel any pending reconnect
    const timer = reconnectTimers.current.get(id)
    if (timer) {
      clearTimeout(timer)
      reconnectTimers.current.delete(id)
    }
    reconnectAttempts.current.delete(id)
    wsUrlRefs.current.delete(id)
    // Close WS with clean close code
    const ws = wsRefs.current.get(id)
    if (ws) {
      ws.close(1000, 'Session deleted')
      wsRefs.current.delete(id)
    }
    // Delete on server
    await fetch(`/api/sessions/${id}`, { method: 'DELETE' }).catch(() => {})
    // Remove from state
    setSessions(prev => {
      const remaining = prev.filter(s => s.id !== id)
      return remaining
    })
    setActiveSessionId(prev => {
      if (prev === id) {
        const remaining = sessions.filter(s => s.id !== id)
        return remaining.length > 0 ? remaining[remaining.length - 1]!.id : null
      }
      return prev
    })
  }, [sessions])

  const sendMessage = useCallback((text: string) => {
    if (!activeSessionId) return
    const ws = wsRefs.current.get(activeSessionId)
    if (!ws || ws.readyState !== WebSocket.OPEN) return

    const msg = {
      type: 'user',
      message: { role: 'user', content: text },
      parent_tool_use_id: null,
      session_id: activeSessionId,
    }
    ws.send(JSON.stringify(msg))
    addMessageToSession(activeSessionId, {
      id: uid(),
      type: 'user',
      content: text,
      timestamp: Date.now(),
    })
  }, [activeSessionId, addMessageToSession])

  const respondToApproval = useCallback((requestId: string, allow: boolean) => {
    if (!activeSessionId) return
    const ws = wsRefs.current.get(activeSessionId)
    if (!ws || ws.readyState !== WebSocket.OPEN) return

    const msg = {
      type: 'control_response',
      response: {
        subtype: 'success',
        request_id: requestId,
        response: allow
          ? { behavior: 'allow' }
          : { behavior: 'deny', message: 'Denied by user' },
      },
    }
    ws.send(JSON.stringify(msg))

    setSessions(prev =>
      prev.map(s =>
        s.id === activeSessionId
          ? {
              ...s,
              messages: s.messages.map(m =>
                m.requestId === requestId
                  ? { ...m, resolved: allow ? 'approved' as const : 'denied' as const }
                  : m
              ),
            }
          : s
      )
    )
  }, [activeSessionId])

  // Auto-create first session on mount
  useEffect(() => {
    createSession()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      wsRefs.current.forEach(ws => ws.close(1000, 'Unmount'))
      reconnectTimers.current.forEach(t => clearTimeout(t))
    }
  }, [])

  const activeSession = sessions.find(s => s.id === activeSessionId)

  return {
    sessions,
    activeSessionId,
    activeMessages: activeSession?.messages ?? [],
    activeStatus: activeSession?.status ?? 'disconnected',
    providers,
    createSession,
    switchSession,
    deleteSession,
    sendMessage,
    respondToApproval,
  }
}
