#!/bin/bash
# 使用智谱 GLM-5.1 启动 Claude Code
#
# 请先设置环境变量（或写入 ~/.claude/settings.json）：
#   export ZHIPU_API_KEY="your_zhipu_api_key"

if [ -z "$ZHIPU_API_KEY" ]; then
  echo "错误: 请先设置 ZHIPU_API_KEY 环境变量" >&2
  echo "  export ZHIPU_API_KEY=\"your_zhipu_api_key\"" >&2
  exit 1
fi

export ANTHROPIC_BASE_URL="https://open.bigmodel.cn/api/anthropic"
export ANTHROPIC_AUTH_TOKEN="$ZHIPU_API_KEY"
export ANTHROPIC_API_KEY=""
export ANTHROPIC_DEFAULT_SONNET_MODEL="GLM-5.1"
export ANTHROPIC_DEFAULT_HAIKU_MODEL="GLM-5.1"
export ANTHROPIC_DEFAULT_OPUS_MODEL="GLM-5.1"
export API_TIMEOUT_MS="3000000"
export CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1

exec node "$(dirname "$0")/dist/cli.js" "$@"
