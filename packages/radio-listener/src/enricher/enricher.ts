import { Band } from '@rig/bands'
import { Mode } from '@rig/modes'
import { type Callsigns } from '@enricher/nodes/callsigns-extractor.js'
import { type FrequencyMention } from '@enricher/nodes/frequencies-extractor.js'
import { type NamedEntities } from '@enricher/nodes/named-entities-extractor.js'
import { graph } from './graph.js'

export type { NamedEntities, Callsigns, FrequencyMention }

export type IncomingTransmission = {
  text: string
  receivedAt: Date
  frequency: number | null
  mode: Mode | null
  band: Band | null
}

export type EnrichedTransmission = IncomingTransmission & {
  correctedText: string
  entities: NamedEntities
  callsigns: Callsigns
  frequenciesMentioned: FrequencyMention[]
}

export async function enrichTransmission(input: IncomingTransmission): Promise<EnrichedTransmission> {
  const enrichedState = await graph.invoke({ text: input.text })
  return { ...input, ...enrichedState }
}
