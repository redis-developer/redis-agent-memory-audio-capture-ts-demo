# AGENTS.md

Ham-buddy is an agent that controls a Yaesu FT-991 ham radio, listens to its received audio, transcribes what it hears, enriches each transmission with structured fields, stores the result in agent memory, and answers questions about what was said on the air.

## Stack

| Concern               | Choice                                                                                       | Status  |
| --------------------- | -------------------------------------------------------------------------------------------- | ------- |
| Runtime               | Node 24, TypeScript (ESM), `tsx` to run                                                      | done    |
| Audio capture         | `ffmpeg \| sox` shell pipeline, sox segments on silence                                      | done    |
| STT                   | OpenAI Whisper API (raw — cleanup moved to the enricher graph)                               | done    |
| Listener              | `listen()` async generator combining capture + transcribe + rig tag                          | done    |
| Radio                 | Yaesu FT-991 via hamlib's `rigctld` (spawned subprocess + TCP)                               | done    |
| Enricher              | LangGraph.js workflow: correction → fan-out to NER / callsigns+roles / frequencies (gpt-4o-mini, strict JSON schema via Zod) | done    |
| Memory                | Redis Agent Memory REST API (private preview)                                                | not yet |
| Chatbot               | LangGraph.js chat agent with rig-control + memory-query tools                                | not yet |
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
npm run dev                # full pipeline via tsx watch (dev loop)
npm run build && npm start # full pipeline from compiled output (dist/)
```

The FT-991 enumerates as two USB-serial devices; pick the right one for `RIG_PORT`. See "FT-991 specifics" below.

## How to verify a change

There is no automated test suite. Verify changes by:

- **typecheck / build** — `npm run build` runs `tsc && tsc-alias -f`, emitting JS to `dist/`. The `tsc-alias` step rewrites the TypeScript path aliases (`@capture/...` etc.) into relative paths Node ESM can resolve, and appends `.js` extensions. Use it to catch type errors; `npm start` runs the compiled output.
- **dev loop** — `npm run dev` runs `src/main.ts` directly via `tsx watch`, restarting on file changes. tsx resolves path aliases natively.
- **full pipeline** — either `npm run dev` or `npm run build && npm start`: connects to the rig, iterates `listen(rig)`, feeds each transcript through `enrichTransmission`, and prints each `EnrichedTransmission`.

The full pipeline needs real hardware connected (rig + audio). If you can't run it, say so — don't claim a change is verified.

## File layout

```
src/
  capture/
    capture.sh         bash pipeline: ffmpeg → sox, segments on silence
    capture.ts         async generator wrapping capture.sh; yields WAV paths
    transcribe.ts      OpenAI Whisper transcription (raw output)
    listen.ts          joins capture + transcribe + rig snapshot → Transcript stream
  config/
    config.ts          dotenv-loaded config
  enricher/
    enricher.ts        entry point: enrichTransmission(input) → EnrichedTransmission
    graph.ts           LangGraph StateGraph wiring (correct → fan out → end)
    state.ts           EnricherStateAnnotation + EnricherState type
    nodes/
      text-corrector.ts             ham-aware cleanup of Whisper output
      named-entities-extractor.ts   people, places, organizations
      callsigns-extractor.ts        callsigns + sender/receiver/mentioned roles
      frequencies-extractor.ts      frequencies mentioned in text → Hz
  models/
    models.ts          fetchChatModel() (ChatOpenAI) + fetchSpeechToTextModel() (OpenAI); cached
  rig/
    rig.ts             Rig class — polls rigctld, exposes freq/mode/band
    rigctld-socket.ts  spawns rigctld, speaks its line-based TCP protocol
    bands.ts           Band enum + bandFor(frequency)
    modes.ts           Mode enum mirroring hamlib's mode strings
  main.ts              entrypoint — connects rig, iterates listen(rig), enriches, prints
  scripts/             setup-time discovery utilities (devices)
captures/              session output, one timestamped subdir per run (gitignored)
```

## Runtime data flow

Three stages, met in `main.ts`:

- **Capture + transcribe**: `capture.sh` (long-lived ffmpeg | sox) → `captureUtterances()` yields WAV paths → `transcribe(path)` returns raw Whisper text → `listen(rig)` bundles each into a `Transcript` with a rig-state snapshot.
- **Rig**: `Rig.connect()` spawns `rigctld` and opens a TCP socket via `RigCtlD_Socket` → `Rig` polls `+f` and `+m` every 100 ms, keeping `frequency` / `mode` / `band` fresh on the instance.
- **Enrich**: `main.ts` feeds each `Transcript` into `enrichTransmission(input)` from `@enricher/enricher`, which runs the LangGraph workflow and returns an `EnrichedTransmission` (raw + corrected text + entities + callsigns + frequencies mentioned + the input metadata).

`listen(rig)` is the capture/rig join: for each WAV path from `captureUtterances`, snapshot `rig.frequency`/`rig.mode`/`rig.band` immediately (before the slow transcribe call), then await `transcribe()`, then `yield` a `Transcript`. Consumers do `for await (const transcript of listen(rig))`.

## Architecture notes

### Audio capture

One long-lived bash pipeline. ffmpeg streams raw PCM (s16le, 16 kHz mono — matches Whisper's internal input rate, no point sampling higher) to sox, which uses the `silence` effect with `:newfile :restart` to write one WAV per take. Each session creates its own timestamped subdirectory under `captures/`. Sox auto-numbers files within it (`utterance-001.wav`, `utterance-002.wav`, ...).

`captureUtterances()` is an async generator. It yields a WAV path _when the next file is opened_ — that's when sox has just closed the previous one, so it's safe to read. The in-progress file at abort time is never yielded (it's empty: sox is sitting in skip-silence mode waiting for the next take).

### Why a bash pipeline instead of two Node-spawned processes?

A persistent ffmpeg with per-utterance spawned sox processes failed: subsequent sox processes saw EOF on stdin ~80 ms in, with no clear cause. Sox's own `:newfile :restart` chain sidesteps the problem — one sox process owns the whole session, segmentation is internal.

### Enricher graph

The enricher is a LangGraph `StateGraph` defined in `src/enricher/graph.ts`. State is declared once in `state.ts` (`EnricherStateAnnotation`) and carries only the fields nodes read or write: `rawText`, `correctedText`, `entities`, `callsigns`, `frequenciesMentioned`. Each node takes `EnricherState` and returns `Partial<EnricherState>`.

Topology: `START → text-corrector → { named-entities-extractor, callsigns-extractor, frequencies-extractor } → END`. The three extractors run in parallel; LangGraph waits for all of them before terminating.

`enrichTransmission()` in `enricher.ts` is the invocation layer: it invokes the compiled graph with just `{ rawText }`, then composes the final `EnrichedTransmission` by spreading the rig metadata from the input alongside the graph's output. The rig metadata never enters the graph — it's orthogonal to the graph's concern.

Each extractor node owns its Zod schema and its inferred type (`Callsigns`, `FrequencyMention`, `NamedEntities`). `state.ts` imports those types. Extractors use `chat().withStructuredOutput(Schema, { strict: true })` so OpenAI's decoder is constrained to produce schema-valid output.

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
- **Path aliases**: cross-folder imports use `@capture/...`, `@config/...`, `@enricher/...`, `@models/...`, `@rig/...` rather than `../../foo.js`. Same-folder imports stay relative (`./foo.js`). The aliases are configured in `tsconfig.json` paths; `tsc-alias -f` rewrites them to relative `.js` specifiers at build time. `tsx` (dev) resolves them natively.
- **Imports omit the `.js` extension on aliased paths** (`'@models/models'`), but keep it on relative paths (`'./state.js'`) — required because we use `moduleResolution: bundler` for permissive typecheck, and tsc-alias adds the extension at emit time for Node ESM compatibility.
- **Logging**: errors are logged inline via `console.error` at the call site (see Rig methods). No external logger; don't add one without a reason.
- Strict mode is on; no `any` cheats (with one deliberate exception in `enricher/graph.ts` where LangGraph's chained builder type is awkward).
- Default to no comments. Add `/* ... */` only when the _why_ isn't obvious from the code (e.g. protocol notes, ordering invariants). Don't write JSDoc / docstrings.

## What's next

Remaining "not yet" rows from the Stack table, in order:

1. **Memory** — Redis Agent Memory REST client. POST each `EnrichedTransmission` (from `enrichTransmission()`) to `/v1/stores/{storeId}/session-memory`, recall via `/long-term-memory/search`. Auth: `Bearer <API_KEY>`. Env vars `MEMORY_API_HOST` / `MEMORY_API_KEY` / `MEMORY_STORE_ID` are already wired through `config.ts`.
2. **Chatbot** — LangGraph chat agent with tools: `setFrequency`, `setMode`, `getRigStatus`, `recallMemory`, `searchTranscripts`. This is where the natural-language frequency parsing ("tune to 14.250 USB" → `rig.frequency = 14_250_000; rig.mode = Mode.USB`) lives. Lives at `src/chatbot/` as a peer to `src/enricher/`.
3. **UI** — Ink TUI. Single-process app combining the listener loop, the chat agent, and three panes: chat / live transcripts / rig status.
