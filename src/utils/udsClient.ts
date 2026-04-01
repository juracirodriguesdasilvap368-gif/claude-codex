import net from 'net'

export async function sendToUdsSocket(
  socketPath: string,
  message: string,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const socket = net.createConnection(socketPath)
    socket.setEncoding('utf8')
    socket.once('connect', () => {
      socket.end(message)
    })
    socket.once('error', reject)
    socket.once('close', hadError => {
      if (!hadError) resolve()
    })
  })
}

