import { Rig } from '@rig/rig'
import { Band } from '@rig/bands'
import { Mode } from '@rig/modes'
import { captureUtterances } from './capture.js'
import { transcribe } from './transcribe.js'

export type Transcript = {
  text: string
  audioPath: string
  capturedAt: Date
  frequency: number | null
  mode: Mode | null
  band: Band | null
}

/* Yields each captured utterance as a Transcript: the text plus a snapshot
   of the rig's frequency, mode, and band taken the moment the WAV closes —
   not after transcription, which can take seconds. The capture pipeline's
   lifecycle is tied to the iteration: break (or .return()) cleanly tears it
   down via the finally block. */
export async function* listen(rig: Rig): AsyncIterableIterator<Transcript> {
  const controller = new AbortController()
  try {
    for await (const audioPath of captureUtterances(controller.signal)) {
      const capturedAt = new Date()
      const frequency = rig.frequency
      const mode = rig.mode
      const band = rig.band

      const text = await transcribe(audioPath)

      yield { text, audioPath, capturedAt, frequency, mode, band }
    }
  } finally {
    controller.abort()
  }
}
