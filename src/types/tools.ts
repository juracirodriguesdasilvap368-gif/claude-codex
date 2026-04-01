export type ToolProgressData = {
  type?: string
  dataType?: string
  toolUseID?: string
  summary?: string
  message?: string
  [key: string]: unknown
}

type BaseProgress = {
  type: 'progress'
  uuid: string
  timestamp: string
  parentUuid?: string | null
  toolUseID?: string
  data: ToolProgressData
  [key: string]: unknown
}

export type BashProgress = BaseProgress & {
  data: ToolProgressData & { dataType: 'bash_progress' | string }
}

export type PowerShellProgress = BaseProgress & {
  data: ToolProgressData & { dataType: 'powershell_progress' | string }
}

export type MCPProgress = BaseProgress & {
  data: ToolProgressData & { dataType: 'mcp_progress' | string }
}

export type WebSearchProgress = BaseProgress & {
  data: ToolProgressData & { dataType: 'web_search_progress' | string }
}

export type SkillToolProgress = BaseProgress & {
  data: ToolProgressData & { dataType: 'skill_progress' | string }
}

export type TaskOutputProgress = BaseProgress & {
  data: ToolProgressData & { dataType: 'task_output_progress' | string }
}

export type REPLToolProgress = BaseProgress & {
  data: ToolProgressData & { dataType: 'repl_progress' | string }
}

export type AgentToolProgress = BaseProgress & {
  data: ToolProgressData & { dataType: 'agent_progress' | string }
}

export type SdkWorkflowProgress = BaseProgress & {
  data: ToolProgressData & { dataType: 'sdk_workflow_progress' | string }
}

export type ShellProgress = BashProgress | PowerShellProgress

export type AnyToolProgress =
  | AgentToolProgress
  | BashProgress
  | MCPProgress
  | PowerShellProgress
  | REPLToolProgress
  | SdkWorkflowProgress
  | SkillToolProgress
  | TaskOutputProgress
  | WebSearchProgress

