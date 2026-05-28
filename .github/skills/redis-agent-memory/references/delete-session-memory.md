# deleteSessionMemory

Deletes the session memory for a session.

## Signature

```ts
deleteSessionMemory(
  sessionId: string,
  options?: RequestOptions
): Promise<void>
```

## Example

```ts
await agentMemory.deleteSessionMemory(sessionId)
```

## Parameters

- **`sessionId`** *(required, string)* — the session to delete.

## Returns

`void`.

## Notes

- Deletes the entire session and all its events at once.
- Sessions normally disappear automatically when their TTL fires; use this for explicit cleanup or "forget this conversation" features.
- Does NOT delete long-term memories that were auto-promoted from this session. Use [bulkDeleteLongTermMemories](./bulk-delete-long-term-memories.md) for those.
