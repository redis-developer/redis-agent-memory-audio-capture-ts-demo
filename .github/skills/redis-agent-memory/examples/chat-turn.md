# Run a full chat turn

**Use this when you want to handle one user turn end-to-end**: fetch prior context (session history + relevant long-term memories), call the model, and save both sides of the exchange.

There is no built-in "assemble context" op — fetch session history and long-term memory in parallel and compose client-side. This pattern combines the two halves you can also run separately: [enrich-context](./enrich-context.md) (recall side) and [store-chat-history](./store-chat-history.md) (save side).

```ts
import {
  MessageRole,
  type SessionEvent,
  type MemoryRecord
} from '@redis-iris/agent-memory/models'

async function handleTurn(sessionId: string, username: string, userMessage: string): Promise<string> {
  const [history, preferences] = await Promise.all([
    fetchSessionHistory(sessionId),
    fetchUserPreferences(username)
  ])

  const messages = composePrompt(history, preferences, userMessage)
  const replyText = await callModel(messages)

  await saveTurn(sessionId, username, userMessage, replyText)
  return replyText
}

async function fetchSessionHistory(sessionId: string): Promise<SessionEvent[]> {
  try {
    const response = await agentMemory.getSessionMemory(sessionId)
    return response.events
  } catch {
    return [] // 404 on first turn is expected
  }
}

async function fetchUserPreferences(username: string): Promise<MemoryRecord[]> {
  const response = await agentMemory.searchLongTermMemory({
    text: 'The user has preferences, interests, opinions, and personal facts known about them.',
    limit: 5,
    filter: { ownerId: { eq: username } }
  })
  return response.items ?? []
}

function composePrompt(history: SessionEvent[], preferences: MemoryRecord[], userMessage: string) {
  const facts = preferences.map(p => `- ${p.text}`).join('\n')
  const systemPrompt = `Known facts about the user:\n${facts}`

  return [
    { role: 'system', content: systemPrompt },
    ...history.map(e => ({ role: e.role, content: e.content.map(c => c.text).join('') })),
    { role: 'user', content: userMessage }
  ]
}

async function saveTurn(sessionId: string, username: string, userMessage: string, replyText: string): Promise<void> {
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
    actorId: 'app-assistant',
    role: MessageRole.Assistant,
    content: [{ text: replyText }],
    createdAt
  })
}
```

## Notes

- **Parallelize the two fetches.** Session history and long-term search are independent — don't await them sequentially.
- **First user event's `actorId` becomes the session's `ownerId`.** Passing `username` here gives you a stable per-user ownership without an explicit ownership call.
- **The assistant's `actorId` is your choice** — pick a stable producer name (e.g. `'app-assistant'`) so you can later distinguish assistant events from user events in the session.
- **The semantic query for preference recall** (`"The user has preferences, interests, opinions..."`) is intentionally generic — it pulls broad-spectrum facts about the user. Tune the wording to your domain.

Related references: [getSessionMemory](../references/get-session-memory.md), [searchLongTermMemory](../references/search-long-term-memory.md), [addSessionEvent](../references/add-session-event.md).
