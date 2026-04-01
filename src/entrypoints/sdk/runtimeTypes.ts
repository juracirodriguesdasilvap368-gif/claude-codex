import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import type { z } from 'zod/v4'
import type {
  SDKMessage,
  SDKSessionInfo,
  SDKUserMessage,
} from './coreTypes.js'

export type EffortLevel = 'low' | 'medium' | 'high' | 'max'

export type AnyZodRawShape = z.ZodRawShape

export type InferShape<Shape extends AnyZodRawShape> = z.infer<
  z.ZodObject<Shape>
>

export type SdkMcpToolDefinition<Schema extends AnyZodRawShape> = {
  name: string
  description: string
  inputSchema: Schema
  handler: (args: InferShape<Schema>, extra: unknown) => Promise<CallToolResult>
  annotations?: unknown
  searchHint?: string
  alwaysLoad?: boolean
}

export type McpSdkServerConfigWithInstance = {
  type?: 'sdk'
  name?: string
  version?: string
  tools?: SdkMcpToolDefinition<AnyZodRawShape>[]
  instance?: unknown
  [key: string]: unknown
}

export type Options = Record<string, unknown>
export type InternalOptions = Options & { internal?: true }

export type SessionMutationOptions = {
  dir?: string
}

export type ListSessionsOptions = SessionMutationOptions & {
  limit?: number
  offset?: number
}

export type GetSessionInfoOptions = SessionMutationOptions

export type GetSessionMessagesOptions = SessionMutationOptions & {
  includeSystemMessages?: boolean
  limit?: number
  offset?: number
}

export type ForkSessionOptions = SessionMutationOptions & {
  upToMessageId?: string
}

export type ForkSessionResult = {
  sessionId: string
}

export type SessionMessage = SDKMessage

export type Query = AsyncIterable<SDKMessage>
export type InternalQuery = AsyncIterable<SDKMessage>

export type SDKSessionOptions = Options & {
  model?: string
  cwd?: string
}

export type SDKSession = {
  id?: string
  prompt(message: string): Promise<unknown>
  interrupt?(): Promise<void>
  close?(): Promise<void>
}

