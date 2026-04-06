# claude-codex Web UI — 下一步优化任务

## 优先级说明

| 级别 | 说明 |
|------|------|
| 🔴 高 | 直接影响实际使用体验 |
| 🟡 中 | 提升稳定性和易用性 |
| 🟢 低 | 锦上添花 |

---

## Web UI

| # | 任务 | 优先级 | 说明 |
|---|------|--------|------|
| 1 | **WebSocket 自动重连** | 🔴 | 断线后指数退避重试，目前断线需手动刷新 |
| 2 | **消息流式渲染** | 🔴 | assistant 回复逐字显示，而非等整条消息到达后一次性输出 |
| 3 | **Token 用量显示** | 🟡 | session 顶部显示累计 cost / input tokens / output tokens |
| 4 | **文件树侧边栏** | 🟢 | 右侧面板展示当前 cwd 文件结构，支持点击将路径插入输入框 |

## Server

| # | 任务 | 优先级 | 说明 |
|---|------|--------|------|
| 5 | **`--model` 参数透传** | 🔴 | `createSession` 支持传 `--model <name>` 给子进程，而非只靠 `DEFAULT_*_MODEL` env |
| 6 | **进程健康检测** | 🟡 | 子进程僵死时自动重启，而非一直显示 `running` 状态 |
| 7 | **Session 持久化** | 🟡 | server 重启后从 `~/.claude/web-sessions.json` 恢复 session 列表 |

## Provider 扩展

| # | 任务 | 优先级 | 说明 |
|---|------|--------|------|
| 8 | **动态读取 providers** | 🟡 | 从 `~/.claude/settings.json` 自动发现配置的 providers，不再硬编码 |
| 9 | **Kimi 模型白名单** | 🟡 | 确认 `availableModels` allowlist 不会拦截 `kimi` 模型名 |

## CLI

| # | 任务 | 优先级 | 说明 |
|---|------|--------|------|
| 10 | **`web --open` 参数** | 🟢 | 启动 web server 后自动用系统浏览器打开页面 |
| 11 | **全局命令安装** | 🟢 | 让 `run-zhipu.sh` / `run-kimi.sh` 安装为全局命令 `claude-zhipu` / `claude-kimi` |

---

## 当前架构速览

```
dist/cli.js
  └── src/main.tsx (Commander.js)
        ├── web → src/web/server.ts      ← HTTP + WebSocket server
        │         ├── GET  /api/health
        │         ├── GET  /api/providers
        │         ├── GET  /api/sessions
        │         ├── POST /api/sessions  { provider, model, cwd }
        │         ├── DEL  /api/sessions/:id
        │         └── WS   /ws/sessions/:id
        └── ...其他子命令

web-ui/dist/                             ← Vite 构建产物 (63KB gzip)
  ├── Sidebar.tsx     Provider/Model 选择器 + Session 列表
  ├── App.tsx         主布局 + 快捷键 + 导出
  ├── Message.tsx     6 种消息类型渲染
  ├── Search.tsx      全文搜索叠层
  └── useSessionManager.ts  多 Session + WS 管理
```

## Provider 配置

| Provider | Base URL | Auth Env | 模型 |
|----------|----------|----------|------|
| 智谱 | `open.bigmodel.cn/api/anthropic` | `ANTHROPIC_AUTH_TOKEN` | GLM-5.1, GLM-4-Plus, GLM-4 |
| Kimi  | `api.kimi.com/coding/`           | `ANTHROPIC_API_KEY`    | kimi |

配置文件：`~/.claude/settings.json`

## 快速启动

```bash
cd /home/x/code/claude-codex

# Web UI（推荐）
node dist/cli.js web --port 3000 --web-dir ./web-ui/dist

# CLI — 智谱
./run-zhipu.sh

# CLI — Kimi
./run-kimi.sh
```
