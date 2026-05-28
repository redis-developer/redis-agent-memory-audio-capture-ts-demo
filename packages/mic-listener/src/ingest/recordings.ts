import { captureUtterances, transcribe } from '@earshot/shared'

import { config } from '@config/config'

export type CapturedRecording = {
  text: string
  audioPath: string
  receivedAt: Date
}

/* Yields each captured utterance as a CapturedRecording: the text plus
   the wall-clock time the WAV closed — not when transcription finished,
   which can take seconds. The capture pipeline's lifecycle is tied to
   the iteration: break (or .return()) cleanly tears it down via the
   finally block. */
export async function* captureRecordings(): AsyncIterableIterator<CapturedRecording> {
  const controller = new AbortController()

  const signal = controller.signal
  const options = {
    device: config.audio.device,
    outputDir: config.audio.outputDir
  }

  try {
    for await (const audioPath of captureUtterances(signal, options)) {
      const receivedAt = new Date()
      const text = await transcribe(audioPath)

      yield { text, audioPath, receivedAt }
    }
  } finally {
    controller.abort()
  }
}
