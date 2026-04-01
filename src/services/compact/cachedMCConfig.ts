export type CachedMCConfig = {
  enabled: boolean
  triggerThreshold: number
  keepRecent: number
  supportedModels: string[]
  systemPromptSuggestSummaries: boolean
}

const DEFAULT_CONFIG: CachedMCConfig = {
  enabled: false,
  triggerThreshold: 12,
  keepRecent: 4,
  supportedModels: [
    'claude-opus',
    'claude-sonnet',
    'claude-haiku',
    'glm-5.1',
  ],
  systemPromptSuggestSummaries: true,
}

function parsePositiveInt(
  value: string | undefined,
  fallback: number,
): number {
  const parsed = value ? Number.parseInt(value, 10) : Number.NaN
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function isEnvTruthy(value: string | undefined): boolean {
  if (!value) return false
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase())
}

export function getCachedMCConfig(): CachedMCConfig {
  return {
    enabled: isEnvTruthy(process.env.CLAUDE_CODE_CACHED_MICROCOMPACT),
    triggerThreshold: parsePositiveInt(
      process.env.CLAUDE_CODE_CACHED_MC_TRIGGER_THRESHOLD,
      DEFAULT_CONFIG.triggerThreshold,
    ),
    keepRecent: parsePositiveInt(
      process.env.CLAUDE_CODE_CACHED_MC_KEEP_RECENT,
      DEFAULT_CONFIG.keepRecent,
    ),
    supportedModels: DEFAULT_CONFIG.supportedModels,
    systemPromptSuggestSummaries:
      !process.env.CLAUDE_CODE_CACHED_MC_PROMPT_HINTS ||
      isEnvTruthy(process.env.CLAUDE_CODE_CACHED_MC_PROMPT_HINTS),
  }
}
