import dedent from 'dedent'
import { tool } from '@langchain/core/tools'
import { z } from 'zod'

import { agentMemory } from '@memory/client'
import { config } from '@config/config'

const schema = z.object({
  query: z.string().describe('Focused semantic search query — topic, name, term mentioned, etc. Not the raw user message.')
})

type Args = z.infer<typeof schema>

async function impl(args: Args) {
  try {
    const response = await agentMemory.searchLongTermMemory({
      text: args.query,
      limit: 10,
      filter: {
        ownerId: { eq: config.listenerOwnerId }
      }
    })
    const items = response.items ?? []
    if (items.length === 0) return 'No matching transcripts found.'
    return items.map((item, index) => `${index + 1}. ${item.text}`).join('\n\n')
  } catch (err) {
    return `searchTranscripts failed: ${(err as Error).message}`
  }
}

const params = {
  name: 'searchTranscripts',
  description: dedent`
      Semantic search over transmissions previously heard by listener agents.
      Returns up to 10 best matches as prose memories. Use when the user asks
      about anything that may have been heard.`,
  schema: schema
}

export const searchTranscripts = tool(impl, params)
