# getSessionEvent

Returns a single event from a session by event ID.

## Signature

```ts
getSessionEvent(
  sessionId: string,
  eventId: string,
  options?: RequestOptions
): Promise<GetSessionEventResponseContent>
```

## Example

```ts
const response = await agentMemory.getSessionEvent(sessionId, eventId)
console.log(response.event.content, response.event.createdAt)
```

## Parameters

- **`sessionId`** *(required, string)* — the session.
- **`eventId`** *(required, string)* — the auto-generated event ID returned from `addSessionEvent`.

## Returns — `GetSessionEventResponseContent`

- **`event`** *(SessionEvent)* — the requested event (see [getSessionMemory](./get-session-memory.md) for the `SessionEvent` shape).

## Notes

- Useful when you've kept the `eventId` from a prior `addSessionEvent` and want to retrieve just that one turn. Most flows use `getSessionMemory` to fetch the whole session instead.
- Throws if the event doesn't exist.
