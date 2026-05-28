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
  listenerOwnerId: env('LISTENER_OWNER_ID', 'earshot-mic-listener'),
  audio: {
    device: env('AUDIO_DEVICE', '0'),
    outputDir: env('AUDIO_OUTPUT_DIR', './captures'),
    locationContext: env('AUDIO_LOCATION_CONTEXT', '')
  }
} as const

export type Config = typeof config

function env(name: string, fallback?: string): string {
  const value = process.env[name]
  if (value !== undefined && value !== '') return value
  return fallback ?? ''
}
