import { MessagesAnnotation } from '@langchain/langgraph'

export const ChatbotStateAnnotation = MessagesAnnotation
export type ChatbotState = typeof ChatbotStateAnnotation.State
