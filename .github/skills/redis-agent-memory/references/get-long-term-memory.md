# getLongTermMemory

Returns a long-term memory by its ID.

## Signature

```ts
getLongTermMemory(
  memoryId: string,
  options?: RequestOptions
): Promise<GetLongTermMemoryResponseContent>
```

## Example

```ts
const memory = await agentMemory.getLongTermMemory(memoryId)
console.log(memory.text, memory.createdAt)
```

## Parameters

- **`memoryId`** *(required, string)* — the ID returned from `bulkCreateLongTermMemories`.

## Returns — `GetLongTermMemoryResponseContent`

Same shape as `MemoryRecord`:

- **`id`** *(string)*
- **`text`** *(string)*
- **`memoryType`** *(optional, MemoryType)*
- **`sessionId`** *(optional, string)*
- **`ownerId`** *(optional, string)*
- **`namespace`** *(optional, string)*
- **`topics`** *(optional, string[])*
- **`createdAt`** *(Date)* — server-set at insertion.
- **`updatedAt`** *(Date)* — server-set on each update.

## Notes

- Use when you already know the memory ID. For discovery, use [searchLongTermMemory](./search-long-term-memory.md).
- Throws if the memory doesn't exist.
