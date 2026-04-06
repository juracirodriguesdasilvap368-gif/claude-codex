/**
 * Web server entrypoint for claude-codex.
 *
 * Starts a local HTTP + WebSocket server that allows controlling
 * claude sessions from a web browser.
 *
 * Architecture:
 *   Browser (React SPA)
 *     ↕ WebSocket (SDKMessage protocol)
 *   Local Web Server (this file)
 *     ├── REST: POST /api/sessions (create)
 *     ├── REST: GET  /api/sessions (list)
 *     ├── REST: DELETE /api/sessions/:id (delete)
 *     ├── REST: GET  /api/health
 *     ├── WS:   /ws/sessions/:id (bidirectional message stream)
 *     ├── Static: /* (frontend SPA)
 *     └── SessionProcessManager
 *         └── spawns child `claude -p --input-format stream-json --output-format stream-json`
 */
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { createInterface } from 'node:readline'
import { spawn, type ChildProcess } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { join, resolve } from 'node:path'
import { readFileSync, existsSync } from 'node:fs'
import { createReadStream } from 'node:fs'
import { createGzip } from 'node:zlib'
// @ts-expect-error ws types may not be available in all environments
import { WebSocketServer, WebSocket } from 'ws'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SessionInfo {
  id: string
  status: 'starting' | 'running' | 'idle' | 'stopped' | 'error'
  createdAt: number
  cwd: string
  provider: string
  model: string
  process: ChildProcess | null
  clients: Set<WebSocket>
  messageBuffer: string[] // Last N messages for replay
}

interface WebServerConfig {
  port: number
  host: string
  authToken?: string
  cwd: string
  webDir?: string // path to built frontend assets
}

// ---------------------------------------------------------------------------
// Provider configurations for multi-model support
// ---------------------------------------------------------------------------

interface ProviderConfig {
  name: string
  baseUrl: string
  apiKeyEnv: string       // env var name that holds the API key
  models: string[]        // available model IDs
  defaultModel: string
}

const PROVIDER_REGISTRY: Record<string, ProviderConfig> = {
  zhipu: {
    name: '智谱 (ZhiPu)',
    baseUrl: 'https://open.bigmodel.cn/api/anthropic',
    apiKeyEnv: 'ANTHROPIC_AUTH_TOKEN',
    models: ['GLM-5.1', 'GLM-4-Plus', 'GLM-4'],
    defaultModel: 'GLM-5.1',
  },
  kimi: {
    name: 'Kimi',
    baseUrl: 'https://api.kimi.com/coding/',
    apiKeyEnv: 'ANTHROPIC_API_KEY',
    models: ['kimi'],
    defaultModel: 'kimi',
  },
}

function getProviderEnv(providerId: string): Record<string, string> {
  const provider = PROVIDER_REGISTRY[providerId]
  if (!provider) return {}
  const model = provider.defaultModel
  const env: Record<string, string> = {
    ANTHROPIC_BASE_URL: provider.baseUrl,
    ANTHROPIC_DEFAULT_HAIKU_MODEL: model,
    ANTHROPIC_DEFAULT_SONNET_MODEL: model,
    ANTHROPIC_DEFAULT_OPUS_MODEL: model,
  }
  // Clear conflicting auth keys depending on which provider is selected
  if (provider.apiKeyEnv === 'ANTHROPIC_API_KEY') {
    // Kimi-like: uses ANTHROPIC_API_KEY, clear ANTHROPIC_AUTH_TOKEN to avoid conflicts
    env.ANTHROPIC_AUTH_TOKEN = ''
  } else if (provider.apiKeyEnv === 'ANTHROPIC_AUTH_TOKEN') {
    // ZhiPu-like: uses ANTHROPIC_AUTH_TOKEN, clear ANTHROPIC_API_KEY to avoid conflicts
    env.ANTHROPIC_API_KEY = ''
  }
  return env
}

// ---------------------------------------------------------------------------
// Session Process Manager
// ---------------------------------------------------------------------------

const MAX_BUFFER_SIZE = 200 // Keep last 200 messages for replay

class SessionProcessManager {
  private sessions = new Map<string, SessionInfo>()
  private execPath: string
  private scriptArgs: string[]
  private defaultCwd: string

  constructor(defaultCwd: string) {
    this.defaultCwd = defaultCwd
    // Determine how to spawn child claude processes
    this.execPath = process.execPath
    // If running from a compiled binary, no script args needed
    // If running via node/bun, need the entry script path
    if (process.argv[1] && !process.execPath.endsWith('claude')) {
      this.scriptArgs = [process.argv[1]]
    } else {
      this.scriptArgs = []
    }
  }

  createSession(cwd?: string, provider?: string, model?: string): SessionInfo {
    const id = randomUUID()
    const sessionCwd = cwd || this.defaultCwd
    const providerId = provider && PROVIDER_REGISTRY[provider] ? provider : Object.keys(PROVIDER_REGISTRY)[0]!
    const providerConfig = PROVIDER_REGISTRY[providerId]!
    const sessionModel = model && providerConfig.models.includes(model) ? model : providerConfig.defaultModel
    const session: SessionInfo = {
      id,
      status: 'starting',
      createdAt: Date.now(),
      cwd: sessionCwd,
      provider: providerId,
      model: sessionModel,
      process: null,
      clients: new Set(),
      messageBuffer: [],
    }

    this.sessions.set(id, session)
    this.spawnProcess(session)
    return session
  }

  private spawnProcess(session: SessionInfo): void {
    const args = [
      ...this.scriptArgs,
      '--print',
      '--input-format', 'stream-json',
      '--output-format', 'stream-json',
      '--replay-user-messages',
    ]

    const child = spawn(this.execPath, args, {
      cwd: session.cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        ...getProviderEnv(session.provider),
        // Ensure non-interactive mode
        CLAUDE_CODE_ENVIRONMENT_KIND: 'web-server',
      },
    })

    session.process = child
    session.status = 'running'

    // Read stdout line by line (NDJSON)
    const rl = createInterface({ input: child.stdout! })
    rl.on('line', (line: string) => {
      if (!line.trim()) return

      // Buffer for replay
      session.messageBuffer.push(line)
      if (session.messageBuffer.length > MAX_BUFFER_SIZE) {
        session.messageBuffer.shift()
      }

      // Broadcast to all connected WebSocket clients
      for (const ws of session.clients) {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(line)
        }
      }
    })

    // Capture stderr for debugging
    const stderrRl = createInterface({ input: child.stderr! })
    stderrRl.on('line', (line: string) => {
      // Forward as a system message
      const errMsg = JSON.stringify({
        type: 'system',
        subtype: 'stderr',
        message: line,
      })
      for (const ws of session.clients) {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(errMsg)
        }
      }
    })

    child.on('exit', (code: number | null) => {
      session.status = code === 0 ? 'stopped' : 'error'
      session.process = null

      // Notify clients
      const statusMsg = JSON.stringify({
        type: 'system',
        subtype: 'session_ended',
        exit_code: code,
      })
      for (const ws of session.clients) {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(statusMsg)
        }
      }
    })
  }

  getSession(id: string): SessionInfo | undefined {
    return this.sessions.get(id)
  }

  listSessions(): Array<{
    id: string
    status: string
    createdAt: number
    cwd: string
    provider: string
    model: string
    clientCount: number
  }> {
    return Array.from(this.sessions.values()).map(s => ({
      id: s.id,
      status: s.status,
      createdAt: s.createdAt,
      cwd: s.cwd,
      provider: s.provider,
      model: s.model,
      clientCount: s.clients.size,
    }))
  }

  deleteSession(id: string): boolean {
    const session = this.sessions.get(id)
    if (!session) return false

    if (session.process) {
      session.process.kill('SIGTERM')
    }
    for (const ws of session.clients) {
      ws.close(1000, 'Session deleted')
    }
    this.sessions.delete(id)
    return true
  }

  /**
   * Send a message to the session's stdin (child process).
   * The message should be a valid SDKUserMessage or SDKControlResponse.
   */
  sendToSession(id: string, message: string): boolean {
    const session = this.sessions.get(id)
    if (!session?.process?.stdin?.writable) return false
    session.process.stdin.write(message + '\n')
    return true
  }

  addClient(id: string, ws: WebSocket): boolean {
    const session = this.sessions.get(id)
    if (!session) return false
    session.clients.add(ws)
    return true
  }

  removeClient(id: string, ws: WebSocket): void {
    const session = this.sessions.get(id)
    if (session) {
      session.clients.delete(ws)
    }
  }
}

// ---------------------------------------------------------------------------
// HTTP Router
// ---------------------------------------------------------------------------

function sendJSON(res: ServerResponse, status: number, data: unknown): void {
  const body = JSON.stringify(data)
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  })
  res.end(body)
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    const MAX_BODY = 1024 * 1024 // 1MB limit
    req.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > MAX_BODY) {
        reject(new Error('Request body too large'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString()))
    req.on('error', reject)
  })
}

// ---------------------------------------------------------------------------
// Static file serving
// ---------------------------------------------------------------------------

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
}

function serveStatic(webDir: string, url: string, req: IncomingMessage, res: ServerResponse): boolean {
  // Prevent path traversal
  const safePath = url.split('?')[0]!.replace(/\.\./g, '')
  let filePath = join(webDir, safePath === '/' ? 'index.html' : safePath)

  // SPA fallback: if file doesn't exist and not an API/WS path, serve index.html
  if (!existsSync(filePath)) {
    filePath = join(webDir, 'index.html')
    if (!existsSync(filePath)) return false
  }

  // Ensure resolved path is within webDir
  const resolved = resolve(filePath)
  if (!resolved.startsWith(resolve(webDir))) return false

  try {
    const ext = filePath.substring(filePath.lastIndexOf('.'))
    const mime = MIME_TYPES[ext] || 'application/octet-stream'
    const isCompressible = ['.html', '.js', '.css', '.json', '.svg'].includes(ext)
    const acceptGzip = (req.headers['accept-encoding'] || '').includes('gzip')

    if (isCompressible && acceptGzip) {
      res.writeHead(200, {
        'Content-Type': mime,
        'Content-Encoding': 'gzip',
        'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable',
        'Vary': 'Accept-Encoding',
      })
      createReadStream(resolved).pipe(createGzip()).pipe(res)
    } else {
      const content = readFileSync(resolved)
      res.writeHead(200, {
        'Content-Type': mime,
        'Content-Length': content.length,
        'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable',
      })
      res.end(content)
    }
    return true
  } catch {
    return false
  }
}

// ---------------------------------------------------------------------------
// Auth middleware
// ---------------------------------------------------------------------------

function checkAuth(
  req: IncomingMessage,
  authToken: string | undefined,
): boolean {
  if (!authToken) return true // No auth configured
  const header = req.headers['authorization']
  if (header === `Bearer ${authToken}`) return true
  // Also check query param for WebSocket upgrades
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)
  if (url.searchParams.get('token') === authToken) return true
  return false
}

// ---------------------------------------------------------------------------
// Main server
// ---------------------------------------------------------------------------

export async function startWebServer(config: WebServerConfig): Promise<void> {
  const manager = new SessionProcessManager(config.cwd)

  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    // CORS preflight
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      })
      res.end()
      return
    }

    // Auth check
    if (!checkAuth(req, config.authToken)) {
      sendJSON(res, 401, { error: 'Unauthorized' })
      return
    }

    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)
    const pathname = url.pathname

    try {
      // --- REST API ---
      if (pathname === '/api/health' && req.method === 'GET') {
        sendJSON(res, 200, { status: 'ok', version: '1.0.0' })
        return
      }

      // GET /api/providers — list available model providers
      if (pathname === '/api/providers' && req.method === 'GET') {
        const providers = Object.entries(PROVIDER_REGISTRY).map(([id, p]) => ({
          id,
          name: p.name,
          models: p.models,
          defaultModel: p.defaultModel,
        }))
        sendJSON(res, 200, { providers })
        return
      }

      if (pathname === '/api/sessions' && req.method === 'GET') {
        sendJSON(res, 200, { sessions: manager.listSessions() })
        return
      }

      if (pathname === '/api/sessions' && req.method === 'POST') {
        const body = await readBody(req)
        let cwd: string | undefined
        let provider: string | undefined
        let model: string | undefined
        try {
          const parsed = JSON.parse(body)
          cwd = parsed.cwd
          provider = parsed.provider
          model = parsed.model
        } catch {
          // Use defaults
        }
        const session = manager.createSession(cwd, provider, model)
        sendJSON(res, 201, {
          session_id: session.id,
          ws_url: `ws://${config.host}:${config.port}/ws/sessions/${session.id}`,
          status: session.status,
          provider: session.provider,
          model: session.model,
        })
        return
      }

      // DELETE /api/sessions/:id
      const deleteMatch = pathname.match(/^\/api\/sessions\/([a-f0-9-]+)$/)
      if (deleteMatch && req.method === 'DELETE') {
        const deleted = manager.deleteSession(deleteMatch[1]!)
        if (deleted) {
          sendJSON(res, 200, { deleted: true })
        } else {
          sendJSON(res, 404, { error: 'Session not found' })
        }
        return
      }

      // --- Static files ---
      if (config.webDir && serveStatic(config.webDir, pathname, req, res)) {
        return
      }

      // Fallback: inline minimal web UI if no webDir
      if (pathname === '/' || pathname === '/index.html') {
        const html = getInlineHTML()
        res.writeHead(200, {
          'Content-Type': 'text/html',
          'Content-Length': Buffer.byteLength(html),
        })
        res.end(html)
        return
      }

      sendJSON(res, 404, { error: 'Not found' })
    } catch (err) {
      sendJSON(res, 500, { error: 'Internal server error' })
    }
  })

  // --- WebSocket server ---
  const wss = new WebSocketServer({ noServer: true })

  server.on('upgrade', (req: IncomingMessage, socket: any, head: any) => {
    // Auth check for WebSocket
    if (!checkAuth(req, config.authToken)) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n')
      socket.destroy()
      return
    }

    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)
    const wsMatch = url.pathname.match(/^\/ws\/sessions\/([a-f0-9-]+)$/)
    if (!wsMatch) {
      socket.write('HTTP/1.1 404 Not Found\r\n\r\n')
      socket.destroy()
      return
    }

    const sessionId = wsMatch[1]!
    const session = manager.getSession(sessionId)
    if (!session) {
      socket.write('HTTP/1.1 404 Session Not Found\r\n\r\n')
      socket.destroy()
      return
    }

    wss.handleUpgrade(req, socket, head, (ws: any) => {
      // Register client
      manager.addClient(sessionId, ws)

      // Replay buffered messages
      for (const msg of session.messageBuffer) {
        ws.send(msg)
      }

      // Send current status
      ws.send(JSON.stringify({
        type: 'system',
        subtype: 'session_status',
        status: session.status,
        session_id: sessionId,
      }))

      // Forward incoming messages to session stdin
      ws.on('message', (data: any) => {
        const message = typeof data === 'string' ? data : data.toString()
        manager.sendToSession(sessionId, message)
      })

      ws.on('close', () => {
        manager.removeClient(sessionId, ws)
      })

      ws.on('error', () => {
        manager.removeClient(sessionId, ws)
      })
    })
  })

  // Start server
  return new Promise<void>((resolve, reject) => {
    server.on('error', reject)
    server.listen(config.port, config.host, () => {
      const addr = `http://${config.host}:${config.port}`
      // biome-ignore lint/suspicious/noConsole: intentional
      console.log(`\n  Claude Web UI is running at: ${addr}\n`)
      // biome-ignore lint/suspicious/noConsole: intentional
      console.log(`  Press Ctrl+C to stop.\n`)
      resolve()
    })
  })
}

// ---------------------------------------------------------------------------
// Inline minimal HTML (used when no separate frontend build exists)
// ---------------------------------------------------------------------------

function getInlineHTML(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Claude Web UI</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    :root {
      --bg: #1a1a2e; --surface: #16213e; --border: #0f3460;
      --text: #e4e4e7; --muted: #8b8b9e; --accent: #e94560;
      --accent-hover: #ff6b81; --success: #4ade80; --input-bg: #0d1b2a;
    }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; background: var(--bg); color: var(--text); height: 100vh; display: flex; flex-direction: column; }
    #header { padding: 12px 20px; border-bottom: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; background: var(--surface); }
    #header h1 { font-size: 18px; font-weight: 600; }
    #status { font-size: 13px; color: var(--muted); display: flex; align-items: center; gap: 6px; }
    #status .dot { width: 8px; height: 8px; border-radius: 50%; }
    .dot.connected { background: var(--success); }
    .dot.disconnected { background: var(--accent); }
    #messages { flex: 1; overflow-y: auto; padding: 16px 20px; display: flex; flex-direction: column; gap: 8px; }
    .msg { padding: 10px 14px; border-radius: 8px; max-width: 85%; word-wrap: break-word; white-space: pre-wrap; font-size: 14px; line-height: 1.5; }
    .msg.user { align-self: flex-end; background: var(--border); color: var(--text); }
    .msg.assistant { align-self: flex-start; background: var(--surface); border: 1px solid var(--border); }
    .msg.system { align-self: center; background: transparent; color: var(--muted); font-size: 12px; font-style: italic; }
    .msg.tool { align-self: flex-start; background: #1a2744; border-left: 3px solid var(--accent); font-family: monospace; font-size: 13px; }
    .msg.approval { align-self: flex-start; background: #2a1a2e; border: 1px solid var(--accent); padding: 14px; }
    .approval-actions { margin-top: 10px; display: flex; gap: 8px; }
    .approval-actions button { padding: 6px 16px; border: none; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 500; }
    .btn-approve { background: var(--success); color: #000; }
    .btn-approve:hover { opacity: 0.85; }
    .btn-deny { background: var(--accent); color: #fff; }
    .btn-deny:hover { background: var(--accent-hover); }
    #input-area { padding: 12px 20px; border-top: 1px solid var(--border); background: var(--surface); display: flex; gap: 10px; }
    #prompt { flex: 1; padding: 10px 14px; border: 1px solid var(--border); border-radius: 8px; background: var(--input-bg); color: var(--text); font-size: 14px; font-family: inherit; resize: none; outline: none; min-height: 42px; max-height: 150px; }
    #prompt:focus { border-color: var(--accent); }
    #prompt::placeholder { color: var(--muted); }
    #send { padding: 10px 20px; background: var(--accent); color: #fff; border: none; border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: 500; }
    #send:hover { background: var(--accent-hover); }
    #send:disabled { opacity: 0.5; cursor: not-allowed; }
    .thinking { color: var(--muted); font-style: italic; }
    pre { background: var(--input-bg); padding: 8px 10px; border-radius: 6px; overflow-x: auto; margin: 4px 0; }
    code { font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace; font-size: 13px; }
  </style>
</head>
<body>
  <div id="header">
    <h1>Claude</h1>
    <div id="status"><span class="dot disconnected" id="dot"></span><span id="status-text">Disconnected</span></div>
  </div>
  <div id="messages"></div>
  <div id="input-area">
    <textarea id="prompt" placeholder="Type a message... (Enter to send, Shift+Enter for newline)" rows="1"></textarea>
    <button id="send" disabled>Send</button>
  </div>

<script>
let ws = null;
let sessionId = null;
let currentText = '';

const messages = document.getElementById('messages');
const prompt = document.getElementById('prompt');
const sendBtn = document.getElementById('send');
const dot = document.getElementById('dot');
const statusText = document.getElementById('status-text');

// Auto-create session
async function init() {
  try {
    const res = await fetch('/api/sessions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    const data = await res.json();
    sessionId = data.session_id;
    connectWS(data.ws_url);
  } catch(e) {
    addMessage('system', 'Failed to create session: ' + e.message);
  }
}

function connectWS(url) {
  // Convert ws URL to use current host if needed
  const wsUrl = url.replace('ws://0.0.0.0', 'ws://' + location.hostname);
  ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    dot.className = 'dot connected';
    statusText.textContent = 'Connected';
    sendBtn.disabled = false;
  };

  ws.onclose = () => {
    dot.className = 'dot disconnected';
    statusText.textContent = 'Disconnected';
    sendBtn.disabled = true;
  };

  ws.onmessage = (e) => {
    try {
      const msg = JSON.parse(e.data);
      handleMessage(msg);
    } catch {}
  };
}

function handleMessage(msg) {
  switch(msg.type) {
    case 'assistant': {
      const content = msg.message?.content;
      if (!Array.isArray(content)) break;
      for (const block of content) {
        if (block.type === 'text') {
          addMessage('assistant', block.text);
        } else if (block.type === 'tool_use') {
          addMessage('tool', '🔧 ' + block.name + '\\n' + JSON.stringify(block.input, null, 2));
        }
      }
      break;
    }
    case 'result': {
      const content = msg.message?.content;
      if (!Array.isArray(content)) break;
      for (const block of content) {
        if (block.type === 'text') {
          addMessage('tool', '→ ' + block.text);
        }
      }
      break;
    }
    case 'control_request': {
      if (msg.request?.subtype === 'can_use_tool') {
        addApproval(msg.request_id, msg.request);
      }
      break;
    }
    case 'user': {
      // Replayed user message
      const content = msg.message?.content;
      if (typeof content === 'string') {
        addMessage('user', content);
      } else if (Array.isArray(content)) {
        const text = content.filter(b => b.type === 'text').map(b => b.text).join('');
        if (text) addMessage('user', text);
      }
      break;
    }
    case 'system': {
      if (msg.subtype === 'session_ended') {
        addMessage('system', 'Session ended (exit code: ' + msg.exit_code + ')');
      }
      break;
    }
  }
}

function addMessage(type, text) {
  const el = document.createElement('div');
  el.className = 'msg ' + type;
  el.textContent = text;
  messages.appendChild(el);
  messages.scrollTop = messages.scrollHeight;
}

function addApproval(requestId, request) {
  const el = document.createElement('div');
  el.className = 'msg approval';
  el.innerHTML = '<strong>Permission Request</strong><br>Tool: ' +
    escapeHtml(request.tool_name) + '<br><pre><code>' +
    escapeHtml(JSON.stringify(request.input, null, 2)) +
    '</code></pre><div class="approval-actions">' +
    '<button class="btn-approve" onclick="approve(\\'' + requestId + '\\')">Approve</button>' +
    '<button class="btn-deny" onclick="deny(\\'' + requestId + '\\')">Deny</button></div>';
  messages.appendChild(el);
  messages.scrollTop = messages.scrollHeight;
}

function approve(requestId) {
  if (!ws) return;
  ws.send(JSON.stringify({
    type: 'control_response',
    response: {
      subtype: 'success',
      request_id: requestId,
      response: { behavior: 'allow' }
    }
  }));
  // Remove the approval UI
  const btns = event.target.closest('.approval-actions');
  if (btns) btns.innerHTML = '<span style="color:var(--success)">✓ Approved</span>';
}

function deny(requestId) {
  if (!ws) return;
  ws.send(JSON.stringify({
    type: 'control_response',
    response: {
      subtype: 'success',
      request_id: requestId,
      response: { behavior: 'deny', message: 'Denied by user' }
    }
  }));
  const btns = event.target.closest('.approval-actions');
  if (btns) btns.innerHTML = '<span style="color:var(--accent)">✗ Denied</span>';
}

function escapeHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function sendMessage() {
  const text = prompt.value.trim();
  if (!text || !ws) return;

  addMessage('user', text);
  ws.send(JSON.stringify({
    type: 'user',
    message: { role: 'user', content: text },
    parent_tool_use_id: null,
    session_id: '',
  }));
  prompt.value = '';
  prompt.style.height = 'auto';
}

prompt.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

prompt.addEventListener('input', () => {
  prompt.style.height = 'auto';
  prompt.style.height = Math.min(prompt.scrollHeight, 150) + 'px';
});

sendBtn.addEventListener('click', sendMessage);

init();
</script>
</body>
</html>`
}
