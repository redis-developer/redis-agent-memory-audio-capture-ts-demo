import dedent from 'dedent'

import { EnrichedRecording } from '@enricher/enricher'

export function formatRecording(enriched: EnrichedRecording): string {
  const timestamp = enriched.receivedAt.toISOString()

  return dedent`
    On ${timestamp}, a microphone heard:
    "${enriched.correctedText}".

    ${formatDetails(enriched).join('\n')}
  `
}

function formatDetails(enriched: EnrichedRecording): string[] {
  const details: string[] = []

  if (enriched.entities.people.length > 0) details.push(`People mentioned: ${enriched.entities.people.join(', ')}.`)
  if (enriched.entities.places.length > 0) details.push(`Places mentioned: ${enriched.entities.places.join(', ')}.`)
  if (enriched.entities.organizations.length > 0)
    details.push(`Organizations mentioned: ${enriched.entities.organizations.join(', ')}.`)

  return details
}
