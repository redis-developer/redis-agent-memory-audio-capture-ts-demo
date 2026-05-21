import { listen, Transcript } from './capture/listen.js'
import { Rig } from './rig/rig.js'

const rig = await Rig.connect()

process.on('SIGINT', () => {
  console.log('\nstopping')
  rig.close()
  process.exit(0)
})

console.log('listening — Ctrl+C to stop\n')

try {
  for await (const transcript of listen(rig)) {
    printTranscript(transcript)
  }
} catch (err) {
  console.error('error:', (err as Error).message)
  process.exit(1)
}

function printTranscript(transcript: Transcript): void {
  const frequency =
    transcript.frequency !== null ? `${(transcript.frequency / 1_000_000).toFixed(6)} MHz` : '—'
  const mode = transcript.mode ?? '—'
  const band = transcript.band ?? '—'
  const capturedAt = transcript.capturedAt.toISOString()

  console.log(`[${capturedAt}]`)
  console.log(`  frequency: ${frequency}`)
  console.log(`  mode:      ${mode}`)
  console.log(`  band:      ${band}`)
  console.log(`  audio:     ${transcript.audioPath}`)
  console.log(`  text:      ${transcript.text}`)
  console.log('')
}
