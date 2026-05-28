# health

Return information about the operational status of the service.

## Signature

```ts
health(options?: RequestOptions): Promise<HealthResponseContent>
```

## Example

```ts
const result = await agentMemory.health()
if (result.status === 'healthy') {
  // service is up
}
```

## Parameters

None.

## Returns — `HealthResponseContent`

- **`status`** *(HealthStatus)* — `'healthy'` is the only documented value.

## Notes

- Useful for startup probes / readiness checks. Throws on network errors or non-2xx responses.
