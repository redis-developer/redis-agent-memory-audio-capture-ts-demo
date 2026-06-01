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
    device: env('MIC_AUDIO_DEVICE', '0'),
    outputDir: env('MIC_AUDIO_OUTPUT_DIR', './captures/mic'),
    locationContext: env('MIC_AUDIO_LOCATION_CONTEXT', '')
  }
} as const

export type Config = typeof config

function env(name: string, fallback?: string): string {
  const value = process.env[name]
  if (value !== undefined && value !== '') return value
  return fallback ?? ''
}
