import type { AnyZodRawShape, SdkMcpToolDefinition } from './runtimeTypes.js'

export type ToolDefinition<Schema extends AnyZodRawShape = AnyZodRawShape> =
  SdkMcpToolDefinition<Schema>

export type BuiltinToolName = string

