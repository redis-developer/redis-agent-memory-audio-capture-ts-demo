# Enrich the prompt with relevant memories

**Use this when you want to recall long-term memories to inject into a prompt before generating a reply.** Common cases: load known user preferences, load relevant domain facts, load past episodes related to the topic.

## Pre-fetch known facts about the user

```ts
import type { MemoryRecord } from '@redis-iris/agent-memory/models'

async function fetchUserPreferences(username: string): Promise<MemoryRecord[]> {
  const response = await agentMemory.searchLongTermMemory({
    text: 'The user has preferences, interests, opinions, and personal facts known about them.',
    limit: 5,
    filter: { ownerId: { eq: username } }
  })
  return response.items ?? []
}

function buildSystemPrompt(memories: MemoryRecord[]): string {
  if (memories.length === 0) return 'You are an assistant.'
  const facts = memories.map(m => `- ${m.text}`).join('\n')
  return `You are an assistant. Known facts about the user:\n${facts}`
}
```

## Recall by topic on demand (search as an agent tool)

Wrap recall as a callable function when you want the model itself to decide when to search.

```ts
async function searchMemories(query: string): Promise<string> {
  const response = await agentMemory.searchLongTermMemory({
    text: query,
    limit: 10,
    filter: { ownerId: { eq: 'app-producer-name' } }
  })
  const items = response.items ?? []
  if (items.length === 0) return 'No matches.'
  return items.map((item, i) => `${i + 1}. ${item.text}`).join('\n\n')
}
```

## Notes

- **Use a focused semantic query** — a topic, name, or term. Not the raw user message; the embedding gets diluted by chat boilerplate and recall quality drops.
- **Filter on `ownerId`** to scope recall to one user or one producer. There's no "memory creator" axis otherwise.
- **No recency boost** — search ranks by vector similarity only. For recency-weighted recall, sort client-side after the search returns.
- **`limit: 5-10` is a reasonable starting point.** More isn't always better; large recall sets dilute the prompt.
- **When exposed as a tool, instruct the model on query phrasing.** A model handed `searchMemories` with no guidance will pass the raw user message and get poor results.

Related references: [searchLongTermMemory](../references/search-long-term-memory.md).
