import { StateGraph, START, END } from '@langchain/langgraph'

import { textCorrector } from '@enricher/nodes/text-corrector.js'
import { namedEntitiesExtractor } from '@enricher/nodes/named-entities-extractor.js'
import { EnrichmentStateAnnotation } from './state.js'

const builder = new StateGraph(EnrichmentStateAnnotation) as any

builder.addNode('text-corrector', textCorrector)
builder.addNode('entities-extractor', namedEntitiesExtractor)

builder.addEdge(START, 'text-corrector')
builder.addEdge('text-corrector', 'entities-extractor')
builder.addEdge('entities-extractor', END)

export const graph = builder.compile()
