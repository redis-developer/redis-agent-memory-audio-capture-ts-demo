import { Annotation } from '@langchain/langgraph'
import type { NamedEntities } from '@enricher/nodes/named-entities-extractor'

export const EnrichmentStateAnnotation = Annotation.Root({
  text: Annotation<string>,
  correctedText: Annotation<string>,
  entities: Annotation<NamedEntities>
})

export type EnrichmentState = typeof EnrichmentStateAnnotation.State
