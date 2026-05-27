import dedent from 'dedent'
import { HumanMessage, AIMessage, SystemMessage, type BaseMessage } from '@langchain/core/messages'
import { MessageRole, type SessionEvent, type MemoryRecord } from '@redis-iris/agent-memory/models'

import { agentMemory } from '@memory/client'
import type { ChatbotState } from '@chatbot/state'

const PREFERENCE_FETCH_LIMIT = 5
const PREFERENCE_SEARCH_QUERY = 'The user has preferences, interests, opinions, and personal facts known about them.'

export async function promptEnricher(state: ChatbotState): Promise<Partial<ChatbotState>> {
  const { sessionId, username, userMessage } = state

  const [preferenceMessage, historyMessages] = await Promise.all([
    fetchUserPreferenceMessage(username),
    fetchMessageHistory(sessionId)
  ])

  const promptMessages: BaseMessage[] = []

  if (preferenceMessage !== null) promptMessages.push(preferenceMessage)
  promptMessages.push(...historyMessages, new HumanMessage(userMessage))

  return { promptMessages }
}

async function fetchUserPreferenceMessage(username: string): Promise<SystemMessage | null> {
  let memories: MemoryRecord[] = []

  try {
    const response = await agentMemory.searchLongTermMemory({
      text: PREFERENCE_SEARCH_QUERY,
      limit: PREFERENCE_FETCH_LIMIT,
      filter: {
        ownerId: { eq: username }
      }
    })
    memories = response.items ?? []
  } catch (err) {
    console.error('preference recall failed:', err)
  }

  if (memories.length === 0) return null

  const preferences = memories.map(memory => `- ${memory.text}`).join('\n')

  return new SystemMessage(dedent`
    Known facts and preferences about the user:
    ${preferences}
  `)
}

async function fetchMessageHistory(sessionId: string): Promise<BaseMessage[]> {
  let events: SessionEvent[] = []

  try {
    const response = await agentMemory.getSessionMemory(sessionId)
    events = response.events
  } catch {
    /* A 404 on the first turn of a session is expected — treat as empty history. */
  }

  const messages: BaseMessage[] = events.map(event => {
    const text = event.content.map(part => part.text).join('')
    if (event.role === MessageRole.User) return new HumanMessage(text)
    if (event.role === MessageRole.Assistant) return new AIMessage(text)
    return new SystemMessage(text)
  })

  return messages
}
