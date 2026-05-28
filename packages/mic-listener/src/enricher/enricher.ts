import { type NamedEntities } from '@enricher/nodes/named-entities-extractor.js'
import { graph } from './graph.js'

export type { NamedEntities }

export type IncomingRecording = {
  text: string
  receivedAt: Date
}

export type EnrichedRecording = IncomingRecording & {
  correctedText: string
  entities: NamedEntities
}

export async function enrichRecording(input: IncomingRecording): Promise<EnrichedRecording> {
  const enrichedState = await graph.invoke({ text: input.text })
  return { ...input, ...enrichedState }
}
