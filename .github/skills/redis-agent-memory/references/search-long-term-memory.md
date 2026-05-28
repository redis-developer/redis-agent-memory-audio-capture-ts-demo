# searchLongTermMemory

Runs a semantic search on long-term memory with filtering options.

## Signature

```ts
searchLongTermMemory(
  request?: SearchLongTermMemoryRequestContent,
  options?: RequestOptions
): Promise<SearchLongTermMemoryResponseContent>
```

## Example

```ts
const response = await agentMemory.searchLongTermMemory({
  text: 'user preferences',
  limit: 10,
  similarityThreshold: 0.5,
  filter: {
    ownerId: { eq: 'user-W8GUY' },
    memoryType: { in: ['semantic', 'episodic'] },
    createdAt: { gte: new Date('2026-01-01') }
  },
  filterOp: 'all'
})

for (const memory of response.items) {
  console.log(memory.text)
}
```

## Request — `SearchLongTermMemoryRequestContent`

All fields optional:

- **`text`** *(string)* — semantic query (embedded for vector search).
- **`similarityThreshold`** *(number, 0-1)* — minimum normalized cosine similarity.
- **`filter`** *(LongTermMemoryFilter)* — metadata predicates (see below).
- **`filterOp`** *(`'all'` | `'any'`)* — conjunction across filter fields. Pass explicitly when behavior matters.
- **`limit`** *(number, 1-100, default 10)* — max items returned.
- **`pageToken`** *(string)* — opaque token from a previous response for the next page.

### `LongTermMemoryFilter`

| Field | Filter type | Operators |
|---|---|---|
| `sessionId` | `SessionIdFilter` | `eq`, `ne`, `in`, `all` |
| `ownerId` | `OwnerIdFilter` | `eq`, `ne`, `in`, `all` |
| `namespace` | `NamespaceFilter` | `eq`, `ne`, `in`, `all` |
| `topics` | `TopicsFilter` | `eq`, `ne`, `in`, `all` |
| `memoryType` | `MemoryTypeFilter` | `eq`, `ne`, `in`, `all` |
| `createdAt` | `CreatedAtFilter` | `eq`, `gt`, `gte`, `lt`, `lte` |

Constraints:

- One operator per field per query.
- `all` is only meaningful for `topics` (match all listed tags).
- `gt`/`lt`/`gte`/`lte` only apply to `createdAt`.

## Returns — `SearchLongTermMemoryResponseContent`

- **`items`** *(MemoryRecord[])* — matching memories (always returned; empty when no matches).
- **`nextPageToken`** *(optional, string)* — token to fetch the next page; omitted when no more results.

## Notes

- **Vector-similarity ranking only.** No type-specific or recency boost. For recency weighting, sort client-side after the search returns.
- **Discriminate sources via `ownerId`** — there's no "memory creator" filter otherwise.
- **Use a focused semantic query** — a topic, name, or term, not the raw user message; semantic search degrades when the embedding is diluted by chat boilerplate.

Related examples: [enrich-context](../examples/enrich-context.md).
