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
  listenerOwnerId: env('LISTENER_OWNER_ID', 'earshot-listener'),
  audio: {
    device: env('RADIO_AUDIO_DEVICE', '0'),
    outputDir: env('RADIO_AUDIO_OUTPUT_DIR', './captures/radio'),
    locationContext: env('RADIO_AUDIO_LOCATION_CONTEXT', '')
  },
  rig: {
    port: env('RIG_PORT'),
    baud: Number(env('RIG_BAUD')),
    model: Number(env('RIG_MODEL'))
  }
} as const

export type Config = typeof config

function env(name: string, fallback?: string): string {
  const value = process.env[name]
  if (value !== undefined && value !== '') return value
  return fallback ?? ''
}
