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

interface UseSessionReturn {
  messages: UIMessage[]
  status: ConnectionStatus
  sendMessage: (text: string) => void
  respondToApproval: (requestId: string, allow: boolean) => void
}

export function useSession(): UseSessionReturn {
  const [messages, setMessages] = useState<UIMessage[]>([])
  const [status, setStatus] = useState<ConnectionStatus>('disconnected')
  const wsRef = useRef<WebSocket | null>(null)
  const sessionIdRef = useRef<string | null>(null)

  const addMessage = useCallback((msg: UIMessage) => {
    setMessages(prev => [...prev, msg])
  }, [])

  const handleSDKMessage = useCallback((data: SDKMessage) => {
    switch (data.type) {
      case 'assistant': {
        const content = data.message?.content
        if (!Array.isArray(content)) break
        for (const block of content) {
          if (block.type === 'text') {
            addMessage({
              id: uid(),
              type: 'assistant',
              content: block.text,
              timestamp: Date.now(),
            })
          } else if (block.type === 'tool_use') {
            addMessage({
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
            addMessage({
              id: uid(),
              type: 'tool-result',
              content: block.text,
              timestamp: Date.now(),
            })
          }
        }
        // Add cost info if available
        if (data.total_cost_usd) {
          addMessage({
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
          addMessage({
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
          addMessage({
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
          addMessage({
            id: uid(),
            type: 'system',
            content: `Session ended (exit code: ${data.exit_code})`,
            timestamp: Date.now(),
          })
          setStatus('disconnected')
        } else if (data.subtype === 'session_status') {
          setStatus('connected')
        }
        break
      }
    }
  }, [addMessage])

  // Initialize: create session and connect WS
  useEffect(() => {
    let ws: WebSocket | null = null
    let cancelled = false

    async function init() {
      try {
        setStatus('connecting')
        const res = await fetch('/api/sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{}',
        })
        const data = await res.json()
        if (cancelled) return
        sessionIdRef.current = data.session_id

        // Connect WS — adjust URL for current host
        const wsUrl = data.ws_url.replace(
          /ws:\/\/[^/]+/,
          `ws://${location.host}`
        )
        ws = new WebSocket(wsUrl)
        wsRef.current = ws

        ws.onopen = () => {
          if (!cancelled) setStatus('connected')
        }

        ws.onclose = () => {
          if (!cancelled) setStatus('disconnected')
        }

        ws.onmessage = (e) => {
          try {
            const msg = JSON.parse(e.data)
            handleSDKMessage(msg)
          } catch {
            // ignore invalid JSON
          }
        }
      } catch (err) {
        if (!cancelled) {
          addMessage({
            id: uid(),
            type: 'system',
            content: `Failed to create session: ${err}`,
            timestamp: Date.now(),
          })
          setStatus('disconnected')
        }
      }
    }

    init()

    return () => {
      cancelled = true
      ws?.close()
    }
  }, [handleSDKMessage, addMessage])

  const sendMessage = useCallback((text: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return
    const msg = {
      type: 'user',
      message: { role: 'user', content: text },
      parent_tool_use_id: null,
      session_id: sessionIdRef.current || '',
    }
    wsRef.current.send(JSON.stringify(msg))
    addMessage({
      id: uid(),
      type: 'user',
      content: text,
      timestamp: Date.now(),
    })
  }, [addMessage])

  const respondToApproval = useCallback((requestId: string, allow: boolean) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return
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
    wsRef.current.send(JSON.stringify(msg))

    // Update the approval message in state
    setMessages(prev =>
      prev.map(m =>
        m.requestId === requestId
          ? { ...m, resolved: allow ? 'approved' as const : 'denied' as const }
          : m
      )
    )
  }, [])

  return { messages, status, sendMessage, respondToApproval }
}
