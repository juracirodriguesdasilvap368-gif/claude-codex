import type { AnyZodRawShape, SdkMcpToolDefinition } from './runtimeTypes.js'

export type ToolDefinition<Schema extends AnyZodRawShape = AnyZodRawShape> =
  SdkMcpToolDefinition<Schema>

type KnownBuiltinToolName =
  | typeof import('../../tools/AgentTool/constants.js').AGENT_TOOL_NAME
  | typeof import('../../tools/AgentTool/constants.js').LEGACY_AGENT_TOOL_NAME
  | typeof import('../../tools/AskUserQuestionTool/prompt.js').ASK_USER_QUESTION_TOOL_NAME
  | typeof import('../../tools/BashTool/toolName.js').BASH_TOOL_NAME
  | typeof import('../../tools/BriefTool/prompt.js').BRIEF_TOOL_NAME
  | typeof import('../../tools/BriefTool/prompt.js').LEGACY_BRIEF_TOOL_NAME
  | typeof import('../../tools/ConfigTool/constants.js').CONFIG_TOOL_NAME
  | typeof import('../../tools/EnterPlanModeTool/constants.js').ENTER_PLAN_MODE_TOOL_NAME
  | typeof import('../../tools/EnterWorktreeTool/constants.js').ENTER_WORKTREE_TOOL_NAME
  | typeof import('../../tools/ExitPlanModeTool/constants.js').EXIT_PLAN_MODE_TOOL_NAME
  | typeof import('../../tools/ExitPlanModeTool/constants.js').EXIT_PLAN_MODE_V2_TOOL_NAME
  | typeof import('../../tools/ExitWorktreeTool/constants.js').EXIT_WORKTREE_TOOL_NAME
  | typeof import('../../tools/FileEditTool/constants.js').FILE_EDIT_TOOL_NAME
  | typeof import('../../tools/FileReadTool/prompt.js').FILE_READ_TOOL_NAME
  | typeof import('../../tools/FileWriteTool/prompt.js').FILE_WRITE_TOOL_NAME
  | typeof import('../../tools/GlobTool/prompt.js').GLOB_TOOL_NAME
  | typeof import('../../tools/GrepTool/prompt.js').GREP_TOOL_NAME
  | typeof import('../../tools/LSPTool/prompt.js').LSP_TOOL_NAME
  | typeof import('../../tools/ListMcpResourcesTool/prompt.js').LIST_MCP_RESOURCES_TOOL_NAME
  | typeof import('../../tools/NotebookEditTool/constants.js').NOTEBOOK_EDIT_TOOL_NAME
  | typeof import('../../tools/PowerShellTool/toolName.js').POWERSHELL_TOOL_NAME
  | typeof import('../../tools/REPLTool/constants.js').REPL_TOOL_NAME
  | typeof import('../../tools/RemoteTriggerTool/prompt.js').REMOTE_TRIGGER_TOOL_NAME
  | typeof import('../../tools/ScheduleCronTool/prompt.js').CRON_CREATE_TOOL_NAME
  | typeof import('../../tools/ScheduleCronTool/prompt.js').CRON_DELETE_TOOL_NAME
  | typeof import('../../tools/ScheduleCronTool/prompt.js').CRON_LIST_TOOL_NAME
  | typeof import('../../tools/SendMessageTool/constants.js').SEND_MESSAGE_TOOL_NAME
  | typeof import('../../tools/SkillTool/constants.js').SKILL_TOOL_NAME
  | typeof import('../../tools/SleepTool/prompt.js').SLEEP_TOOL_NAME
  | typeof import('../../tools/SyntheticOutputTool/SyntheticOutputTool.js').SYNTHETIC_OUTPUT_TOOL_NAME
  | typeof import('../../tools/TaskCreateTool/constants.js').TASK_CREATE_TOOL_NAME
  | typeof import('../../tools/TaskGetTool/constants.js').TASK_GET_TOOL_NAME
  | typeof import('../../tools/TaskListTool/constants.js').TASK_LIST_TOOL_NAME
  | typeof import('../../tools/TaskOutputTool/constants.js').TASK_OUTPUT_TOOL_NAME
  | typeof import('../../tools/TaskStopTool/prompt.js').TASK_STOP_TOOL_NAME
  | typeof import('../../tools/TaskUpdateTool/constants.js').TASK_UPDATE_TOOL_NAME
  | typeof import('../../tools/TeamCreateTool/constants.js').TEAM_CREATE_TOOL_NAME
  | typeof import('../../tools/TeamDeleteTool/constants.js').TEAM_DELETE_TOOL_NAME
  | typeof import('../../tools/TodoWriteTool/constants.js').TODO_WRITE_TOOL_NAME
  | typeof import('../../tools/ToolSearchTool/constants.js').TOOL_SEARCH_TOOL_NAME
  | typeof import('../../tools/WebFetchTool/prompt.js').WEB_FETCH_TOOL_NAME
  | typeof import('../../tools/WebSearchTool/prompt.js').WEB_SEARCH_TOOL_NAME

export type BuiltinToolName = KnownBuiltinToolName

