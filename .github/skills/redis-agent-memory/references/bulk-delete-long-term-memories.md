# bulkDeleteLongTermMemories

Deletes long-term memories in bulk by their IDs.

## Signature

```ts
bulkDeleteLongTermMemories(
  request: BulkDeleteLongTermMemoriesRequestContent,
  options?: RequestOptions
): Promise<BulkDeleteLongTermMemoriesResponseContent>
```

## Example

```ts
const response = await agentMemory.bulkDeleteLongTermMemories({
  memoryIds: ['01HXYZ...', '01HXYW...']
})

console.log(`Deleted: ${response.deleted.length}, errors: ${response.errors?.length ?? 0}`)
```

## Request — `BulkDeleteLongTermMemoriesRequestContent`

- **`memoryIds`** *(required, string[], 1-100 IDs)* — IDs to delete.

## Returns — `BulkDeleteLongTermMemoriesResponseContent`

- **`deleted`** *(string[])* — IDs successfully deleted (always returned).
- **`errors`** *(optional, Array<BulkOperationError>)* — `{ id, error }` for items that failed.

## Notes

- **Partial success is possible** — the call doesn't throw on individual-record failure. Check `response.errors`.
- **Limit: 1-100 IDs per call.** For larger deletions, chunk client-side.
