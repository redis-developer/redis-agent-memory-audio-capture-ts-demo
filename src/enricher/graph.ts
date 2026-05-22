import { StateGraph, START, END } from '@langchain/langgraph'

import { textCorrector } from '@enricher/nodes/text-corrector.js'
import { callsignsExtractor } from '@enricher/nodes/callsigns-extractor.js'
import { frequenciesExtractor } from '@enricher/nodes/frequencies-extractor.js'
import { namedEntitiesExtractor } from '@enricher/nodes/named-entities-extractor.js'
import { EnrichmentStateAnnotation } from './state.js'

const builder = new StateGraph(EnrichmentStateAnnotation) as any

builder.addNode('text-corrector', textCorrector)
builder.addNode('entities-extractor', namedEntitiesExtractor)
builder.addNode('callsigns-extractor', callsignsExtractor)
builder.addNode('frequencies-extractor', frequenciesExtractor)

builder.addEdge(START, 'text-corrector')

/* fan out to extract values */
builder.addEdge('text-corrector', 'entities-extractor')
builder.addEdge('text-corrector', 'callsigns-extractor')
builder.addEdge('text-corrector', 'frequencies-extractor')

builder.addEdge('entities-extractor', END)
builder.addEdge('callsigns-extractor', END)
builder.addEdge('frequencies-extractor', END)

export const graph = builder.compile()
