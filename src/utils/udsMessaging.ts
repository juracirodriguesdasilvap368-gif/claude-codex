import { randomUUID } from 'crypto'
import { existsSync } from 'fs'
import { mkdir, rm } from 'fs/promises'
import net from 'net'
import { dirname, join } from 'path'
import { tmpdir } from 'os'
import { CROSS_SESSION_MESSAGE_TAG } from '../constants/xml.js'
import { enqueue } from './messageQueueManager.js'

let server: net.Server | null = null
let socketPath: string | null = null
let onEnqueue: (() => void) | undefined

function wrapCrossSessionMessage(from: string, content: string): string {
  const escapedFrom = from.replace(/"/g, '&quot;')
  return `<${CROSS_SESSION_MESSAGE_TAG} from="${escapedFrom}">${content}</${CROSS_SESSION_MESSAGE_TAG}>`
}

export function getDefaultUdsSocketPath(): string {
  return join(tmpdir(), 'claude-code', `${process.pid}.sock`)
}

export function getUdsMessagingSocketPath(): string | undefined {
  return socketPath ?? process.env.CLAUDE_CODE_MESSAGING_SOCKET
}

export function setOnEnqueue(callback: (() => void) | undefined): void {
  onEnqueue = callback
}

export async function startUdsMessaging(
  path: string,
  _options?: { isExplicit?: boolean },
): Promise<void> {
  if (process.platform === 'win32') {
    return
  }

  if (server && socketPath === path) {
    process.env.CLAUDE_CODE_MESSAGING_SOCKET = path
    return
  }

  if (server) {
    await new Promise<void>(resolve => server!.close(() => resolve()))
    server = null
  }

  await mkdir(dirname(path), { recursive: true })
  if (existsSync(path)) {
    await rm(path, { force: true })
  }

  server = net.createServer(socket => {
    let data = ''
    socket.setEncoding('utf8')
    socket.on('data', chunk => {
      data += chunk
    })
    socket.on('end', () => {
      const message = data.trim()
      if (!message) return
      enqueue({
        mode: 'prompt',
        value: wrapCrossSessionMessage(`uds:${path}`, message),
        uuid: randomUUID(),
        skipSlashCommands: true,
      })
      onEnqueue?.()
    })
  })

  await new Promise<void>((resolve, reject) => {
    server!.once('error', reject)
    server!.listen(path, () => {
      server!.off('error', reject)
      resolve()
    })
  })

  socketPath = path
  process.env.CLAUDE_CODE_MESSAGING_SOCKET = path

  const cleanup = async () => {
    const currentServer = server
    server = null
    if (currentServer) {
      await new Promise<void>(resolve => currentServer.close(() => resolve()))
    }
    if (socketPath) {
      await rm(socketPath, { force: true }).catch(() => {})
    }
  }

  process.once('exit', () => {
    if (socketPath) {
      try {
        require('fs').rmSync(socketPath, { force: true })
      } catch {}
    }
  })
  process.once('SIGTERM', () => {
    void cleanup()
  })
  process.once('SIGINT', () => {
    void cleanup()
  })
}

