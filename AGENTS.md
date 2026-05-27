# AGENTS.md

Earshot is a multi-agent demo of Redis Agent Memory: agents ingest, transcribe, curate, and recall audio from various ambient sources, stored as long-term memories. The first implemented audio source is a Yaesu FT-991 amateur radio; the architecture is meant to extend to other sources.

> **NOTE:** This document is significantly out of date relative to the current workspace layout (`packages/shared`, `packages/radio-listener`, `packages/chatbot`) and naming (chatbot tool surface is `searchTranscripts` only — no rig control; nodes renamed `memory-using-responder` / `session-event-saver`). Treat the sections below as historical context pending a refresh.

## Stack

| Concern               | Choice                                                                                       | Status  |
| --------------------- | -------------------------------------------------------------------------------------------- | ------- |
| Runtime               | Node 24, TypeScript (ESM), `tsx` to run                                                      | done    |
| Audio capture         | `ffmpeg \| sox` shell pipeline, sox segments on silence                                      | done    |
| STT                   | OpenAI Whisper API (raw — cleanup moved to the enricher graph)                               | done    |
| Listener              | `listen()` async generator combining capture + transcribe + rig tag                          | done    |
| Radio                 | Yaesu FT-991 via hamlib's `rigctld` (spawned subprocess + TCP)                               | done    |
| Enricher              | LangGraph.js workflow: correction → fan-out to NER / callsigns+roles / frequencies (gpt-4o-mini, strict JSON schema via Zod) | done    |
| Memory                | Redis Agent Memory via `@redis-iris/agent-memory` SDK (chat history wired; radio long-term pending) | partial |
| Chatbot               | LangGraph chat agent with session memory (recall/respond/save) + `tuneRig` + `queryRig` tools (memory-query tools pending) | partial |
| UI                    | Ink TUI                                                                                      | not yet |

## External tools required

Via Homebrew on macOS:

```
brew install ffmpeg sox hamlib
```

- `ffmpeg` + `sox` — audio capture pipeline.
- `hamlib` — provides `rigctld`, which the Rig class spawns as a child process. See "Why rigctld instead of node-serialport" below.

## Setup

```
cp .env.example .env       # then fill in the values
npm install
npm run devices            # list audio inputs (for AUDIO_DEVICE) and serial ports (for RIG_PORT)
npm run dev                # chat REPL via tsx (dev loop)
npm run build && npm start # chat REPL from compiled output (dist/)
```

The FT-991 enumerates as two USB-serial devices; pick the right one for `RIG_PORT`. See "FT-991 specifics" below.

## How to verify a change

There is no automated test suite. Verify changes by:

- **typecheck / build** — `npm run build` runs `tsc && tsc-alias -f`, emitting JS to `dist/`. The `tsc-alias` step rewrites the TypeScript path aliases (`@capture/...` etc.) into relative paths Node ESM can resolve, and appends `.js` extensions. Use it to catch type errors; `npm start` runs the compiled output.
- **dev loop** — `npm run dev` runs `src/main.ts` directly via `tsx`. tsx resolves path aliases natively. (Run as a one-shot, not in watch mode — the chat REPL reads stdin, which `tsx watch` intercepts.)
- **chat REPL** — either `npm run dev` or `npm run build && npm start` connects the rig, then reads stdin and pipes each line through `chat()` from `@chatbot/chatbot`. Type "tune to 14.250 MHz USB" and watch the rig actually move. Needs the rig connected; audio is not needed for chat.
- **listen + enrich pipeline** — `ingest()` in `src/ingest.ts` runs the full radio-capture flow (capture → transcribe → enrich → print). It was extracted from the old `main.ts` and is not currently called from `main.ts`; invoke it directly when verifying that side. Needs rig + audio.

Both sides need real hardware. If you can't run them, say so — don't claim a change is verified.

## File layout

```
src/
  capture/
    capture.sh         bash pipeline: ffmpeg → sox, segments on silence
    capture.ts         async generator wrapping capture.sh; yields WAV paths
    transcribe.ts      OpenAI Whisper transcription (raw output)
    listen.ts          joins capture + transcribe + Rig.instance snapshot → Transcript stream
  chatbot/
    chatbot.ts         entry point: chat(message) → reply string
    graph.ts           LangGraph StateGraph wiring (3 nodes: enrich → respond → save)
    state.ts           ChatbotStateAnnotation (sessionId / username / userMessage / promptMessages / responseMessage) + ChatbotState type
    nodes/
      prompt-enricher.ts         fetches session history from Agent Memory; builds promptMessages
      radio-using-responder.ts   runs the createAgent over promptMessages; sets responseMessage
      memory-saver.ts            writes user + assistant turns back to Agent Memory
    tools/
      tune-rig.ts                tuneRig tool — sets Rig.instance.frequency / .mode
      query-rig.ts               queryRig tool — reads Rig.instance.frequency / .mode / .band
  memory/
    client.ts          configured AgentMemory SDK instance + per-process sessionId (ULID)
  config/
    config.ts          dotenv-loaded config
  enricher/
    enricher.ts        entry point: enrichTransmission(input) → EnrichedTransmission
    graph.ts           LangGraph StateGraph wiring (correct → fan out → end)
    state.ts           EnrichmentStateAnnotation + EnrichmentState type
    nodes/
      text-corrector.ts             ham-aware cleanup of Whisper output
      named-entities-extractor.ts   people, places, organizations
      callsigns-extractor.ts        callsigns + sender/receiver/mentioned roles
      frequencies-extractor.ts      frequencies mentioned in text → Hz
  models/
    models.ts          fetchChatModel() (ChatOpenAI) + fetchSpeechToTextModel() (OpenAI); cached
  rig/
    rig.ts             Rig singleton (Rig.connect() idempotent; Rig.instance static getter); polls rigctld
    rigctld-socket.ts  spawns rigctld, speaks its line-based TCP protocol
    bands.ts           Band enum + bandFor(frequency)
    modes.ts           Mode enum mirroring hamlib's mode strings
  ingest.ts            ingest() — radio capture+enrich loop (extracted from old main.ts; not currently invoked)
  main.ts              entrypoint — connects rig, runs chat REPL on stdin via @chatbot/chatbot
  scripts/             setup-time discovery utilities (devices)
captures/              session output, one timestamped subdir per run (gitignored)
```

## Runtime data flow

`main.ts` connects the rig and drives a chat REPL — reads stdin, calls `chat(message)` from `@chatbot/chatbot`, prints the reply. The listen+enrich pipeline still exists (`ingest()` in `src/ingest.ts`) but is not currently called; reattach it when the UI lands.

Three subsystems:

- **Rig** (singleton): `Rig.connect()` spawns `rigctld` and opens a TCP socket via `RigCtlD_Socket`, then caches and returns the connected instance. The class polls `+f` and `+m` every 100 ms, keeping `Rig.instance.frequency` / `.mode` / `.band` fresh. Anyone — tools, `listen()`, a future status pane — reads from `Rig.instance` instead of having the rig threaded in as a parameter.
- **Chatbot**: `chat(message)` → compiled `graph.invoke({ messages: ... })` → single `radioUsingResponder` node → returns the agent's final message text. The `tuneRig` tool mutates `Rig.instance` directly. Stateless per call — no memory between `chat()` invocations yet.
- **Capture + transcribe + enrich** (currently inert): `ingest()` iterates `listen()` (capture.sh → sox segments → Whisper → Rig.instance snapshot) and feeds each `Transcript` into `enrichTransmission()`, printing the result. `listen()` snapshots rig state at WAV-close time, before the slow transcribe call, so metadata reflects when the audio was captured — not seconds later.

## Architecture notes

### Audio capture

One long-lived bash pipeline. ffmpeg streams raw PCM (s16le, 16 kHz mono — matches Whisper's internal input rate, no point sampling higher) to sox, which uses the `silence` effect with `:newfile :restart` to write one WAV per take. Each session creates its own timestamped subdirectory under `captures/`. Sox auto-numbers files within it (`utterance-001.wav`, `utterance-002.wav`, ...).

`captureUtterances()` is an async generator. It yields a WAV path _when the next file is opened_ — that's when sox has just closed the previous one, so it's safe to read. The in-progress file at abort time is never yielded (it's empty: sox is sitting in skip-silence mode waiting for the next take).

### Why a bash pipeline instead of two Node-spawned processes?

A persistent ffmpeg with per-utterance spawned sox processes failed: subsequent sox processes saw EOF on stdin ~80 ms in, with no clear cause. Sox's own `:newfile :restart` chain sidesteps the problem — one sox process owns the whole session, segmentation is internal.

### Enricher graph

The enricher is a LangGraph `StateGraph` defined in `src/enricher/graph.ts`. State is declared once in `state.ts` (`EnrichmentStateAnnotation`) and carries only the fields nodes read or write: `text`, `correctedText`, `entities`, `callsigns`, `frequenciesMentioned`. Each node takes `EnrichmentState` and returns `Partial<EnrichmentState>`.

Topology: `START → text-corrector → { named-entities-extractor, callsigns-extractor, frequencies-extractor } → END`. The three extractors run in parallel; LangGraph waits for all of them before terminating.

`enrichTransmission()` in `enricher.ts` is the invocation layer: it invokes the compiled graph with just `{ text }`, then composes the final `EnrichedTransmission` by spreading the rig metadata from the input alongside the graph's output. The rig metadata never enters the graph — it's orthogonal to the graph's concern.

Each extractor node owns its Zod schema and its inferred type (`Callsigns`, `FrequencyMention`, `NamedEntities`). `state.ts` imports those types. Extractors use `chat().withStructuredOutput(Schema, { strict: true })` so OpenAI's decoder is constrained to produce schema-valid output.

The text-corrector's system prompt optionally gets a "Local context" block appended at module load from `LOCATION_CONTEXT` (via `config.location.context`) — a free-form description of the operator's QTH, nearby towns, local repeaters, and clubs. Helps the corrector fix Whisper mistranscriptions of local proper nouns that ham vocabulary alone can't cover (e.g. "Canoa" → "Genoa Township"). Empty/unset means the prompt is the universal ham-jargon version only.

### Chatbot graph

`src/chatbot/` mirrors the enricher's layout: `chatbot.ts` (entry: `chat(message)`), `graph.ts`, `state.ts`, `nodes/`, `tools/`. State is a custom `Annotation.Root` with five named fields — `sessionId`, `username`, `userMessage`, `promptMessages`, `responseMessage` — NOT `MessagesAnnotation`. The shape was lifted from `guyroyse/ai-news-agent`'s chatbot workflow, which uses the same Redis Agent Memory recall/respond/save pattern; `username` is an Earshot addition so the caller threads identity into the workflow.

Topology is three nodes: `START → prompt-enricher → radio-using-responder → memory-saver → END`.

- **prompt-enricher** (`nodes/prompt-enricher.ts`): reads `sessionId` from state, calls `agentMemory.getSessionMemory(sessionId)`, maps `SessionEvent[]` to `BaseMessage[]` (`USER` → `HumanMessage`, `ASSISTANT` → `AIMessage`, `SYSTEM` → `SystemMessage`), appends the current `userMessage` as a `HumanMessage`, returns `{ promptMessages }`. A 404 on the first turn of a new session is caught and treated as empty history.
- **radio-using-responder** (`nodes/radio-using-responder.ts`): holds the `createAgent` instance (from the `langchain` package — not the deprecated `createReactAgent` from `@langchain/langgraph/prebuilt`) at module scope. Invokes it with `{ messages: state.promptMessages }`, extracts the final message's string content, returns `{ responseMessage }`. See "Why a node wrapper instead of adding the agent as a node directly" below.
- **memory-saver** (`nodes/memory-saver.ts`): writes two `addSessionEvent` calls — `actorId: state.username` + `role: 'USER'` for the input, then `actorId: 'earshot'` + `role: 'ASSISTANT'` for the reply. The first user turn's actorId becomes the session's permanent `ownerId` (set by the service from the actorId of the first event), so the user's name doubles as the session owner — useful as a search filter later. Tool-call messages from the agent's internal loop are NOT persisted; only the user input and the final assistant text. The closed `MessageRole` enum (`USER | ASSISTANT | SYSTEM`) doesn't include `TOOL`, so faithful tool-dance replay isn't an option without serializing into `metadata`.

`chat(message, username)` imports the `sessionId` from `@memory/client` and invokes the graph with `{ sessionId, username, userMessage: message }`. Returns `finalState.responseMessage`. `main.ts` sources `username` from `config.user.name` (env var `USER_NAME`, defaults to `'operator'`) — set it to your callsign to get per-callsign filtering on future long-term-memory recall.

**Why a node wrapper instead of adding the agent as a node directly**: `createReactAgent` returned a `CompiledStateGraph` you could pass straight to `addNode`. The replacement `createAgent` returns a `ReactAgent` wrapper class; it exposes the underlying graph via `.graph`, but the JS types don't currently line up to use it as a node — see [langgraphjs#1767](https://github.com/langchain-ai/langgraphjs/issues/1767). The wrapper-node pattern (instantiate the agent once at module scope; node function calls `.invoke()` and reshapes the result) is the documented workaround. When the parity bug is fixed this can collapse to `builder.addNode('agent', agent.graph)`.

The rig tools in `tools/` are top-level `tool()` consts — no factories — because they reach for `Rig.instance` like everything else. `tuneRig` takes optional `frequency` (hertz) and `mode` (`Mode` enum) and short-circuits to a no-op message if neither is provided. `queryRig` takes no arguments and returns a human-readable summary of `Rig.instance.frequency` / `.mode` / `.band` (with `unknown` for any null fields, in case the first poll hasn't completed).

### Memory client

`src/memory/client.ts` exports two module-level singletons:

- `agentMemory` — the `AgentMemory` SDK instance from `@redis-iris/agent-memory` (Speakeasy-generated, pinned to an exact version in `package.json` since the SDK is private-preview and may break). Configured from `config.memory` (host / storeId / apiKey).
- `sessionId` — a fresh ULID (`ulid` package, not `ulidx` — see comparison: `ulid` is more recently maintained as of 2026). One session per process run, by design: each `npm run dev` gives the chatbot a clean conversation context. ULID over UUID so session lists can be sorted lexicographically by creation time.

Long-term memory (enriched radio transmissions) is not yet wired in; when it lands, it'll use `agentMemory.bulkCreateLongTermMemories` from inside `ingest()` and `agentMemory.searchLongTermMemory` from chatbot recall tools.

### Rig as a singleton

`Rig.connect()` is idempotent: it caches the connected instance in a private static field and returns the same instance on every call. `Rig.instance` is a static getter that returns it (throwing if `connect()` hasn't run yet). `rig.close()` clears the cache so a future `Rig.connect()` would reconnect.

The pattern is here because the rig is genuinely process-singleton — one rig per process — and threading it through every signature (tool definitions, `listen()`, graph nodes, the chatbot entry, future status panes) was noise. Consumers just import `Rig` and read `Rig.instance.frequency` etc. The cost is that the dependency on a connected rig is implicit at call sites; `main.ts` is responsible for ensuring `await Rig.connect()` runs before anything reads `Rig.instance`.

### FT-991 specifics

- The rig enumerates as two USB-serial devices (Silicon Labs CP210x). Convention: the lower-numbered (`-0`) suffix is typically the Enhanced / CAT port; the higher (`-1`) is the Standard / RTS-for-PTT port. Confirm via `npm run devices` + trial. The CAT port is what `RIG_PORT` needs.
- On macOS, always use the `/dev/cu.*` (call-up) path, never `/dev/tty.*` — opening a tty device blocks until DCD is asserted, which the rig never does. `SerialPort.list()` reports tty paths; the `devices` script translates them to cu paths.
- AI (Auto-Information) mode is unreliable on the FT-991 — the rig doesn't broadcast unsolicited state changes when the VFO is turned. We poll explicitly (every 100 ms) instead of subscribing.
- The rig's built-in soundcard is a separate USB audio device, unrelated to either serial port. List it with `npm run devices`.

### Why rigctld instead of node-serialport?

We first tried talking to the FT-991 directly via the `serialport` npm package on macOS. It consistently failed in a way that took several hours to root-cause: `port.isOpen` returned `true`, writes "succeeded" with no error and drain confirmed, but the rig never sent anything back. `rigctl` on the same port/baud worked fine.

Root cause: `node-serialport` on macOS has a long-standing IOSSIOSPEED/tcsetattr ordering bug (see issues #1077, #2699). The OS-X-specific `IOSSIOSPEED` ioctl is the only way to actually set baud on these Silicon Labs CP210x driver paths; standard `tcsetattr` silently leaves the port at 9600. node-serialport's open path calls `tcsetattr` after `IOSSIOSPEED` in some refactorings, which wipes out the custom baud — so the port stays physically at 9600 even when we ask for 38400. `stty` exhibits the same problem and isn't a usable workaround.

Hamlib's `rigctld` does the IOSSIOSPEED ordering correctly. Rather than patch around the serialport bug, we spawn `rigctld` as a child process at `Rig.connect()` time and talk to it over TCP. Extra process to manage, but the line protocol is simpler than CAT framing and hamlib handles all the rig-specific quirks.

### `rigctld` lifecycle

`Rig.connect()` → `RigCtlD_Socket.open()` → `spawn('rigctld', ['-m', model, '-r', port, '-s', baud, '-t', 4532])`. The TCP connect retries with 100 ms backoff up to 5 seconds while rigctld is starting up.

`rig.close()` calls `socket.close()`, which `end()`s the TCP socket and `process.kill()`s the child. No PID files or external daemons — each Node process owns its own rigctld instance.

### Rigctld protocol notes

The protocol is one command per line. Commands prefixed with `+` get extended/labeled output terminated by `RPRT N` (where N=0 on success, negative on error). Without the prefix, responses are bare values with no terminator, which is harder to parse safely — so we always use `+` from the Rig class.

`RigCtlD_Socket` serializes transactions through an internal chain: `send()` awaits any prior in-flight transaction, writes the command, and remembers the chain-release callback. `readLine()` returns lines as they arrive; when it sees one starting with `RPRT`, it releases the chain so the next `send()` can proceed. Callers _must_ read until `RPRT` for each `send()` or the chain stays locked.

## TypeScript style

- **Top-down function order**: exported / main function first, helpers below. Function declarations hoist, so this works without forward-reference issues.
- **Constants first, then functions**: module-level data (prompts, schemas, cached singletons) lives above the function declarations that use it. See `capture/transcribe.ts` and the enricher node files for the pattern.
- **`function foo()` declarations** for named module-level functions, not `const foo = () => ...`. Arrow functions are fine inline for callbacks.
- **Full words for variable names**, not abbreviations or single letters: `frequency` not `hz`, `mode` not `m`, `megahertz` not `mhz`, `command` not `cmd`, `previousLine` not `last`. Trivial loop indices can stay short.
- **Path aliases**: cross-folder imports use `@capture/...`, `@chatbot/...`, `@config/...`, `@enricher/...`, `@memory/...`, `@models/...`, `@rig/...` rather than `../../foo.js`. Same-folder imports stay relative (`./foo.js`). The aliases are configured in `tsconfig.json` paths; `tsc-alias -f` rewrites them to relative `.js` specifiers at build time. `tsx` (dev) resolves them natively.
- **Imports omit the `.js` extension on aliased paths** (`'@models/models'`), but keep it on relative paths (`'./state.js'`) — required because we use `moduleResolution: bundler` for permissive typecheck, and tsc-alias adds the extension at emit time for Node ESM compatibility.
- **Logging**: errors are logged inline via `console.error` at the call site (see Rig methods). No external logger; don't add one without a reason.
- Strict mode is on; no `any` cheats (with one deliberate exception in `enricher/graph.ts` where LangGraph's chained builder type is awkward).
- Default to no comments. Add `/* ... */` only when the _why_ isn't obvious from the code (e.g. protocol notes, ordering invariants). Don't write JSDoc / docstrings.

## What's next

In order:

1. **Long-term memory for radio transmissions** — `ingest()` should call `agentMemory.bulkCreateLongTermMemories` for each `EnrichedTransmission`. Schema: `{ text: enriched.correctedText, memoryType: 'episodic', metadata: { ... callsigns / band / mode / frequency / receivedAt ... } }` for filterable recall. Auto-promotion from session memory is a separate path the service offers; we want explicit inserts so we control the metadata.
2. **Chatbot — memory-query tools** — `tuneRig` and `queryRig` are shipped, and session chat history works. Still to add: `searchTranscripts({ query, callsign?, band?, since? })` calling `agentMemory.searchLongTermMemory(...)`. Probably becomes a new tool file alongside `tune-rig.ts` / `query-rig.ts`.
3. **UI** — Ink TUI. Single-process app combining `ingest()`, the chat agent, and three panes: chat / live transcripts / rig status. This is where `ingest()` gets called back into life — `main.ts` will start it alongside the TUI render loop.
