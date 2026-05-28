# Store chat history

**Use this when you've finished one user/assistant exchange and want to persist both turns to session memory.** Typically called after the model returns a reply.

```ts
import { MessageRole } from '@redis-iris/agent-memory/models'

async function saveTurn(
  sessionId: string,
  username: string,
  userMessage: string,
  replyText: string
): Promise<void> {
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

- **First user event's `actorId` becomes the session's `ownerId` permanently.** Passing the user's stable id gives you per-user ownership without an explicit ownership call.
- **The assistant's `actorId` is your choice** — pick a stable producer name (e.g. `'app-assistant'`) so you can later distinguish assistant events from user events.
- **Don't persist tool calls or other agent internals as session events.** The role enum is `User | Assistant | System` only — session memory captures conversation I/O, not reasoning steps.
- **Stamp both events with the same `createdAt`** if you want them to clearly bracket "one exchange" — `systemTimestamp` will differ but `createdAt` reflects your intent.
- **Order isn't preserved by `createdAt` alone** — events are returned in insertion order. If you need ordering across actors, send them in the intended sequence (user first, then assistant) or rely on `systemTimestamp` server-side.

Related references: [addSessionEvent](../references/add-session-event.md).
