/** Message types matching the claude --output-format stream-json protocol */

export interface TextBlock {
  type: 'text'
  text: string
}

export interface ToolUseBlock {
  type: 'tool_use'
  id: string
  name: string
  input: Record<string, unknown>
}

export type ContentBlock = TextBlock | ToolUseBlock

export interface SDKAssistantMessage {
  type: 'assistant'
  message: {
    role: 'assistant'
    content: ContentBlock[]
    model?: string
    stop_reason?: string
  }
  session_id?: string
}

export interface SDKUserMessage {
  type: 'user'
  message: {
    role: 'user'
    content: string | ContentBlock[]
  }
  parent_tool_use_id?: string | null
  session_id?: string
}

export interface SDKResultMessage {
  type: 'result'
  message: {
    role: 'assistant'
    content: ContentBlock[]
    model?: string
    stop_reason?: string
  }
  subtype?: string
  is_error?: boolean
  duration_ms?: number
  duration_api_ms?: number
  num_turns?: number
  session_id?: string
  total_cost_usd?: number
}

export interface SDKControlRequest {
  type: 'control_request'
  request_id: string
  request: {
    subtype: 'can_use_tool'
    tool_name: string
    input: Record<string, unknown>
  }
}

export interface SDKSystemMessage {
  type: 'system'
  subtype: string
  status?: string
  session_id?: string
  exit_code?: number
  message?: string
}

export type SDKMessage =
  | SDKAssistantMessage
  | SDKUserMessage
  | SDKResultMessage
  | SDKControlRequest
  | SDKSystemMessage

/** UI message wrapper for display */
export type UIMessageType = 'user' | 'assistant' | 'tool-use' | 'tool-result' | 'system' | 'approval'

export interface UIMessage {
  id: string
  type: UIMessageType
  content: string
  timestamp: number
  // Extra data for tool/approval messages
  toolName?: string
  toolInput?: Record<string, unknown>
  requestId?: string
  resolved?: 'approved' | 'denied'
}

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected'
