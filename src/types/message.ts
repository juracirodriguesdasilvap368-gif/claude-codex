import type {
  BetaContentBlock,
  BetaMessage,
} from '@anthropic-ai/sdk/resources/beta/messages/messages.mjs'
import type {
  ContentBlockParam,
  MessageParam,
  ToolResultBlockParam,
  ToolUseBlock,
} from '@anthropic-ai/sdk/resources/index.mjs'
import type { ToolProgressData } from './tools.js'

export type MessageOrigin = {
  kind: string
  [key: string]: unknown
}

export type CompactMetadata = {
  trigger?: string
  preTokens?: number
  preservedSegment?: {
    headUuid?: string
    anchorUuid?: string
    tailUuid?: string
  }
  [key: string]: unknown
}

export type PartialCompactDirection = 'from' | 'to'

type BaseMessage = {
  type: string
  uuid: string
  timestamp: string
  parentUuid?: string | null
  isMeta?: boolean
  isVirtual?: boolean
  isVisibleInTranscriptOnly?: boolean
  origin?: MessageOrigin
  [key: string]: unknown
}

type MessageEnvelope<
  Content = string | ContentBlockParam[] | BetaContentBlock[],
> = MessageParam & {
  content: Content
}

export type UserMessage = BaseMessage & {
  type: 'user'
  message: MessageEnvelope<string | ContentBlockParam[] | BetaContentBlock[]>
  toolUseResult?: unknown
  sourceToolAssistantUUID?: string
  imagePasteIds?: Array<string | number>
  isCompactSummary?: boolean
  compactMetadata?: CompactMetadata
}

export type AssistantMessage<
  TContentBlock = BetaContentBlock | ToolUseBlock,
> = BaseMessage & {
  type: 'assistant'
  message: BetaMessage & {
    content: TContentBlock[]
  }
  requestId?: string
  error?: unknown
  apiError?: string
  advisorModel?: string
}

export type AttachmentMessage = BaseMessage & {
  type: 'attachment'
  attachment: unknown
}

export type SystemMessageLevel = 'info' | 'warning' | 'error' | 'success'

type BaseSystemMessage = BaseMessage & {
  type: 'system'
  subtype: string
  content: string
  level?: SystemMessageLevel | string
  toolUseID?: string
}

export type SystemLocalCommandMessage = BaseSystemMessage & {
  subtype: 'local_command'
}

export type SystemInformationalMessage = BaseSystemMessage & {
  subtype: 'informational'
}

export type SystemAPIErrorMessage = BaseSystemMessage & {
  subtype: 'api_error'
  error?: unknown
}

export type SystemPermissionRetryMessage = BaseSystemMessage & {
  subtype: 'permission_retry'
}

export type SystemBridgeStatusMessage = BaseSystemMessage & {
  subtype: 'bridge_status'
}

export type SystemScheduledTaskFireMessage = BaseSystemMessage & {
  subtype: 'scheduled_task_fire'
}

export type SystemStopHookSummaryMessage = BaseSystemMessage & {
  subtype: 'stop_hook_summary'
  stopHookInfo?: StopHookInfo
}

export type SystemTurnDurationMessage = BaseSystemMessage & {
  subtype: 'turn_duration'
  durationMs?: number
}

export type SystemAwaySummaryMessage = BaseSystemMessage & {
  subtype: 'away_summary'
}

export type SystemMemorySavedMessage = BaseSystemMessage & {
  subtype: 'memory_saved'
}

export type SystemThinkingMessage = BaseSystemMessage & {
  subtype: 'thinking'
}

export type SystemAgentsKilledMessage = BaseSystemMessage & {
  subtype: 'agents_killed'
}

export type SystemCompactBoundaryMessage = BaseSystemMessage & {
  subtype: 'compact_boundary'
  compactMetadata?: CompactMetadata
}

export type SystemMicrocompactBoundaryMessage = BaseSystemMessage & {
  subtype: 'microcompact_boundary'
  compactMetadata?: CompactMetadata
}

export type SystemFileSnapshotMessage = BaseSystemMessage & {
  subtype: 'file_snapshot'
}

export type SystemApiMetricsMessage = BaseSystemMessage & {
  subtype: 'api_metrics'
}

export type SystemMessage =
  | SystemAgentsKilledMessage
  | SystemAPIErrorMessage
  | SystemApiMetricsMessage
  | SystemAwaySummaryMessage
  | SystemBridgeStatusMessage
  | SystemCompactBoundaryMessage
  | SystemFileSnapshotMessage
  | SystemInformationalMessage
  | SystemLocalCommandMessage
  | SystemMemorySavedMessage
  | SystemMicrocompactBoundaryMessage
  | SystemPermissionRetryMessage
  | SystemScheduledTaskFireMessage
  | SystemStopHookSummaryMessage
  | SystemThinkingMessage
  | SystemTurnDurationMessage
  | BaseSystemMessage

export type ProgressMessage = BaseMessage & {
  type: 'progress'
  toolUseID?: string
  data: ToolProgressData
}

export type ToolUseSummaryMessage = UserMessage & {
  isToolUseSummary?: boolean
}

export type HookResultMessage = SystemInformationalMessage & {
  hookName?: string
}

export type TombstoneMessage = BaseMessage & {
  type: 'tombstone'
}

export type RequestStartEvent = {
  type: 'request_start'
  requestId?: string
  timestamp?: string
  [key: string]: unknown
}

export type StreamEvent = {
  type: 'stream_event'
  event: unknown
}

export type StopHookInfo = {
  stopReason?: string
  [key: string]: unknown
}

export type NormalizedUserMessage = UserMessage & {
  normalizedFrom?: Message
  toolUseId?: string | null
}

export type NormalizedAssistantMessage<
  TContentBlock = BetaContentBlock | ToolUseBlock,
> = AssistantMessage<TContentBlock> & {
  normalizedFrom?: Message
  toolUseId?: string | null
}

export type NormalizedMessage =
  | AttachmentMessage
  | NormalizedAssistantMessage
  | NormalizedUserMessage
  | ProgressMessage
  | SystemMessage
  | TombstoneMessage

export type GroupedToolUseMessage = BaseMessage & {
  type: 'grouped_tool_use'
  assistantMessages: NormalizedAssistantMessage[]
  toolResults: NormalizedUserMessage[]
}

export type CollapsedReadSearchGroup = BaseMessage & {
  type: 'collapsed_read_search'
  messages: NormalizedMessage[]
}

export type CollapsibleMessage =
  | CollapsedReadSearchGroup
  | GroupedToolUseMessage

export type RenderableMessage =
  | AttachmentMessage
  | CollapsedReadSearchGroup
  | GroupedToolUseMessage
  | NormalizedAssistantMessage
  | NormalizedUserMessage
  | SystemMessage
  | TombstoneMessage

export type Message =
  | AssistantMessage
  | AttachmentMessage
  | ProgressMessage
  | SystemMessage
  | TombstoneMessage
  | UserMessage

export type SystemMessageWithToolResult = SystemMessage & {
  toolResult?: ToolResultBlockParam
}

