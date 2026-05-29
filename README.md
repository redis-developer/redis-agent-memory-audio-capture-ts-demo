# Earshot

Earshot is a multi-agent demo of [Redis Agent Memory](https://redis.io/agent-memory/). Independent listener processes capture audio from ambient sources, transcribe and enrich it, and write each utterance to long-term memory. A separate chatbot reads from that same memory store and answers questions about what was heard.

The project ships with two listeners:

- **mic-listener** — captures from any microphone. No special hardware needed.
- **radio-listener** — captures from a Yaesu FT-991 amateur radio via hamlib's `rigctld`. Extracts callsigns, frequencies, and other ham-radio metadata.

The three processes (`mic-listener`, `radio-listener`, `chatbot`) are independent. Each can run on its own. They never talk directly — all coordination happens through the shared Agent Memory store.

> If you don't own a radio, you can still run the full demo using the mic-listener and chatbot. The radio-listener is optional.

## Prerequisites

- **Node.js 24** (see [.nvmrc](.nvmrc))
- **ffmpeg** and **sox** — audio capture pipeline
- **hamlib** — only needed for the radio-listener (provides `rigctld`)
- A **Redis Agent Memory** store (host, store ID, API key) — [sign up free at redis.io/try-free](https://redis.io/try-free/)
- An **OpenAI API key** — used for Whisper transcription and the chat / enricher models

On macOS:

```sh
brew install ffmpeg sox hamlib
```

## Setup

```sh
cp .env.example .env       # then fill in the values
npm install
npm run build
```

Open [.env](.env) and set at minimum:

- `MEMORY_API_HOST`, `MEMORY_API_KEY`, `MEMORY_STORE_ID` — your Agent Memory store
- `OPENAI_API_KEY` — your OpenAI key
- `USER_NAME` — who you are to the chatbot (your name or callsign)
- `AUDIO_DEVICE` — your microphone (required for either listener)

If you're running the radio-listener, also set `RIG_PORT`, `RIG_BAUD`, and `RIG_MODEL`.

To discover device names and serial ports on your machine:

```sh
npm run devices
```

This lists audio inputs (use one for `AUDIO_DEVICE`) and serial ports (use one for `RIG_PORT`).

## Running

Each command runs one of the three processes. Open a separate terminal for each.

```sh
npm run chat               # chatbot REPL — no hardware needed
npm run mic-listen         # mic capture loop — needs audio only
npm run radio-listen       # radio capture loop — needs rig + audio
```

There are matching `:dev` scripts (`chat:dev`, `mic-listen:dev`, `radio-listen:dev`) that run from TypeScript sources via `tsx` and skip the build step.

### Path A — without a radio

Best for getting started. In one terminal, capture ambient audio from your mic:

```sh
npm run mic-listen
```

Talk near the microphone. Each utterance prints to stdout and is written to long-term memory.

In a second terminal, open the chatbot:

```sh
npm run chat
```

Ask it about what was said. It calls `searchTranscripts` under the hood and pulls matching memories from the store.

> By default the mic-listener writes under owner id `earshot-mic-listener` and the chatbot only searches `earshot-listener` (the radio listener's default). To make the chatbot see mic-listener memories, set `LISTENER_OWNER_ID` to the same value in both processes' environment.

### Path B — with a Yaesu FT-991

Same idea, but pulls from the radio:

```sh
npm run radio-listen       # in one terminal
npm run chat               # in another
```

The radio-listener spawns `rigctld`, polls frequency and mode every 100 ms, and snapshots that metadata with each captured transmission. The enricher additionally extracts callsigns and frequency mentions from the transcribed text.

FT-991 specifics:

- The rig enumerates as **two** USB-serial devices. The CAT port is the one you want for `RIG_PORT`. `npm run devices` lists both — confirm by trial.
- On macOS, use the `/dev/cu.*` path, not `/dev/tty.*`.

## Environment variables

See [.env.example](.env.example) for the complete list with comments. Summary:

| Variable                 | Purpose                                                         |
| ------------------------ | --------------------------------------------------------------- |
| `MEMORY_API_HOST`        | Redis Agent Memory endpoint                                     |
| `MEMORY_API_KEY`         | Redis Agent Memory API key                                      |
| `MEMORY_STORE_ID`        | Redis Agent Memory store ID                                     |
| `OPENAI_API_KEY`         | OpenAI key — Whisper + chat models                              |
| `USER_NAME`              | Your identity in chatbot sessions                               |
| `LISTENER_OWNER_ID`      | Optional — override the listener's default owner id             |
| `AUDIO_DEVICE`           | Audio input device name or avfoundation index                   |
| `AUDIO_OUTPUT_DIR`       | Where captured WAVs go (default `./captures`)                   |
| `AUDIO_LOCATION_CONTEXT` | Optional — free-form location hints to help correct transcripts |
| `RIG_PORT`               | Serial port for `rigctld` (radio-listener only)                 |
| `RIG_BAUD`               | Serial baud rate (radio-listener only)                          |
| `RIG_MODEL`              | Hamlib rig model number — see `rigctl --list`                   |

## Project layout

```
packages/
  shared/            audio capture + Whisper transcription
  mic-listener/      generic mic capture loop
  radio-listener/    FT-991 capture loop + rig client + ham-aware enricher
  chatbot/           REPL with searchTranscripts tool
scripts/
  devices.ts         lists audio inputs and serial ports
captures/            timestamped WAVs per session (gitignored)
```

For a deep dive on architecture, data flow, and design decisions, see [.github/copilot-instructions.md](.github/copilot-instructions.md).

## License

MIT
