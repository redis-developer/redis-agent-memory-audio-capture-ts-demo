import { ChatOpenAI } from '@langchain/openai'
import OpenAI from 'openai'

import { config } from '@config/config'

let chatModel: ChatOpenAI | null = null
let speechToTextModel: OpenAI | null = null

export function fetchChatModel(): ChatOpenAI {
  const options = {
    model: 'gpt-4o-mini',
    temperature: 0,
    apiKey: config.openai.apiKey
  }

  if (!chatModel) chatModel = new ChatOpenAI(options)
  return chatModel
}

export function fetchSpeechToTextModel(): OpenAI {
  const options = {
    apiKey: config.openai.apiKey
  }

  if (!speechToTextModel) speechToTextModel = new OpenAI(options)
  return speechToTextModel
}
