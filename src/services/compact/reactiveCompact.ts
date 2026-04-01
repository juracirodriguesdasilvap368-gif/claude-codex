import type { QuerySource } from '../../constants/querySource.js'
import type { CompactionResult } from './compact.js'

type CompactParams = {
  hasAttempted: boolean
  querySource: QuerySource
  aborted: boolean
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

export function isWithheldPromptTooLong(): boolean {
  return false
}

export function isWithheldMediaSizeError(): boolean {
  return false
}

export async function tryReactiveCompact(
  params: CompactParams,
): Promise<CompactionResult | null> {
  if (params.aborted || params.hasAttempted) {
    return null
  }
  return null
}

export async function reactiveCompactOnPromptTooLong(
  _messages: unknown[],
  _cacheSafeParams: unknown,
  _options: ManualCompactOptions,
): Promise<ReactiveCompactOutcome> {
  return { ok: false, reason: 'exhausted' }
}
