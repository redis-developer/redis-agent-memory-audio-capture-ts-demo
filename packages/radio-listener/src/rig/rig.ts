import { config } from '@config/config'

import { Band, bandFor } from './bands.js'
import { Mode } from './modes.js'
import { RigCtlD_Socket } from './rigctld-socket.js'

export { Band } from './bands.js'
export { Mode } from './modes.js'

const POLL_INTERVAL_MS = 100

export class Rig {
  static #instance: Rig | null = null

  #frequency: number | null = null
  #mode: Mode | null = null
  #band: Band | null = null

  #socket: RigCtlD_Socket

  #pollTimer: NodeJS.Timeout

  private constructor(socket: RigCtlD_Socket) {
    this.#socket = socket
    this.#pollTimer = setInterval(() => this.#poll(), POLL_INTERVAL_MS)
  }

  static async connect(): Promise<Rig> {
    if (Rig.#instance !== null) return Rig.#instance

    const { model, port, baud } = config.rig
    if (!model) throw new Error('RIG_MODEL is not set in .env')
    if (!port) throw new Error('RIG_PORT is not set in .env')
    if (!baud) throw new Error('RIG_BAUD is not set in .env')

    const socket = await RigCtlD_Socket.open(model, port, baud)
    Rig.#instance = new Rig(socket)
    return Rig.#instance
  }

  static get instance(): Rig {
    if (Rig.#instance === null) throw new Error('Rig not connected — call Rig.connect() first')
    return Rig.#instance
  }

  close(): void {
    clearInterval(this.#pollTimer)
    this.#socket.close()
    Rig.#instance = null
  }

  get frequency(): number | null {
    return this.#frequency
  }

  set frequency(frequency: number) {
    void this.#setFrequency(frequency)
  }

  get mode(): Mode | null {
    return this.#mode
  }

  set mode(mode: Mode) {
    void this.#setMode(mode)
  }

  get band(): Band | null {
    return this.#band
  }

  async #poll(): Promise<void> {
    try {
      await this.#queryFrequency()
      await this.#queryMode()
    } catch (err) {
      console.error('poll error:', err)
    }
  }

  async #queryFrequency(): Promise<void> {
    /* Send the request */
    await this.#socket.send('+f')

    /* Read each line until we get the return */
    let value: string | undefined
    while (true) {
      const line = await this.#socket.readLine()
      if (line.startsWith('RPRT')) break
      if (line.startsWith('Frequency:')) value = line.split(':')[1]?.trim()
    }

    /* Then update */
    if (value === undefined) return
    const frequency = Number(value)
    if (!Number.isFinite(frequency)) return
    this.#frequency = frequency
    this.#band = bandFor(frequency)
  }

  async #queryMode(): Promise<void> {
    /* Send the request */
    await this.#socket.send('+m')

    /* Read each line until we get the return */
    let value: string | undefined
    while (true) {
      const line = await this.#socket.readLine()
      if (line.startsWith('RPRT')) break
      if (line.startsWith('Mode:')) value = line.split(':')[1]?.trim()
    }

    /* Then update */
    if (value === undefined) return
    this.#mode = value as Mode
  }

  async #setFrequency(frequency: number): Promise<void> {
    try {
      /* Send the request */
      await this.#socket.send(`+F ${frequency}`)

      /* Read each line until we get the return */
      while (!(await this.#socket.readLine()).startsWith('RPRT'));
    } catch (err) {
      console.error('set frequency failed:', err)
    }
  }

  async #setMode(mode: Mode): Promise<void> {
    try {
      /* Send the request */
      await this.#socket.send(`+M ${mode} 0`)

      /* Read each line until we get the return */
      while (!(await this.#socket.readLine()).startsWith('RPRT'));
    } catch (err) {
      console.error('set mode failed:', err)
    }
  }
}
