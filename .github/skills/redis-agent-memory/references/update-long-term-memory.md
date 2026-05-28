# updateLongTermMemory

Partially updates a long-term memory by its ID.

## Signature

```ts
updateLongTermMemory(
  memoryId: string,
  body?: UpdateLongTermMemoryRequestContent,
  options?: RequestOptions
): Promise<UpdateLongTermMemoryResponseContent>
```

## Example

```ts
const updated = await agentMemory.updateLongTermMemory(memoryId, {
  topics: ['signal-reports', '20m-band'],
  namespace: 'observed-receptions'
})
```

## Parameters

- **`memoryId`** *(required, string)* — the memory to update.
- **`body`** *(optional, UpdateLongTermMemoryRequestContent)* — fields to change. All sub-fields are optional; only provided fields are touched.

`UpdateLongTermMemoryRequestContent`:

- **`text`** *(optional, string, 1-50000 chars)*
- **`memoryType`** *(optional, MemoryType)*
- **`topics`** *(optional, string[], max 50, each 1-100 chars)*
- **`namespace`** *(optional, string, 1-64 chars, alphanumeric+dashes)* — send `""` to clear.
- **`ownerId`** *(optional, string, 1-64 chars, alphanumeric+dashes)* — send `""` to clear.
- **`sessionId`** *(optional, string, 1-64 chars, alphanumeric+dashes)* — send `""` to clear.

## Returns — `UpdateLongTermMemoryResponseContent`

Same shape as `MemoryRecord` (see [getLongTermMemory](./get-long-term-memory.md)). Reflects the post-update state.

## Notes

- **Partial update.** Omitted fields are NOT cleared. To clear `namespace` / `ownerId` / `sessionId`, send an empty string explicitly.
- **`createdAt` is never changed; `updatedAt` is bumped server-side.**
- **The vector embedding is regenerated** when `text` is updated — affects future search ranking.
