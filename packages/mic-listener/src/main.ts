import { ingest } from './ingest/ingest.js'

process.on('SIGINT', () => {
  console.log('\nstopping')
  process.exit(0)
})

console.log('Earshot Mic Listener — Ctrl+C to stop\n')

try {
  await ingest()
} catch (err) {
  console.error('error:', (err as Error).message)
  process.exit(1)
}
