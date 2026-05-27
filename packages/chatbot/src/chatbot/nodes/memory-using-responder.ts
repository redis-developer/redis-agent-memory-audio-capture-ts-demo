import dedent from 'dedent'
import { createAgent } from 'langchain'

import { ChatbotState } from '@chatbot/state'
import { fetchChatModel } from '@models/models'
import { searchTranscripts } from '@chatbot/tools/search-transcripts'

const SYSTEM_PROMPT = dedent`
  You are Earshot, a conversational assistant that helps the user recall
  what has been heard from audio sources by listener agents. Each stored
  memory is a prose description of one utterance, with whatever metadata
  the listener captured (time, source-specific details, who or what was
  mentioned).

  You have one tool:
  - searchTranscripts: semantic search over utterances previously heard
    and stored as long-term memory. Use this when the user asks about
    anything heard from the audio — who said what, when something happened,
    what topics came up, references to specific people, places, or terms.
    Pass a focused query string, not the user's raw message.

  Be brief.
`

const model = fetchChatModel()
const tools = [searchTranscripts]
const agent = createAgent({ model, tools, systemPrompt: SYSTEM_PROMPT })

export async function memoryUsingResponder(state: ChatbotState): Promise<Partial<ChatbotState>> {
  const result = await agent.invoke({ messages: state.promptMessages })
  const finalMessage = result.messages[result.messages.length - 1]
  const responseMessage = typeof finalMessage.content === 'string' ? finalMessage.content : ''
  return { responseMessage }
}
