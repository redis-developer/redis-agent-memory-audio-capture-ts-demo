import { spawn, ChildProcess } from 'node:child_process'
import { Socket } from 'node:net'

/* Spawns rigctld and exposes a low-level line-protocol API over its TCP port.
   Callers explicitly send a command then read lines until they see the RPRT
   line. Transactions are serialized: send() waits its turn, and the lock
   releases when the caller reads an RPRT line via readLine(). Use the `+`
   prefix on commands so the response is RPRT-terminated. */
export class RigCtlD_Socket {
  #process: ChildProcess
  #socket: Socket
  #buffer = ''
  #lineQueue: string[] = []
  #pendingRead: ((line: string) => void) | null = null
  #chain: Promise<void> = Promise.resolve()
  #releaseChain: (() => void) | null = null

  private constructor(process: ChildProcess, socket: Socket) {
    this.#process = process
    this.#socket = socket
  }

  static async open(model: number, devicePath: string, baud: number, tcpPort = 4532): Promise<RigCtlD_Socket> {
    const proc = spawn('rigctld', ['-m', String(model), '-r', devicePath, '-s', String(baud), '-t', String(tcpPort)])
    const socket = await connectWithRetry(tcpPort)
    const sock = new RigCtlD_Socket(proc, socket)
    socket.on('data', (chunk: Buffer) => sock.#onData(chunk))
    return sock
  }

  async send(command: string): Promise<void> {
    const prev = this.#chain
    this.#chain = new Promise<void>(resolve => (this.#releaseChain = resolve))
    await prev
    this.#socket.write(`${command}\n`)
  }

  async readLine(): Promise<string> {
    const line = await this.#nextLine()
    if (line.startsWith('RPRT')) {
      const release = this.#releaseChain
      this.#releaseChain = null
      release?.()
    }
    return line
  }

  close(): void {
    this.#socket.end()
    this.#process.kill()
  }

  #nextLine(): Promise<string> {
    return new Promise(resolve => {
      const queued = this.#lineQueue.shift()
      if (queued !== undefined) {
        resolve(queued)
      } else {
        this.#pendingRead = resolve
      }
    })
  }

  #onData(chunk: Buffer): void {
    this.#buffer += chunk.toString('ascii')
    while (true) {
      const idx = this.#buffer.indexOf('\n')
      if (idx === -1) break
      const line = this.#buffer.slice(0, idx)
      this.#buffer = this.#buffer.slice(idx + 1)

      if (this.#pendingRead) {
        const resolve = this.#pendingRead
        this.#pendingRead = null
        resolve(line)
      } else {
        this.#lineQueue.push(line)
      }
    }
  }
}

async function connectWithRetry(port: number, timeoutMs = 5000): Promise<Socket> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      return await new Promise<Socket>((resolve, reject) => {
        const sock = new Socket()
        sock.once('error', reject)
        sock.connect(port, 'localhost', () => {
          sock.off('error', reject)
          resolve(sock)
        })
      })
    } catch {
      await new Promise(r => setTimeout(r, 100))
    }
  }
  throw new Error(`rigctld did not start listening on ${port} within ${timeoutMs}ms`)
}
