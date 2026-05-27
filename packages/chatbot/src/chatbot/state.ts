import { Annotation } from '@langchain/langgraph'
import type { BaseMessage } from '@langchain/core/messages'

export const ChatbotStateAnnotation = Annotation.Root({
  sessionId: Annotation<string>(),
  username: Annotation<string>(),
  userMessage: Annotation<string>(),
  promptMessages: Annotation<BaseMessage[]>(),
  responseMessage: Annotation<string>()
})

export type ChatbotState = typeof ChatbotStateAnnotation.State
