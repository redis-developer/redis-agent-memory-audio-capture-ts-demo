# deleteSessionEvent

Deletes a single event from a session by event ID.

## Signature

```ts
deleteSessionEvent(
  sessionId: string,
  eventId: string,
  options?: RequestOptions
): Promise<void>
```

## Example

```ts
await agentMemory.deleteSessionEvent(sessionId, eventId)
```

## Parameters

- **`sessionId`** *(required, string)* — the session.
- **`eventId`** *(required, string)* — the event to remove.

## Returns

`void`.

## Notes

- Removes a single event but leaves the rest of the session intact.
- Use sparingly — sessions are conceptually append-only conversation logs.
