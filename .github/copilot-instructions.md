# AGENTS.md

Earshot is a multi-agent demo of Redis Agent Memory: agents ingest, transcribe, curate, and recall audio from various ambient sources, stored as long-term memories. The implemented audio sources are a Yaesu FT-991 amateur radio and a generic microphone; the architecture is meant to extend to other sources.

The directory on disk is still `ham-buddy/` (the project's working title before it was renamed to Earshot). The directory name is legacy and not the project's identity — don't rename it without coordinating, because doing so dissociates Claude Code's session memory.

## Architecture at a glance

Three independent Node processes share a single Redis Agent Memory store:

- **radio-listener** (`packages/radio-listener`) — captures audio from the rig, transcribes it, enriches with structured fields (including callsigns and frequencies), formats a prose description, and writes each transmission as a long-term memory. Owns `rigctld` and the audio capture pipeline.
- **mic-listener** (`packages/mic-listener`) — same shape as the radio listener but stripped of the radio-domain bits: no rig, no callsign/frequency extraction, and a generic-English text corrector. Reads from a plain microphone and writes each captured utterance as a long-term memory under the shared owner id (`'earshot-listener'` by default).
- **chatbot** (`packages/chatbot`) — REPL that talks to the user. Pulls preference memories at each turn, calls `searchTranscripts` when the user asks about something heard, persists each turn as session events.

They never communicate directly. All coordination happens through the shared Agent Memory store. Each process can run alone; the architecture supports multiple of either in theory.

A curator agent — between the listeners and long-term memory — is a planned extension (see "What's next") but is **not implemented**. Today both listeners write every utterance directly to long-term memory.

## Stack

| Concern               | Choice                                                                            | Status   |
| --------------------- | --------------------------------------------------------------------------------- | -------- |
| Runtime               | Node 24, TypeScript (ESM), `tsx` to run                                           | done     |
| Workspace             | npm workspaces — four packages: `@earshot/shared`, `@earshot/radio-listener`, `@earshot/mic-listener`, `@earshot/chatbot` | done |
| Audio capture         | `ffmpeg \| sox` shell pipeline, sox segments on silence — in shared               | done     |
| STT                   | OpenAI Whisper API, no prompt — domain cleanup happens downstream in the enricher | done     |
| Radio                 | Yaesu FT-991 via hamlib's `rigctld` (spawned subprocess + TCP)                    | done     |
| Enricher              | LangGraph.js workflow: correction → fan-out to NER / callsigns+roles / frequencies (`gpt-4o-mini`, strict JSON schema via Zod) | done |
| Long-term memory      | Redis Agent Memory via `@redis-iris/agent-memory` SDK — listener writes via `bulkCreateLongTermMemories` | done |
| Session memory        | Redis Agent Memory — chatbot writes user + assistant turns via `addSessionEvent`  | done     |
| Preference recall     | chatbot pre-fetches top-N preference memories (filtered by user's ownerId) and injects as a system message each turn | done |
| Chatbot tools         | `searchTranscripts` — semantic search over listener memories, filtered by listener ownerId | done |
| Curator agent         | Planned — listener writes to a Redis Stream, curator decides what becomes long-term memory | not yet |
| UI                    | Ink TUI was previously planned; currently deferred — both apps are CLI            | deferred |

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
npm run devices            # list audio inputs (for MIC_AUDIO_DEVICE / RADIO_AUDIO_DEVICE) and serial ports (for RIG_PORT)
npm run chat               # chat REPL via tsx (no rig or audio needed)
npm run listen             # radio capture + enrich + store loop (needs rig + audio)
npm run mic-listen         # mic capture + enrich + store loop (needs audio only)
npm run build              # tsc -b + per-package tsc-alias
```

The FT-991 enumerates as two USB-serial devices; pick the right one for `RIG_PORT`. See "FT-991 specifics" below.

## How to verify a change

There is no automated test suite. Verify changes by:

- **typecheck / build** — `npm run build` runs `tsc -b` then `tsc-alias -f` per workspace package. Use it to catch type errors. Each package emits to its own `dist/` directory; the per-package `tsc-alias` step rewrites path aliases into `.js`-suffixed relative paths Node ESM can resolve.
- **chatbot smoke test** — `npm run chat` boots the REPL and prints `Earshot Chat Bot — Ctrl+C to stop\n` followed by the colored `<callsign>> ` prompt. The chatbot doesn't need the rig or audio; it just needs OpenAI and Agent Memory credentials. Stops cleanly on Ctrl+C or piped-EOF on stdin.
- **radio-listener smoke test** — `npm run listen` connects the rig (via `Rig.connect()`) then enters the ingest loop. Needs the rig powered + connected via USB, and audio routed from the rig's sound card. Each utterance prints the formatted prose to stdout and writes it to long-term memory.
- **mic-listener smoke test** — `npm run mic-listen` enters the ingest loop directly (no hardware setup). Needs an audio input device set via `MIC_AUDIO_DEVICE`. Each utterance prints the formatted prose to stdout and writes it to long-term memory.

Both listener sides need real audio input. If you can't run them, say so — don't claim a change is verified.

## File layout

```
packages/
  shared/
    src/
      audio/
        capture.sh         bash pipeline: ffmpeg → sox, segments on silence
        capture.ts         async generator wrapping capture.sh; yields WAV paths
        transcribe.ts      OpenAI Whisper transcription; lazy OpenAI client from env
      index.ts             barrel — re-exports captureUtterances + transcribe
    package.json
    tsconfig.json
  radio-listener/
    src/
      config/
        config.ts          dotenv-loaded config (openai, memory, audio, rig, listenerOwnerId)
      enricher/
        enricher.ts        entry point: enrichTransmission(input) → EnrichedTransmission
        graph.ts           LangGraph StateGraph wiring (correct → fan out → end)
        state.ts           EnrichmentStateAnnotation + EnrichmentState type
        nodes/
          text-corrector.ts             ham-aware cleanup of Whisper output
          named-entities-extractor.ts   people, places, organizations
          callsigns-extractor.ts        callsigns + sender/receiver/mentioned roles
          frequencies-extractor.ts      frequencies mentioned in text → Hz
      ingest/
        ingest.ts          ingest() loop + printTransmission + storeMemory
        transmissions.ts   captureTransmissions() async generator + CapturedTransmission type
        format.ts          describeTransmission() — prose builder + private format helpers
      memory/
        client.ts          configured AgentMemory SDK instance
      models/
        models.ts          fetchChatModel() (ChatOpenAI); cached
      rig/
        rig.ts             Rig singleton (Rig.connect() idempotent; Rig.instance static getter)
        rigctld-socket.ts  spawns rigctld, speaks its line-based TCP protocol
        bands.ts           Band enum + bandFor(frequency)
        modes.ts           Mode enum mirroring hamlib's mode strings
      main.ts              entrypoint — connects rig, runs ingest()
    package.json
    tsconfig.json
  mic-listener/
    src/
      config/
        config.ts          dotenv-loaded config (openai, memory, audio, listenerOwnerId — defaults to 'earshot-listener')
      enricher/
        enricher.ts        entry: enrichRecording(input) → EnrichedRecording
        graph.ts           LangGraph StateGraph wiring (correct → entities → end)
        state.ts           EnrichmentStateAnnotation + EnrichmentState type
        nodes/
          text-corrector.ts             generic-English cleanup of Whisper output
          named-entities-extractor.ts   people, places, organizations
      ingest/
        ingest.ts          ingest() loop + logRecording + storeMemory
        recordings.ts      captureRecordings() async generator + CapturedRecording type (no rig metadata)
        format.ts          formatRecording() — prose builder
      memory/
        client.ts          configured AgentMemory SDK instance
      models/
        models.ts          fetchChatModel() (ChatOpenAI); cached
      main.ts              entrypoint — runs ingest()
    package.json
    tsconfig.json
  chatbot/
    src/
      chatbot/
        chatbot.ts         entry: chat(username, message) → reply string
        graph.ts           LangGraph StateGraph wiring (3 nodes)
        state.ts           ChatbotStateAnnotation + ChatbotState type
        nodes/
          prompt-enricher.ts         pre-fetches preferences + session history; builds promptMessages
          memory-using-responder.ts  runs the createAgent over promptMessages; sets responseMessage
          session-event-saver.ts     writes user + assistant turns to session memory
        tools/
          search-transcripts.ts      searchTranscripts tool — searchLongTermMemory filtered by listenerOwnerId
      config/
        config.ts          dotenv-loaded config (openai, memory, userName, listenerOwnerId)
      memory/
        client.ts          AgentMemory SDK instance + per-process sessionId (ULID)
      models/
        models.ts          fetchChatModel() (ChatOpenAI); cached
      main.ts              entrypoint — readline REPL with chalk-colored prompts
    package.json
    tsconfig.json
scripts/
  devices.ts               setup-time utility — lists audio devices + serial ports
captures/                  session output under mic/ and radio/, one timestamped subdir per run (gitignored)
```

## Runtime data flow

Two long-lived processes, one shared store.

**radio-listener** (`packages/radio-listener/src/main.ts`):

1. `Rig.connect()` spawns `rigctld` and opens a TCP socket; the Rig class polls `+f` and `+m` every 100 ms.
2. `ingest()` enters a `for await` loop over `captureTransmissions()`.
3. `captureTransmissions()` (in `ingest/transmissions.ts`) iterates `captureUtterances()` from shared, snapshots the rig state at WAV-close time, calls `transcribe()`, and yields a `CapturedTransmission`.
4. For each transmission: `enrichTransmission()` (LangGraph workflow) → `describeTransmission()` (prose builder) → `printTransmission()` (diagnostic stdout) + `storeMemory()` (`bulkCreateLongTermMemories` with `memoryType: 'episodic'`, `ownerId: config.listenerOwnerId`, a fresh ULID).

**chatbot** (`packages/chatbot/src/main.ts`):

1. Reads stdin via `readline`.
2. For each line: `chat(username, message)` invokes the LangGraph chatbot graph.
3. Graph nodes (in order): `prompt-enricher` → `memory-using-responder` → `session-event-saver`.
4. `prompt-enricher` does two SDK calls in parallel: `searchLongTermMemory` (preferences for this user) and `getSessionMemory` (chat history for this session). Builds an ordered `BaseMessage[]` — preference system message first (if any), then history, then the new user message.
5. `memory-using-responder` invokes a `createAgent` instance (with the `searchTranscripts` tool available) over those messages and pulls the final assistant message text.
6. `session-event-saver` writes the user turn (`actorId: username`, `role: USER`) and the assistant turn (`actorId: 'earshot'`, `role: ASSISTANT`) to session memory.

The chatbot has no awareness of the rig or capture pipeline. The listener has no awareness of chat. Both processes are independently startable.

## Architecture notes

### Workspace structure

Four packages under `packages/`:

- **`@earshot/shared`** — domain-agnostic audio capture + transcription. The only library that's meant to be reused across listener variants. Owns its own OpenAI client (reads `OPENAI_API_KEY` from env).
- **`@earshot/radio-listener`** — the radio-specific listener. Owns `rigctld`, the rig client, the enricher, and the ingest loop. Has its own copy of `config/`, `memory/`, `models/`.
- **`@earshot/mic-listener`** — the generic-microphone listener. Same overall shape as the radio listener but without `rig/`, without the callsign and frequency extractor nodes, and with a domain-agnostic text-corrector prompt. Has its own copy of `config/`, `memory/`, `models/`.
- **`@earshot/chatbot`** — the conversational REPL. Has its own copy of `config/`, `memory/`, `models/`.

Each app has its own `memory/client.ts`, `models/models.ts`, and `config/config.ts` rather than sharing a single utility package. That's a deliberate demo-friendliness call — each app reads as self-contained when you walk the slide deck. The cost is mild duplication; the `MEMORY_*` env keys must stay in sync across listeners, but each listener has its own audio config (`MIC_AUDIO_*` vs `RADIO_AUDIO_*`) so they can capture from separate sources at once. All three apps default `listenerOwnerId` to `'earshot-listener'` so the chatbot sees both listeners' writes out of the box; setting `LISTENER_OWNER_ID` in `.env` overrides all of them to a different shared value.

Path aliases (`@config/*`, `@memory/*`, `@models/*`, `@rig/*`, `@enricher/*`, `@chatbot/*`) are configured **per-package** in each `tsconfig.json` — they point inside the same package. Cross-package imports use the workspace package name (e.g. `@earshot/shared`).

### Audio capture (shared)

One long-lived bash pipeline. ffmpeg streams raw PCM (s16le, 16 kHz mono — matches Whisper's internal input rate, no point sampling higher) to sox, which uses the `silence` effect with `:newfile :restart` to write one WAV per take. Each session creates its own timestamped subdirectory under `captures/`. Sox auto-numbers files within it (`utterance-001.wav`, `utterance-002.wav`, ...).

`captureUtterances(signal, { device, outputDir })` is an async generator. It yields a WAV path _when the next file is opened_ — that's when sox has just closed the previous one, so it's safe to read. The in-progress file at abort time is never yielded (it's empty: sox is sitting in skip-silence mode waiting for the next take).

The function is parameterized — no config import in shared. The caller passes `{ device, outputDir }`. That keeps shared domain-agnostic for future non-radio listeners.

### Why a bash pipeline instead of two Node-spawned processes?

A persistent ffmpeg with per-utterance spawned sox processes failed: subsequent sox processes saw EOF on stdin ~80 ms in, with no clear cause. Sox's own `:newfile :restart` chain sidesteps the problem — one sox process owns the whole session, segmentation is internal.

### Transcription (shared)

`transcribe(wavPath)` is a thin wrapper around OpenAI's Whisper transcription endpoint. The OpenAI client is lazy-initialized on first call from `process.env.OPENAI_API_KEY`. **No Whisper prompt** — all domain knowledge (callsigns, NATO phonetics, Q-codes, CQ/73 mishears, etc.) lives in the radio-listener's `text-corrector` node, which has no token cap.

If you ever need a Whisper prompt for a different domain (e.g. a meeting-room mic listener wanting speaker-name hints), pass it back as a parameter and provide it at the call site.

### Listener: `ingest/`

Top-down read order:

- `ingest.ts` — `ingest()` is the for-await loop. Its body is four lines: enrich, describe, print, store. Two private helpers — `printTransmission()` and `storeMemory()` — live in the same file so the whole pipeline fits on one screen.
- `transmissions.ts` — `captureTransmissions()` async generator that joins `captureUtterances()` + `transcribe()` + a `rigState()` snapshot helper. Yields `CapturedTransmission` (fields: `text`, `audioPath`, `receivedAt`, `frequency`, `mode`, `band`).
- `format.ts` — `describeTransmission(enriched)` builds a prose paragraph that becomes the long-term memory content. Built from conditional fragments (sender/receiver callsigns, mentioned callsigns, people/places/orgs, frequencies referenced). Private `formatFrequency()` / `formatFrequencyMention()` helpers.

`CapturedTransmission` is structurally a superset of `IncomingTransmission` from the enricher (just adds `audioPath`), so the ingest loop passes the whole object straight to `enrichTransmission()` — TypeScript's structural typing handles it.

### Enricher graph

The enricher is a LangGraph `StateGraph` defined in `packages/radio-listener/src/enricher/graph.ts`. State is declared once in `state.ts` (`EnrichmentStateAnnotation`) and carries only the fields nodes read or write: `text`, `correctedText`, `entities`, `callsigns`, `frequenciesMentioned`. Each node takes `EnrichmentState` and returns `Partial<EnrichmentState>`.

Topology: `START → text-corrector → { named-entities-extractor, callsigns-extractor, frequencies-extractor } → END`. The three extractors run in parallel; LangGraph waits for all of them before terminating.

`enrichTransmission()` in `enricher.ts` is the invocation layer: it invokes the compiled graph with just `{ text }`, then composes the final `EnrichedTransmission` by spreading the rig metadata from the input alongside the graph's output. The rig metadata never enters the graph — it's orthogonal to the graph's concern.

Each extractor node owns its Zod schema and its inferred type (`Callsigns`, `FrequencyMention`, `NamedEntities`). `state.ts` imports those types. Extractors use `chat().withStructuredOutput(Schema, { strict: true })` so OpenAI's decoder is constrained to produce schema-valid output.

The text-corrector's system prompt optionally gets a "Local context" block appended at module load from each listener's location-context env var (`MIC_AUDIO_LOCATION_CONTEXT` / `RADIO_AUDIO_LOCATION_CONTEXT`, via `config.audio.locationContext`) — a free-form description of where the receiver sits, nearby towns, local repeaters, and clubs. Helps the corrector fix Whisper mistranscriptions of local proper nouns that ham vocabulary alone can't cover (e.g. "Canoa" → "Genoa Township"). Empty/unset means the prompt is the universal ham-jargon version only.

### Chatbot graph

`packages/chatbot/src/chatbot/` mirrors the enricher's layout: `chatbot.ts` (entry: `chat(username, message)`), `graph.ts`, `state.ts`, `nodes/`, `tools/`. State is a custom `Annotation.Root` with five named fields — `sessionId`, `username`, `userMessage`, `promptMessages`, `responseMessage` — NOT `MessagesAnnotation`. The shape was lifted from `guyroyse/ai-news-agent`'s chatbot workflow, which uses the same Redis Agent Memory recall/respond/save pattern; `username` is an Earshot addition so the caller threads identity into the workflow.

Topology is three nodes: `START → prompt-enricher → memory-using-responder → session-event-saver → END`.

- **prompt-enricher** (`nodes/prompt-enricher.ts`): two parallel SDK calls. `searchLongTermMemory({ text: PREFERENCE_SEARCH_QUERY, limit: 5, filter: { ownerId: { eq: username } } })` pulls preference-shaped memories about the user; `getSessionMemory(sessionId)` pulls chat history. Maps `SessionEvent[]` to `BaseMessage[]` using SDK types (`MessageRole.User` → `HumanMessage`, etc.). Returns `{ promptMessages }` with the preference system message first (if any), then history, then the current user message as a `HumanMessage`. A 404 on the first turn of a new session is caught and treated as empty history. `PREFERENCE_SEARCH_QUERY` is a deliberately broad, query-independent phrase so the same baseline preferences surface every turn.
- **memory-using-responder** (`nodes/memory-using-responder.ts`): holds the `createAgent` instance (from the `langchain` package — not the deprecated `createReactAgent` from `@langchain/langgraph/prebuilt`) at module scope, configured with the `searchTranscripts` tool. Invokes it with `{ messages: state.promptMessages }`, extracts the final message's string content, returns `{ responseMessage }`. The system prompt is deliberately source-agnostic — it talks about "audio sources" and "listener agents," not radio specifically. Radio-domain knowledge enters via the memory content the agent reads, not via the prompt. See "Why a node wrapper instead of adding the agent as a node directly" below.
- **session-event-saver** (`nodes/session-event-saver.ts`): writes two `addSessionEvent` calls — `actorId: state.username` + `role: MessageRole.User` for the input, then `actorId: 'earshot'` + `role: MessageRole.Assistant` for the reply. The first user turn's actorId becomes the session's permanent `ownerId` (set by the service from the actorId of the first event), so the user's name doubles as the session owner. Tool-call messages from the agent's internal loop are NOT persisted; only the user input and the final assistant text. The closed `MessageRole` enum (`USER | ASSISTANT | SYSTEM`) doesn't include `TOOL`, so faithful tool-dance replay isn't an option without serializing into `metadata`.

`chat(username, message)` imports the `sessionId` from `@memory/client` and invokes the graph with `{ sessionId, username, userMessage: message }`. Returns `finalState.responseMessage`. `main.ts` sources `username` from `config.userName` (env var `USER_NAME`, defaults to `'user'`) — set it to your callsign to get per-callsign filtering on preference recall.

**Why a node wrapper instead of adding the agent as a node directly**: `createReactAgent` returned a `CompiledStateGraph` you could pass straight to `addNode`. The replacement `createAgent` returns a `ReactAgent` wrapper class; it exposes the underlying graph via `.graph`, but the JS types don't currently line up to use it as a node — see [langgraphjs#1767](https://github.com/langchain-ai/langgraphjs/issues/1767). The wrapper-node pattern (instantiate the agent once at module scope; node function calls `.invoke()` and reshapes the result) is the documented workaround. When the parity bug is fixed this can collapse to `builder.addNode('agent', agent.graph)`.

`searchTranscripts` (`tools/search-transcripts.ts`) is a top-level `tool()` const. Takes a single `query` parameter, calls `agentMemory.searchLongTermMemory({ text: query, limit: 10, filter: { ownerId: { eq: config.listenerOwnerId } } })`, and returns the matched memory texts joined by blank lines (or a "no matches" string). The chatbot has no other tools — no rig control by design.

### Memory clients

`packages/radio-listener/src/memory/client.ts` and `packages/chatbot/src/memory/client.ts` each export their own module-level singleton:

- Both export `agentMemory` — an `AgentMemory` SDK instance from `@redis-iris/agent-memory` (Speakeasy-generated, pinned to an exact version in `package.json` since the SDK is private-preview and may break). Configured from `config.memory` (host / storeId / apiKey).
- The **chatbot's** memory client additionally exports `sessionId` — a fresh ULID (`ulid` package). One session per process run, by design: each `npm run chat` gives the chatbot a clean conversation context. ULID over UUID so session lists can be sorted lexicographically by creation time.
- The radio-listener has no session ID — long-term writes don't belong to a session. Each write is independent, identified by its own ULID `id`.

**ownerId conventions**:

- **Listener writes** use `ownerId: config.listenerOwnerId` (default `'earshot-listener'`). The chatbot's `searchTranscripts` tool filters on this same value.
- **Session events from the user** use `actorId: username` (the operator's callsign / name). The Agent Memory service sets the session's permanent `ownerId` from the first event's actorId, so the user becomes the session owner.
- **Session events from the assistant** use `actorId: 'earshot'`.
- **Auto-promoted memories** from the chat session (which the cloud service produces asynchronously) inherit the session's ownerId — i.e. the user's name. The chatbot's preference pre-fetch filters by `ownerId: { eq: username }`, which catches those.

### Rig as a singleton

`Rig.connect()` is idempotent: it caches the connected instance in a private static field and returns the same instance on every call. `Rig.instance` is a static getter that returns it (throwing if `connect()` hasn't run yet). `rig.close()` clears the cache so a future `Rig.connect()` would reconnect.

The pattern is here because the rig is genuinely process-singleton — one rig per process — and threading it through every signature (graph nodes, `captureTransmissions()`, future status panes) was noise. Consumers just import `Rig` and read `Rig.instance.frequency` etc. The cost is that the dependency on a connected rig is implicit at call sites; the radio-listener's `main.ts` is responsible for ensuring `await Rig.connect()` runs before anything reads `Rig.instance`.

The chatbot never imports `Rig` — it has no rig dependency.

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

If you ever run multiple radio-listeners against different rigs, give each one a different `-t` (TCP) port and a different `-r` (serial device). Multiple rigctlds on one machine is supported by hamlib; multiple rigctlds against the same serial port is not (and would fail at OS level anyway).

### Rigctld protocol notes

The protocol is one command per line. Commands prefixed with `+` get extended/labeled output terminated by `RPRT N` (where N=0 on success, negative on error). Without the prefix, responses are bare values with no terminator, which is harder to parse safely — so we always use `+` from the Rig class.

`RigCtlD_Socket` serializes transactions through an internal chain: `send()` awaits any prior in-flight transaction, writes the command, and remembers the chain-release callback. `readLine()` returns lines as they arrive; when it sees one starting with `RPRT`, it releases the chain so the next `send()` can proceed. Callers _must_ read until `RPRT` for each `send()` or the chain stays locked.

## Agent Memory notes

Behavior worth knowing, mostly empirical:

- **Auto-promotion exists and is slow.** Session events are asynchronously extracted into long-term memory by a background worker on the cloud side. We've seen this work but it can take many turns to fire. For deterministic timing or controlled metadata, use explicit `bulkCreateLongTermMemories` (which is what the listener does for transcripts).
- **The auto-classifier is opaque and sometimes wrong.** We observed `"User is a fan of APRS"` (a stable preference, should be semantic) classified as `episodic`. If `memoryType` matters for downstream behavior, set it explicitly on insert.
- **Auto-promoted memories have empty `namespace` and `topics`.** The fields exist on the record but the auto-extractor doesn't populate them. Don't design recall filters that depend on auto-promotion tagging anything.
- **`namespace` and `topics` are deliberately unused.** We're not setting them on listener writes either, despite them being available. The demo discriminates between listener-owned and user-owned memories via `ownerId` alone — cleaner story than "topics that we set."
- **No session compaction.** The session JSON document grows unbounded for its TTL; old messages never fall off. When the TTL expires, the entire session disappears wholesale. Today each `npm run chat` makes a fresh ULID session so this isn't a problem; if sessions ever become long-lived, in-session compaction becomes the client's problem.
- **Memory types**: closed enum `"semantic" | "episodic" | "message"`. The auto-classifier's choices for these are unreliable (see above). For explicit listener writes we use `MemoryType.Episodic`.

## TypeScript style

- **Top-down function order**: exported / main function first, helpers below. Function declarations hoist, so this works without forward-reference issues.
- **Constants first, then functions**: module-level data (prompts, schemas, cached singletons) lives above the function declarations that use it.
- **`function foo()` declarations** for named module-level functions, not `const foo = () => ...`. Arrow functions are fine inline for callbacks.
- **Full words for variable names**, not abbreviations or single letters: `frequency` not `hz`, `mode` not `m`, `megahertz` not `mhz`, `command` not `cmd`, `previousLine` not `last`. Trivial loop indices can stay short.
- **Path aliases** are configured per-package in each package's `tsconfig.json` — `@config/...`, `@chatbot/...`, `@enricher/...`, `@memory/...`, `@models/...`, `@rig/...` — and resolve inside the same package only. Cross-package imports use the workspace name (`@earshot/shared`). Same-folder imports stay relative (`./foo.js`). `tsc-alias -f` rewrites the aliases to relative `.js` specifiers at build time per package; `tsx` (dev) resolves them via the `--tsconfig` flag passed by the npm scripts.
- **Imports omit the `.js` extension on aliased paths** (`'@models/models'`), but keep it on relative paths (`'./state.js'`) — required because we use `moduleResolution: bundler` for permissive typecheck, and tsc-alias adds the extension at emit time for Node ESM compatibility.
- **SDK types directly**: use `MessageRole`, `SessionEvent`, `MemoryRecord`, `MemoryType` from `@redis-iris/agent-memory/models` rather than ad-hoc structural shapes. Two reasons: (a) source of truth lives in the SDK, no drift if the schema changes; (b) at the read site, IDE autocompletes all available fields if you ever want them.
- **Logging**: errors are logged inline via `console.error` at the call site (see Rig methods, `storeMemory`). No external logger; don't add one without a reason.
- Strict mode is on; no `any` cheats (with one deliberate exception in `enricher/graph.ts` where LangGraph's chained builder type is awkward).
- Default to no comments. Add `/* ... */` only when the _why_ isn't obvious from the code (e.g. protocol notes, ordering invariants). Don't write JSDoc / docstrings.

## What's next

1. **Curator agent** (`packages/curator/`) — a planned third process that turns the listener from a deterministic pipeline into one half of a true multi-agent system. The shape (see `memory/curator_agent_design.md`):
   - **Listener** stops calling `bulkCreateLongTermMemories` directly; instead `XADD`s each enriched transmission to a Redis Stream (`earshot:transmissions` or similar).
   - **Curator** is an LLM-driven agent (`createAgent` + tools) that consumes the stream via `XREADGROUP`, decides per-transmission whether to skip / promote as-is / batch related transmissions into a summary memory, and writes curated content to long-term memory.
   - **Chatbot** is unchanged — still queries long-term memory via `searchTranscripts`. It just sees curated content instead of raw transcripts.
2. **More non-radio listeners** — `packages/mic-listener/` is the first non-radio listener and shows the pattern. Future listeners (`packages/websdr-listener/`, room-mic variants, etc.) would import shared, provide their own metadata snapshotter where applicable, and their own enricher tuned to their domain.

3. **Single shared owner id.** The chatbot's `searchTranscripts` tool filters long-term memory by a single `listenerOwnerId`, and all three apps default it to `'earshot-listener'` so the chatbot treats both listeners' writes as one corpus. If you ever want to scope listeners under distinct owners and still have the chatbot see all of them, update the tool to filter with `ownerId: { in: [...] }` over multiple ids.
4. **TUI** — Ink TUI was previously planned (single-process app combining ingest + chat + status panes), but the multi-process split made it complicated (would need IPC to show live transcripts in the chatbot UI). Deferred indefinitely; all apps stay CLI-only for now.
