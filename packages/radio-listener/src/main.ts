import { Rig } from '@rig/rig'

import { ingest } from './ingest/ingest.js'

await Rig.connect()

process.on('SIGINT', () => {
  console.log('\nstopping')
  Rig.instance.close()
  process.exit(0)
})

console.log('Earshot Radio Listener — Ctrl+C to stop\n')

try {
  await ingest()
} catch (err) {
  console.error('error:', (err as Error).message)
  Rig.instance.close()
  process.exit(1)
}
