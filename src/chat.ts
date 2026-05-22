import { HumanMessage } from '@langchain/core/messages'

import { Rig } from '@rig/rig'
import { buildChatbot } from '@chatbot/chatbot'

let chatbot: ReturnType<typeof buildChatbot> | null = null

export async function chat(rig: Rig, message: string): Promise<string> {
  if (chatbot === null) chatbot = buildChatbot(rig)
  const finalState = await chatbot.invoke({ messages: [new HumanMessage(message)] })
  const lastMessage = finalState.messages[finalState.messages.length - 1]
  const content = lastMessage?.content
  return typeof content === 'string' ? content : ''
}
