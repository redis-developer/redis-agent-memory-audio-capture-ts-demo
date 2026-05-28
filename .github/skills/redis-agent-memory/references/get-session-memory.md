# getSessionMemory

Returns the session memory for a session.

## Signature

```ts
getSessionMemory(
  sessionId: string,
  options?: RequestOptions
): Promise<GetSessionMemoryResponseContent>
```

## Example

```ts
import type { SessionEvent } from '@redis-iris/agent-memory/models'

async function fetchSessionHistory(sessionId: string): Promise<SessionEvent[]> {
  try {
    const response = await agentMemory.getSessionMemory(sessionId)
    return response.events
  } catch {
    return [] // 404 on first turn is expected — treat as empty history
  }
}
```

## Parameters

- **`sessionId`** *(required, string)* — the session to fetch.

## Returns — `GetSessionMemoryResponseContent`

- **`sessionId`** *(string)* — echoed back.
- **`ownerId`** *(string)* — derived from the first event's `actorId`.
- **`events`** *(Array<SessionEvent>)* — ordered, append-only conversation events.

Each `SessionEvent`:

- **`eventId`** *(string)* — auto-generated.
- **`sessionId`** *(string)*
- **`actorId`** *(string)*
- **`role`** *(MessageRole)*
- **`content`** *(Array<Content>)* — `{ text: string }` parts.
- **`createdAt`** *(Date)* — client-supplied.
- **`systemTimestamp`** *(Date)* — server ingestion time.
- **`metadata`** *(optional, any)*

## Notes

- **404 on a new session is expected** — catch and treat as empty history.
- Events are append-only; nothing falls off until the session's TTL fires; the whole document disappears at once.
- No in-session compaction. For long-lived sessions, cap client-side before composing prompts.

Related examples: [enrich-context](../examples/enrich-context.md), [chat-turn](../examples/chat-turn.md).
