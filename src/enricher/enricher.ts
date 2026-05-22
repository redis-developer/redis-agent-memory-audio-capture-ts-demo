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
  const inputState = { text: input.text }

  const finalState = await graph.invoke(inputState)

  return {
    ...input,
    correctedText: finalState.correctedText,
    entities: finalState.entities,
    callsigns: finalState.callsigns,
    frequenciesMentioned: finalState.frequenciesMentioned
  }
}
