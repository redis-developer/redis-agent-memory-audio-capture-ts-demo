import { Annotation } from '@langchain/langgraph'
import type { Callsigns } from '@enricher/nodes/callsigns-extractor'
import type { FrequencyMention } from '@enricher/nodes/frequencies-extractor'
import type { NamedEntities } from '@enricher/nodes/named-entities-extractor'

export const EnrichmentStateAnnotation = Annotation.Root({
  text: Annotation<string>,
  correctedText: Annotation<string>,
  entities: Annotation<NamedEntities>,
  callsigns: Annotation<Callsigns>,
  frequenciesMentioned: Annotation<FrequencyMention[]>
})

export type EnrichmentState = typeof EnrichmentStateAnnotation.State
