import { StateGraph, START, END } from '@langchain/langgraph'

import { promptEnricher } from '@chatbot/nodes/prompt-enricher.js'
import { memoryUsingResponder } from '@chatbot/nodes/memory-using-responder.js'
import { sessionEventSaver } from '@chatbot/nodes/session-event-saver.js'
import { ChatbotStateAnnotation } from './state.js'

const builder = new StateGraph(ChatbotStateAnnotation) as any

builder.addNode('prompt-enricher', promptEnricher)
builder.addNode('memory-using-responder', memoryUsingResponder)
builder.addNode('session-event-saver', sessionEventSaver)

builder.addEdge(START, 'prompt-enricher')
builder.addEdge('prompt-enricher', 'memory-using-responder')
builder.addEdge('memory-using-responder', 'session-event-saver')
builder.addEdge('session-event-saver', END)

export const graph = builder.compile()
