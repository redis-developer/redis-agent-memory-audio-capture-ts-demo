import { ChatOpenAI } from '@langchain/openai'

import { config } from '@config/config'

let chatModel: ChatOpenAI | null = null

export function fetchChatModel(): ChatOpenAI {
  const options = {
    model: 'gpt-4o-mini',
    temperature: 0,
    apiKey: config.openai.apiKey
  }

  if (!chatModel) chatModel = new ChatOpenAI(options)
  return chatModel
}
