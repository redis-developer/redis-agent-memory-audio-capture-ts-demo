# addSessionEvent

Appends a single event to a session. Creates the session if it doesn't exist. If `sessionId` is omitted, the server generates one.

## Signature

```ts
addSessionEvent(
  request: AddSessionEventRequestContent,
  options?: RequestOptions
): Promise<AddSessionEventResponseContent>
```

## Example

```ts
import { MessageRole } from '@redis-iris/agent-memory/models'

const result = await agentMemory.addSessionEvent({
  sessionId,
  actorId: 'user-W8GUY',
  role: MessageRole.User,
  content: [{ text: userMessage }],
  createdAt: new Date(),
  metadata: { client: 'cli-repl' }
})

console.log(result.event.eventId)
```

## Request — `AddSessionEventRequestContent`

- **`sessionId`** *(optional, string)* — server generates one if omitted.
- **`actorId`** *(required, string, 1-255 chars)* — the actor producing this event. First event's `actorId` permanently becomes the session's `ownerId`.
- **`role`** *(required, MessageRole)* — `User | Assistant | System`. Closed enum; no `Tool`.
- **`content`** *(required, Array<Content>)* — array of `{ text: string }` parts.
- **`createdAt`** *(required, Date)* — client-supplied timestamp for when the event happened (UTC).
- **`metadata`** *(optional, any)* — free-form JSON.

## Returns — `AddSessionEventResponseContent`

- **`event`** *(SessionEvent)* — the persisted event, including server-generated `eventId` and `systemTimestamp`.

## Notes

- First event's `actorId` permanently becomes the session's `ownerId`.
- `actorId` is NOT filterable on any read operation.
- `metadata` does NOT propagate to auto-promoted long-term memories.
- Session memory captures conversation I/O only — `role` deliberately omits `Tool`. Don't try to log agent internals here.

Related examples: [store-chat-history](../examples/store-chat-history.md), [chat-turn](../examples/chat-turn.md).
