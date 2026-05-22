import { listen } from '@capture/listen'
import { Rig } from '@rig/rig'
import { enrichTransmission, EnrichedTransmission } from '@enricher/enricher'

export async function ingest(rig: Rig): Promise<void> {
  for await (const transcript of listen(rig)) {
    const enriched = await enrichTransmission({
      text: transcript.text,
      receivedAt: transcript.capturedAt,
      frequency: transcript.frequency,
      mode: transcript.mode,
      band: transcript.band
    })
    printEnriched(enriched, transcript.audioPath)
  }
}

function printEnriched(enriched: EnrichedTransmission, audioPath: string): void {
  const frequency = enriched.frequency !== null ? `${(enriched.frequency / 1_000_000).toFixed(6)} MHz` : '—'
  const mode = enriched.mode ?? '—'
  const band = enriched.band ?? '—'
  const receivedAt = enriched.receivedAt.toISOString()

  console.log(`[${receivedAt}]`)
  console.log(`  frequency: ${frequency}`)
  console.log(`  mode:      ${mode}`)
  console.log(`  band:      ${band}`)
  console.log(`  audio:     ${audioPath}`)
  console.log(`  raw:       ${enriched.text}`)
  console.log(`  text:      ${enriched.correctedText}`)
  console.log(`  sender:    ${enriched.callsigns.sender ?? '—'}`)
  console.log(`  receiver:  ${enriched.callsigns.receiver ?? '—'}`)
  if (enriched.callsigns.mentioned.length > 0) {
    console.log(`  mentioned: ${enriched.callsigns.mentioned.join(', ')}`)
  }
  if (enriched.entities.people.length > 0) {
    console.log(`  people:    ${enriched.entities.people.join(', ')}`)
  }
  if (enriched.entities.places.length > 0) {
    console.log(`  places:    ${enriched.entities.places.join(', ')}`)
  }
  if (enriched.entities.organizations.length > 0) {
    console.log(`  orgs:      ${enriched.entities.organizations.join(', ')}`)
  }
  if (enriched.frequenciesMentioned.length > 0) {
    const list = enriched.frequenciesMentioned
      .map(mention =>
        mention.hz !== null ? `${mention.raw} (${(mention.hz / 1_000_000).toFixed(6)} MHz)` : mention.raw
      )
      .join(', ')
    console.log(`  freqs:     ${list}`)
  }
  console.log('')
}
