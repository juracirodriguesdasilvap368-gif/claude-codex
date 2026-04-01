import axios from 'axios'
import { getOauthConfig } from '../constants/oauth.js'
import {
  CCR_BYOC_BETA,
  getOAuthHeaders,
  prepareApiRequest,
  type ListSessionsResponse,
  type SessionResource,
} from '../utils/teleport/api.js'

export type AssistantSession = {
  id: string
  title: string
  status: string
  createdAt: string
  updatedAt: string
  subtitle: string
}

function formatSubtitle(session: SessionResource): string {
  const updated = new Date(session.updated_at)
  const updatedLabel = Number.isNaN(updated.getTime())
    ? session.updated_at
    : updated.toLocaleString()
  return `${session.session_status} · updated ${updatedLabel}`
}

function toAssistantSession(session: SessionResource): AssistantSession {
  return {
    id: session.id,
    title: session.title || 'Untitled session',
    status: session.session_status,
    createdAt: session.created_at,
    updatedAt: session.updated_at,
    subtitle: formatSubtitle(session),
  }
}

export async function discoverAssistantSessions(): Promise<AssistantSession[]> {
  const { accessToken, orgUUID } = await prepareApiRequest()
  const response = await axios.get<ListSessionsResponse>(
    `${getOauthConfig().BASE_API_URL}/v1/sessions`,
    {
      headers: {
        ...getOAuthHeaders(accessToken),
        'anthropic-beta': CCR_BYOC_BETA,
        'x-organization-uuid': orgUUID,
      },
      timeout: 15000,
      validateStatus: status => status < 500,
    },
  )

  if (response.status !== 200) {
    throw new Error(
      `Failed to discover sessions: ${response.status} ${response.statusText}`,
    )
  }

  const sessions = (response.data.data || [])
    .filter(session => session.session_status !== 'archived')
    .sort((left, right) =>
      right.updated_at.localeCompare(left.updated_at),
    )
    .map(toAssistantSession)

  return sessions
}
