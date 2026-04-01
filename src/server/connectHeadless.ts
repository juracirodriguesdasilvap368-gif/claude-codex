import type { ContentBlockParam } from '@anthropic-ai/sdk/resources/index.mjs'
import type { DirectConnectConfig } from './directConnectManager.js'
import { DirectConnectSessionManager } from './directConnectManager.js'

function extractText(content: string | ContentBlockParam[] | unknown): string {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  return content
    .filter(
      (block): block is ContentBlockParam & { type: 'text'; text: string } =>
        typeof block === 'object' &&
        block !== null &&
        'type' in block &&
        block.type === 'text' &&
        'text' in block &&
        typeof block.text === 'string',
    )
    .map(block => block.text)
    .join('')
}

export async function runConnectHeadless(
  config: DirectConnectConfig,
  prompt: string,
  outputFormat: string,
  interactive = false,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    let settled = false
    let lastPayload: unknown = null

    const manager = new DirectConnectSessionManager(config, {
      onConnected: () => {
        if (prompt) {
          manager.sendMessage(prompt)
          if (interactive) {
            process.stdin.setEncoding('utf8')
            process.stdin.on('data', chunk => {
              const text = chunk.trim()
              if (text) manager.sendMessage(text)
            })
          }
        } else if (!interactive) {
          settled = true
          manager.disconnect()
          resolve()
        }
      },
      onPermissionRequest: (request, requestId) => {
        manager.respondToPermissionRequest(requestId, {
          behavior: 'deny',
          message: `Headless mode denied tool request for ${request.tool_name}`,
        })
      },
      onMessage: message => {
        lastPayload = message
        if (outputFormat === 'stream-json') {
          process.stdout.write(`${JSON.stringify(message)}\n`)
          return
        }
        if (message.type === 'assistant') {
          const text = extractText(message.message?.content)
          if (outputFormat === 'json') {
            process.stdout.write(`${JSON.stringify({ text, message })}\n`)
          } else if (text) {
            process.stdout.write(`${text}\n`)
          }
        } else if (outputFormat === 'json') {
          process.stdout.write(`${JSON.stringify(message)}\n`)
        }
        if (
          !interactive &&
          (message.type === 'result' ||
            (message.type === 'system' && message.subtype === 'result'))
        ) {
          settled = true
          manager.disconnect()
          resolve()
        }
      },
      onDisconnected: () => {
        if (!settled) resolve()
      },
      onError: error => {
        if (!settled) reject(error)
      },
    })

    manager.connect()

    if (!interactive && prompt) {
      setTimeout(() => {
        if (!settled && lastPayload !== null) {
          settled = true
          manager.disconnect()
          resolve()
        }
      }, 5000)
    }
  })
}

