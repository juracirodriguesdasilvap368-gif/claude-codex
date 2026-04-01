import { APIUserAbortError } from '@anthropic-ai/sdk'
import type { QuerySource } from '../../constants/querySource.js'
import type { Message } from '../../types/message.js'
import { hasExactErrorMessage } from '../../utils/errors.js'
import type { CacheSafeParams } from '../../utils/forkedAgent.js'
import {
  isMediaSizeErrorMessage,
  isPromptTooLongMessage,
} from '../api/errors.js'
import type { CompactionResult } from './compact.js'
import {
  compactConversation,
  ERROR_MESSAGE_INCOMPLETE_RESPONSE,
  ERROR_MESSAGE_NOT_ENOUGH_MESSAGES,
  ERROR_MESSAGE_PROMPT_TOO_LONG,
  ERROR_MESSAGE_USER_ABORT,
  stripImagesFromMessages,
} from './compact.js'

type CompactParams = {
  hasAttempted: boolean
  querySource: QuerySource
  aborted: boolean
  messages?: Message[]
  cacheSafeParams?: CacheSafeParams
}

type ManualCompactOptions = {
  customInstructions: string
  trigger: 'manual'
}

type ReactiveCompactFailureReason =
  | 'too_few_groups'
  | 'aborted'
  | 'exhausted'
  | 'error'
  | 'media_unstrippable'

type ReactiveCompactOutcome =
  | { ok: true; result: CompactionResult }
  | { ok: false; reason: ReactiveCompactFailureReason }

function isEnvTruthy(value: string | undefined): boolean {
  if (!value) return false
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase())
}

export function isReactiveCompactEnabled(): boolean {
  return isEnvTruthy(process.env.CLAUDE_CODE_REACTIVE_COMPACT)
}

export function isReactiveOnlyMode(): boolean {
  return isEnvTruthy(process.env.CLAUDE_CODE_REACTIVE_ONLY)
}

export function isWithheldPromptTooLong(
  message: Message | undefined,
): boolean {
  return (
    isReactiveCompactEnabled() &&
    !!message &&
    message.type === 'assistant' &&
    isPromptTooLongMessage(message)
  )
}

export function isWithheldMediaSizeError(
  message: Message | undefined,
): boolean {
  return (
    isReactiveCompactEnabled() &&
    !!message &&
    message.type === 'assistant' &&
    isMediaSizeErrorMessage(message)
  )
}

export async function tryReactiveCompact(
  params: CompactParams,
): Promise<CompactionResult | null> {
  if (
    params.aborted ||
    params.hasAttempted ||
    !params.messages ||
    !params.cacheSafeParams
  ) {
    return null
  }

  const outcome = await reactiveCompactOnPromptTooLong(
    params.messages,
    params.cacheSafeParams,
    {
      customInstructions: '',
      trigger: 'manual',
    },
  )
  return outcome.ok ? outcome.result : null
}

export async function reactiveCompactOnPromptTooLong(
  messages: Message[],
  cacheSafeParams: CacheSafeParams,
  options: ManualCompactOptions,
): Promise<ReactiveCompactOutcome> {
  if (messages.length < 2) {
    return { ok: false, reason: 'too_few_groups' }
  }

  try {
    const summaryInput = stripImagesFromMessages(messages)
    const result = await compactConversation(
      summaryInput,
      cacheSafeParams.toolUseContext,
      cacheSafeParams,
      false,
      options.customInstructions,
      false,
    )
    return { ok: true, result }
  } catch (error) {
    if (error instanceof APIUserAbortError) {
      return { ok: false, reason: 'aborted' }
    }
    if (hasExactErrorMessage(error, ERROR_MESSAGE_USER_ABORT)) {
      return { ok: false, reason: 'aborted' }
    }
    if (hasExactErrorMessage(error, ERROR_MESSAGE_NOT_ENOUGH_MESSAGES)) {
      return { ok: false, reason: 'too_few_groups' }
    }
    if (
      hasExactErrorMessage(error, ERROR_MESSAGE_INCOMPLETE_RESPONSE) ||
      hasExactErrorMessage(error, ERROR_MESSAGE_PROMPT_TOO_LONG)
    ) {
      return { ok: false, reason: 'exhausted' }
    }
    return { ok: false, reason: 'error' }
  }
}
