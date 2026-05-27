import { createReadStream } from 'node:fs'
import OpenAI from 'openai'

let client: OpenAI.Audio.Transcriptions | null = null

export async function transcribe(wavPath: string): Promise<string> {
  /* Just get the client once */
  if (!client) {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) throw new Error('OPENAI_API_KEY not set')

    client = new OpenAI({ apiKey }).audio.transcriptions
  }

  /* Transcribe */
  const result = await client.create({
    file: createReadStream(wavPath),
    model: 'whisper-1',
    language: 'en'
  })

  /* Return */
  return result.text
}
