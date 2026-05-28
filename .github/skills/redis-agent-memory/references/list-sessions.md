# listSessions

Returns a paginated list of session IDs for a store.

## Signature

```ts
listSessions(
  limit?: number,
  pageToken?: string,
  options?: RequestOptions
): Promise<ListSessionsResponseContent>
```

## Example

```ts
const firstPage = await agentMemory.listSessions(50)
for (const sessionId of firstPage.items) {
  // ...
}

if (firstPage.nextPageToken) {
  const nextPage = await agentMemory.listSessions(50, firstPage.nextPageToken)
}
```

## Parameters

- **`limit`** *(optional, number)* — max sessions per page.
- **`pageToken`** *(optional, string)* — opaque token from a previous response.

## Returns — `ListSessionsResponseContent`

- **`items`** *(string[])* — session IDs (always returned; empty when none).
- **`total`** *(number)* — total matching sessions across all pages.
- **`nextPageToken`** *(optional, string)* — token to fetch the next page; omitted when no more results.

## Notes

- Returns session IDs only, not contents. Fetch each with [getSessionMemory](./get-session-memory.md) if you need the events.
- No filter parameters — returns sessions across the whole store.
