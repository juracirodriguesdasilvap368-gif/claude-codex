import { URL } from 'url'

export type ParsedConnectUrl = {
  serverUrl: string
  authToken?: string
}

function normalizeServerUrl(url: URL): string {
  if (url.protocol === 'cc:') {
    const protocol = ['localhost', '127.0.0.1', '::1'].includes(url.hostname)
        ? 'http:'
        : 'https:'
    const auth =
      url.username || url.password
        ? `${url.username}${url.password ? `:${url.password}` : ''}@`
        : ''
    const host = url.host
    const pathname = url.pathname === '/' ? '' : url.pathname
    return `${protocol}//${auth}${host}${pathname}`
  }

  if (url.protocol === 'cc+unix:') {
    const socketPath =
      decodeURIComponent(url.hostname + url.pathname).replace(/\/$/, '') ||
      decodeURIComponent(url.pathname)
    if (!socketPath) {
      throw new Error('Invalid cc+unix URL: missing socket path')
    }
    return `http+unix://${encodeURIComponent(socketPath)}`
  }

  throw new Error(`Unsupported connect URL scheme: ${url.protocol}`)
}

export function parseConnectUrl(raw: string): ParsedConnectUrl {
  let url: URL
  try {
    url = new URL(raw)
  } catch (error) {
    throw new Error(`Invalid connect URL: ${String(error)}`)
  }

  const authToken =
    url.searchParams.get('authToken') ??
    url.searchParams.get('token') ??
    url.searchParams.get('auth') ??
    undefined

  url.search = ''
  url.hash = ''

  return {
    serverUrl: normalizeServerUrl(url),
    authToken,
  }
}
