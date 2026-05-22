import { createReadStream } from 'node:fs'
import dedent from 'dedent'
import { fetchSpeechToTextModel } from '@models/models'

/* Whisper prompt: focus on things the cleanup model can't recover from once
   Whisper gets them wrong — callsign letter/digit shapes, NATO phonetics
   (so spelled callsigns come through as discrete words), signal reports.
   The richer jargon (POTA, equipment, awards) is handled downstream in the
   workflow's correction node where there's no token cap. */
const WHISPER_PROMPT = dedent`
  Amateur radio QSO with spelled callsigns like K1ABC, W4XYZ, KD8ZZZ,
  VE3ABC, G0XYZ. Signal reports: 599, five by nine. Greetings: CQ, 73.
  Phonetics: Alfa, Bravo, Charlie, Delta, Echo, Foxtrot, Golf, Hotel,
  India, Juliet, Kilo, Lima, Mike, November, Oscar, Papa, Quebec, Romeo,
  Sierra, Tango, Uniform, Victor, Whiskey, X-ray, Yankee, Zulu.
`

export async function transcribe(wavPath: string): Promise<string> {
  const result = await fetchSpeechToTextModel().audio.transcriptions.create({
    file: createReadStream(wavPath),
    model: 'whisper-1',
    language: 'en',
    prompt: WHISPER_PROMPT
  })
  return result.text
}
