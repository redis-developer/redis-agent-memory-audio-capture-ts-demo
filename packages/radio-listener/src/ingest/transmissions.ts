import { captureUtterances, transcribe } from '@earshot/shared'

import { config } from '@config/config'
import { Rig } from '@rig/rig'
import { Band } from '@rig/bands'
import { Mode } from '@rig/modes'

export type CapturedTransmission = {
  text: string
  audioPath: string
  receivedAt: Date
  frequency: number | null
  mode: Mode | null
  band: Band | null
}

/* Yields each captured utterance as a CapturedTransmission: the text plus a
   snapshot of the rig's frequency, mode, and band taken the moment the WAV
   closes — not after transcription, which can take seconds. The capture
   pipeline's lifecycle is tied to the iteration: break (or .return()) cleanly
   tears it down via the finally block. */
export async function* captureTransmissions(): AsyncIterableIterator<CapturedTransmission> {
  const controller = new AbortController()

  const signal = controller.signal
  const options = {
    device: config.audio.device,
    outputDir: config.audio.outputDir
  }

  try {
    for await (const audioPath of captureUtterances(signal, options)) {
      const receivedAt = new Date()
      const rigData = rigState()
      const text = await transcribe(audioPath)

      yield { text, audioPath, receivedAt, ...rigData }
    }
  } finally {
    controller.abort()
  }
}

function rigState() {
  return {
    frequency: Rig.instance.frequency,
    mode: Rig.instance.mode,
    band: Rig.instance.band
  }
}
