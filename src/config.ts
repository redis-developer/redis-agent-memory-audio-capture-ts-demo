import 'dotenv/config'

export const config = {
  openai: {
    apiKey: env('OPENAI_API_KEY')
  },
  memory: {
    host: env('MEMORY_API_HOST'),
    apiKey: env('MEMORY_API_KEY'),
    storeId: env('MEMORY_STORE_ID')
  },
  rig: {
    port: env('RIG_PORT'),
    baud: Number(env('RIG_BAUD')),
    model: Number(env('RIG_MODEL'))
  },
  audio: {
    device: env('AUDIO_DEVICE', '0'),
    outputDir: env('AUDIO_OUTPUT_DIR', './captures')
  }
} as const

export type Config = typeof config

function env(name: string, fallback?: string): string {
  const v = process.env[name]
  if (v !== undefined && v !== '') return v
  return fallback ?? ''
}
