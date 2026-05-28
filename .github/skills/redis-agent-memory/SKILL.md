---
name: redis-agent-memory
description: Build and debug TypeScript code using the @redis-iris/agent-memory SDK for the Redis Cloud Agent Memory service (two-tier session + long-term memory with async auto-promotion). Trigger when code imports @redis-iris/agent-memory or references AgentMemory / SessionEvent / MemoryRecord, or when the user discusses session memory, long-term memory, or memory promotion in a Redis context.
---

# Redis Agent Memory (TypeScript)

Smart docs for the **Redis Cloud Agent Memory** service via the official Speakeasy-generated TypeScript SDK `@redis-iris/agent-memory`. Combines official docs, SDK type definitions, and empirical observations.

**Scope note:** This skill covers the **Redis Cloud** service. There is also an open-source `redis/agent-memory-server` repo on GitHub. The two have diverged — **do not read the OSS source to infer cloud behavior.** Stick to the cloud docs, the SDK's `.d.ts` files, and direct empirical probing.

## TL;DR

- **Two tiers:** session memory (TTL'd, append-only JSON doc per session) and long-term memory (vector-embedded records, semantically searchable).
- **Auto-promotion is async, slow, and opaque** — extracted records arrive with empty `namespace`/`topics` and an unreliable `memoryType`. For controlled metadata, write explicit `bulkCreateLongTermMemories`.
- **Always import types from `@redis-iris/agent-memory/models`** — never inline structural shapes.
- **`actorId` (on events) ≠ `ownerId` (on records).** The first event's `actorId` permanently becomes the session's `ownerId`; only `ownerId` is filterable.
- Service is **preview** — pin the SDK version exactly (no caret).

## When to invoke

- Code imports `@redis-iris/agent-memory` or references `AgentMemory`, `SessionEvent`, `MemoryRecord`, `MessageRole`, `MemoryType`, or filter types from that package.
- The user is discussing session memory, long-term memory, auto-promotion, or memory recall in a Redis context.
- The user is choosing between session events vs explicit long-term writes.

## Setup

```bash
npm install @redis-iris/agent-memory
```

```ts
import { AgentMemory } from '@redis-iris/agent-memory'

export const agentMemory = new AgentMemory({
  serverURL: process.env.AGENT_MEMORY_SERVER_URL,
  storeId: process.env.AGENT_MEMORY_STORE_ID,
  apiKey: process.env.AGENT_MEMORY_API_KEY
})
```

The SDK auto-reads `AGENT_MEMORY_API_KEY` and `AGENT_MEMORY_STORE_ID` from env if you omit them — the example above passes them explicitly so the call site reads clearly. `serverURL` has **no** env fallback; it must be passed. REST auth is `Authorization: Bearer <API_KEY>` — the SDK injects the header for you.

## Types — always import, never inline

**Rule:** whenever your code touches an SDK shape, import its type from `@redis-iris/agent-memory/models`. Never define a structural shape inline.

Why:

- The SDK is the source of truth — no drift when the schema changes.
- It telegraphs SDK use at the read/write site.
- The IDE autocompletes additional fields you might want (`createdAt`, `systemTimestamp`, …).

### Closed enums (complete values)

`MessageRole` and `MemoryType` are `ClosedEnum` — the full set of values:

```ts
MessageRole = { User: "USER", Assistant: "ASSISTANT", System: "SYSTEM" }
MemoryType  = { Semantic: "semantic", Episodic: "episodic", Message: "message" }
```

`MessageRole` is intentionally limited to conversation I/O — see Session memory for what that means in practice.

## Session memory

Ordered conversation events with a TTL. Use for live chat turns. A session is a single Redis JSON document — events are append-only and the whole document disappears when its TTL fires.

**Scope:** session memory stores the *conversation* — what the user said and what the agent said back. Tool calls and other internal agent steps are implementation detail and don't belong here; that's why the role enum is `USER | ASSISTANT | SYSTEM` only. If you need an audit trail of tool invocations, log it separately.

Common tasks (see [Examples & References](#examples--references) for the full method reference):

- **Append a chat turn** → [examples/store-chat-history](./examples/store-chat-history.md)
- **Read session history** → [references/getSessionMemory](./references/get-session-memory.md)
- **Run a full chat turn** (fetch context, call model, save both sides) → [examples/chat-turn](./examples/chat-turn.md)

## Long-term memory

Vector-embedded records with rich metadata. Memories are individually stored as Redis Hashes; search runs cosine-similarity over their embeddings with optional metadata filtering.

Common tasks (see [Examples & References](#examples--references) for the full method reference):

- **Save a memory** (store facts/episodes in bulk) → [references/bulkCreateLongTermMemories](./references/bulk-create-long-term-memories.md)
- **Search memories** (semantic search with filters) → [references/searchLongTermMemory](./references/search-long-term-memory.md)
- **Enrich a prompt** with recalled memories → [examples/enrich-context](./examples/enrich-context.md)

### Filter reference

| Filter       | Type     | Operators                      |
| ------------ | -------- | ------------------------------ |
| `sessionId`  | string   | `eq`, `ne`, `in`, `all`        |
| `ownerId`    | string   | `eq`, `ne`, `in`, `all`        |
| `namespace`  | string   | `eq`, `ne`, `in`, `all`        |
| `topics`     | string   | `eq`, `ne`, `in`, `all`        |
| `memoryType` | string   | `eq`, `ne`, `in`, `all`        |
| `createdAt`  | ISO 8601 | `eq`, `gt`, `lt`, `gte`, `lte` |

- `all` only meaningful for `topics`; `gt`/`lt`/`gte`/`lte` only for `createdAt`.
- One operator per field per query.
- Memory types and `createdAt` are filter-only — no type-specific or recency ranking. For recency weighting, rank client-side after the search returns.

### Memory types

Three types; names align with standard agent-memory terminology:

- **`Message`** — raw chat history, turns preserved verbatim.
- **`Episodic`** — what happened, when (timestamped).
- **`Semantic`** — a fact or piece of knowledge, time/context stripped.

The auto-classifier mis-types (see gotchas). Set the type explicitly when downstream behavior depends on it.

## Ownership model — `actorId` vs `ownerId`

Easy to confuse.

- **`actorId`** lives on **session events**. Identifies _who/what produced this event_ — free-form 1-255 char string. The first event's `actorId` becomes the session's `ownerId`; afterward it's stored-and-returned metadata not used by any read or filter op.
- **`ownerId`** lives on **sessions and long-term memory records**. Identifies _who owns the record_. Filterable on long-term memory search (`eq`, `ne`, `in`, `all`).

Patterns:

- **Per-user chatbot:** pass the user's stable id (callsign, internal user id) as `actorId` on user events; it implicitly becomes `ownerId` via the first-event rule. Set the same id as `ownerId` on long-term memories about the user.
- **Multiple producer roles** sharing one store: give each role its own `ownerId` (e.g. `'app-listener'`, `'app-curator'`) and filter by it to slice memories by source.

## Gotchas

All empirical claims tested 2026-05 against the preview service — re-verify before relying.

**Session memory**

- **First event's `actorId` becomes the session's `ownerId` permanently** — surfaced by `GetSessionMemoryResponseContent.ownerId` JSDoc; the REST docs don't spell it out.
- **`actorId` is NOT filterable.** No `actorIdFilter` type; no read endpoint accepts an `actorId` predicate. Stored-and-returned but not a query axis.
- **`createdAt` (client-supplied) vs `systemTimestamp` (server ingestion) can differ.** Use `createdAt` for "when the event happened."
- **No in-session compaction.** A session is a single Redis JSON document; events accumulate until the TTL fires. "Summary" in the extraction-strategy list is about long-term extraction, not in-session collapse. Cap client-side for long-lived sessions.
- **404 on `getSessionMemory` for new sessions is expected** — catch and treat as empty.
- **Session-event `metadata` does NOT propagate to auto-promoted memories** — the extractor produces its own records.

**Long-term memory**

- **`createdAt` / `updatedAt` are SERVER-managed.** Not on `CreateMemoryRecord`, not on `UpdateLongTermMemoryRequestContent`. You **cannot backfill** a memory with the time the underlying event occurred — workaround: put the meaningful timestamp into the `text` so semantic search can match against it.
- **Auto-promoted memories have empty `namespace` and `topics`.** Don't design filters that depend on auto-promotion tagging anything.
- **Auto-classifier mis-types memories.** A clear preference (`"User is a fan of APRS"`) was filed as **episodic**, not semantic. If `memoryType` matters, set it explicitly via `bulkCreateLongTermMemories`.
- **Auto-promotion is async and slow** — "many turns" delayed in practice. For deterministic timing or controlled metadata, write explicit memories.
- **No `actorId` / "memory creator" filter.** Discriminate sources via distinct `ownerId` values.
- **Extraction strategies are opaque.** Docs name four (discrete, summary, preferences, custom) but don't define them; the strategy in use on your store is not exposed in the control panel or REST API. Treat as a black box.
- **Underlying storage:** long-term memories are Redis Hashes (one per memory); sessions are single JSON documents per session. Useful when probing via RedisInsight / `redis-cli`.

## Anti-patterns

- **Do not read `redis/agent-memory-server` (OSS) to infer cloud behavior.** They've diverged. Stick to (1) SDK `.d.ts` files, (2) official cloud docs, (3) empirical probing.
- **Do not hand-roll a fetch client.** Speakeasy generates the SDK from the service's OpenAPI spec — it's the canonical surface. Pin the version exactly (no caret) because the SDK is pre-1.0.
- **Do not put markdown or JSON in the long-term `text` field expecting structured retrieval.** Semantic search embeds the text — prose embeds well, JSON syntax embeds poorly. Format as natural-language prose _describing_ the data.

## Examples & References

This skill keeps deeper content in two sibling folders:

- **[`references/`](./references/)** — per-SDK-method reference docs. One file per method, covering signature, parameters, return shape, and operation-specific notes. Use these as local docs instead of leaving the repo to find the API.
- **[`examples/`](./examples/)** — composed flows for common use cases. Each example uses multiple methods together.

### Method reference

**Sessions:**

- [addSessionEvent](./references/add-session-event.md) — append an event to a session.
- [getSessionMemory](./references/get-session-memory.md) — read full session history.
- [getSessionEvent](./references/get-session-event.md) — fetch one event by ID.
- [deleteSessionEvent](./references/delete-session-event.md) — remove one event.
- [deleteSessionMemory](./references/delete-session-memory.md) — delete an entire session.
- [listSessions](./references/list-sessions.md) — paginated session ID list.

**Long-term:**

- [bulkCreateLongTermMemories](./references/bulk-create-long-term-memories.md) — write memories with controlled metadata.
- [searchLongTermMemory](./references/search-long-term-memory.md) — semantic search with filters.
- [getLongTermMemory](./references/get-long-term-memory.md) — fetch one memory by ID.
- [updateLongTermMemory](./references/update-long-term-memory.md) — partial update.
- [bulkDeleteLongTermMemories](./references/bulk-delete-long-term-memories.md) — delete by ID (max 100/call).

**Health:**

- [health](./references/health.md) — readiness probe.

### Examples

- [store-chat-history](./examples/store-chat-history.md) — save user input + assistant reply as a pair of session events.
- [enrich-context](./examples/enrich-context.md) — recall long-term memories to inject into a prompt.
- [chat-turn](./examples/chat-turn.md) — full user turn end-to-end (fetch context, call model, save both sides). There is no built-in "assemble context" op; this example shows the parallel-fetch + compose recipe.

## When this skill isn't enough

In priority order:

1. **Installed SDK `.d.ts` files** — `node_modules/@redis-iris/agent-memory/dist/commonjs/models/` for request/response shapes and filter types; `dist/commonjs/sdk/sdk.d.ts` for the `AgentMemory` class. Authoritative.
2. **REST API examples** — https://redis.io/docs/latest/develop/ai/context-engine/agent-memory/api-examples/ — endpoint paths, example payloads, filter reference.
3. **Service overview** — https://redis.io/docs/latest/develop/ai/context-engine/agent-memory/ — conceptual model, two-tier description, auto-promotion behavior.
4. **REST API reference** — https://redis.io/docs/latest/develop/ai/context-engine/agent-memory/api-reference/ — full endpoint spec. Note: page is client-rendered; `curl` or non-JS WebFetch returns only the shell.
5. **npm page** — https://www.npmjs.com/package/@redis-iris/agent-memory
6. **Empirical probing** — RedisInsight or `redis-cli` against the underlying store. Reliable when docs are ambiguous.

**Do NOT use** the open-source `redis/agent-memory-server` GitHub repo. Cloud and OSS have diverged.
