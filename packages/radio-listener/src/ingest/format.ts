import dedent from 'dedent'

import { EnrichedTransmission, FrequencyMention } from '@enricher/enricher'

export function formatTransmission(enriched: EnrichedTransmission): string {
  const mode = enriched.mode ?? 'unknown mode'
  const band = enriched.band ?? 'unknown band'
  const frequency = enriched.frequency === null ? 'unknown frequency' : formatFrequency(enriched.frequency)
  const timestamp = enriched.receivedAt.toISOString()

  return dedent`
    On ${timestamp}, a receiver tuned to ${frequency} ${mode} (${band}) heard:
    "${enriched.correctedText}".

    ${formatDetails(enriched).join('\n')}
  `
}

function formatDetails(enriched: EnrichedTransmission): string[] {
  const details: string[] = []

  if (enriched.callsigns.sender) details.push(`Sender callsign: ${enriched.callsigns.sender}.`)
  if (enriched.callsigns.receiver) details.push(`Receiver callsign: ${enriched.callsigns.receiver}.`)
  if (enriched.callsigns.mentioned.length > 0)
    details.push(`Other callsigns mentioned: ${enriched.callsigns.mentioned.join(', ')}.`)

  if (enriched.entities.people.length > 0) details.push(`People mentioned: ${enriched.entities.people.join(', ')}.`)
  if (enriched.entities.places.length > 0) details.push(`Places mentioned: ${enriched.entities.places.join(', ')}.`)
  if (enriched.entities.organizations.length > 0)
    details.push(`Organizations mentioned: ${enriched.entities.organizations.join(', ')}.`)

  if (enriched.frequenciesMentioned.length > 0) {
    const freqList = enriched.frequenciesMentioned.map(mention => formatFrequencyMention(mention)).join(', ')
    details.push(`Frequencies referenced in the transmission: ${freqList}.`)
  }

  return details
}

function formatFrequencyMention(mention: FrequencyMention): string {
  if (mention.hz === null) return mention.raw
  return formatFrequency(mention.hz)
}

function formatFrequency(hz: number): string {
  return `${(hz / 1_000_000).toFixed(6)} MHz`
}
