import { MessageRole } from '@redis-iris/agent-memory/models'

import { agentMemory } from '@memory/client'
import type { ChatbotState } from '@chatbot/state'

export async function sessionEventSaver(state: ChatbotState): Promise<Partial<ChatbotState>> {
  const { sessionId, username, userMessage, responseMessage } = state
  const createdAt = new Date()

  await agentMemory.addSessionEvent({
    sessionId,
    actorId: username,
    role: MessageRole.User,
    content: [{ text: userMessage }],
    createdAt
  })

  await agentMemory.addSessionEvent({
    sessionId,
    actorId: 'earshot',
    role: MessageRole.Assistant,
    content: [{ text: responseMessage }],
    createdAt
  })

  return {}
}
