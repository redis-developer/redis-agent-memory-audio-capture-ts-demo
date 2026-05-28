# bulkCreateLongTermMemories

Creates long-term memories in bulk.

## Signature

```ts
bulkCreateLongTermMemories(
  request: BulkCreateLongTermMemoriesRequestContent,
  options?: RequestOptions
): Promise<BulkCreateLongTermMemoriesResponseContent>
```

## Example

```ts
import { ulid } from 'ulid'
import { MemoryType } from '@redis-iris/agent-memory/models'

const response = await agentMemory.bulkCreateLongTermMemories({
  memories: [
    {
      id: ulid(),
      text: 'On 2026-05-26T15:42:00Z, a receiver tuned to 14.250000 MHz USB heard: ...',
      memoryType: MemoryType.Episodic,
      ownerId: 'earshot-listener',
      sessionId: 'optional-link-back',
      namespace: 'optional-grouping',
      topics: ['optional', 'tags']
    }
  ]
})

console.log(`Created: ${response.created.length}, errors: ${response.errors?.length ?? 0}`)
```

## Request — `BulkCreateLongTermMemoriesRequestContent`

- **`memories`** *(required, Array<CreateMemoryRecord>)* — items to insert.

Each `CreateMemoryRecord`:

- **`id`** *(required, string)* — client-provided; idempotent on duplicate id.
- **`text`** *(required, string, 1-50000 chars)* — the memory content (prose, not JSON).
- **`memoryType`** *(optional, MemoryType)* — `Semantic | Episodic | Message`.
- **`sessionId`** *(optional, string, 1-64 chars, alphanumeric+dashes)* — link-back to a session.
- **`ownerId`** *(optional, string, 1-64 chars, alphanumeric+dashes)* — your owner discriminator.
- **`namespace`** *(optional, string, 1-64 chars, alphanumeric+dashes)* — logical grouping.
- **`topics`** *(optional, string[], max 50, each 1-100 chars)* — categorization tags.

## Returns — `BulkCreateLongTermMemoriesResponseContent`

- **`created`** *(string[])* — IDs successfully created (always returned; empty when none).
- **`errors`** *(optional, Array<BulkOperationError>)* — `{ id, error }` for items that failed.

## Notes

- **Partial success is possible** — the call doesn't throw on individual-record failure. Check `response.errors`.
- **`createdAt` / `updatedAt` are server-managed** — you cannot backfill the time an event actually happened. Put the meaningful timestamp into `text` so semantic search can match against it.
- **Prefer this over auto-promotion** when you care about `memoryType`, `namespace`, or `topics` — the auto-classifier mis-types and auto-promoted records arrive with empty `namespace` and `topics`.
- **`id` is idempotent on duplicate** — safe to retry. Use `ulid` (or any sortable id) so you can debug by id order.
- **`ownerId` is your discriminator** for who created the memory — there's no `actorId` / "memory creator" filter elsewhere.
- **`text` should be natural-language prose** — semantic search embeds it. JSON syntax embeds poorly.
