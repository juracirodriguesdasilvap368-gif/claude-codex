import { basename } from 'path'
import { getOriginalCwd } from '../bootstrap/state.js'
import { formatAgentId } from '../utils/agentId.js'
import { logForDebugging } from '../utils/debug.js'
import { getCwd } from '../utils/cwd.js'
import { TEAM_LEAD_NAME } from '../utils/swarm/constants.js'
import {
  getTeamFilePath,
  type TeamFile,
  writeTeamFileAsync,
} from '../utils/swarm/teamHelpers.js'
import { assignTeammateColor } from '../utils/swarm/teammateLayoutManager.js'
import { setCliTeammateModeOverride } from '../utils/swarm/backends/teammateModeSnapshot.js'
import { getInitialSettings } from '../utils/settings/settings.js'

let assistantForced = false

type AssistantTeamContext = {
  teamName: string
  teamFilePath: string
  leadAgentId: string
  teammates: Record<
    string,
    {
      name: string
      agentType: string
      color: string
      tmuxSessionName: string
      tmuxPaneId: string
      cwd: string
      spawnedAt: number
    }
  >
}

function getAssistantName(): string {
  return getInitialSettings().assistantName?.trim() || 'Assistant'
}

function getAssistantTeamName(): string {
  const cwdName = basename(getOriginalCwd()) || 'workspace'
  return `${cwdName}-assistant`
}

export function markAssistantForced(): void {
  assistantForced = true
}

export function isAssistantForced(): boolean {
  return assistantForced
}

export function isAssistantMode(): boolean {
  return assistantForced || getInitialSettings().assistant === true
}

export async function initializeAssistantTeam(): Promise<AssistantTeamContext> {
  const teamName = getAssistantTeamName()
  const leadAgentId = formatAgentId(TEAM_LEAD_NAME, teamName)
  const teamFilePath = getTeamFilePath(teamName)
  const now = Date.now()
  const cwd = getCwd()

  const teamFile: TeamFile = {
    name: teamName,
    description: `${getAssistantName()} assistant team`,
    createdAt: now,
    leadAgentId,
    members: [
      {
        agentId: leadAgentId,
        name: TEAM_LEAD_NAME,
        agentType: getAssistantName(),
        color: assignTeammateColor(leadAgentId),
        joinedAt: now,
        tmuxPaneId: '',
        cwd,
        subscriptions: [],
      },
    ],
  }

  setCliTeammateModeOverride('in-process')
  await writeTeamFileAsync(teamName, teamFile)
  logForDebugging(
    `[assistant] initialized in-process assistant team at ${teamFilePath}`,
  )

  return {
    teamName,
    teamFilePath,
    leadAgentId,
    teammates: {
      [leadAgentId]: {
        name: TEAM_LEAD_NAME,
        agentType: getAssistantName(),
        color: assignTeammateColor(leadAgentId),
        tmuxSessionName: '',
        tmuxPaneId: '',
        cwd,
        spawnedAt: now,
      },
    },
  }
}

export function getAssistantSystemPromptAddendum(): string {
  const assistantName = getAssistantName()
  return [
    '# Assistant Mode',
    `You are running in assistant mode as ${assistantName}.`,
    'Keep the conversation continuous across restarts, stay proactive, and prefer concise checkpoint-style updates when work is in progress.',
    'When delegating to teammates, default to in-process collaboration unless the user or task requires something else.',
  ].join('\n')
}

export function getAssistantActivationPath(): string {
  return 'settings.assistant'
}
