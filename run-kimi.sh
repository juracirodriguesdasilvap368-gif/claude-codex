#!/bin/bash
# 使用 Kimi 启动 Claude Code
#
# 请先设置环境变量（或写入 ~/.claude/settings.json）：
#   export KIMI_API_KEY="your_kimi_api_key"

if [ -z "$KIMI_API_KEY" ]; then
  echo "错误: 请先设置 KIMI_API_KEY 环境变量" >&2
  echo "  export KIMI_API_KEY=\"your_kimi_api_key\"" >&2
  exit 1
fi

export ANTHROPIC_BASE_URL="https://api.kimi.com/coding/"
export ANTHROPIC_API_KEY="$KIMI_API_KEY"
export ANTHROPIC_AUTH_TOKEN=""
export ANTHROPIC_DEFAULT_SONNET_MODEL="kimi"
export ANTHROPIC_DEFAULT_HAIKU_MODEL="kimi"
export ANTHROPIC_DEFAULT_OPUS_MODEL="kimi"
export API_TIMEOUT_MS="3000000"
export CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1

exec node "$(dirname "$0")/dist/cli.js" "$@"
