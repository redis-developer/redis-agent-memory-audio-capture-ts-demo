import { createInterface } from 'node:readline/promises'

import { Rig } from '@rig/rig'

import { chat } from './chat.js'

const rig = await Rig.connect()

process.on('SIGINT', () => {
  console.log('\nstopping')
  rig.close()
  process.exit(0)
})

const repl = createInterface({ input: process.stdin, output: process.stdout })

console.log('ham-buddy chat — Ctrl+C to stop\n')

try {
  while (true) {
    const message = (await repl.question('> ')).trim()
    if (message === '') continue
    const reply = await chat(rig, message)
    console.log(reply + '\n')
  }
} catch (err) {
  console.error('error:', (err as Error).message)
  rig.close()
  process.exit(1)
}
