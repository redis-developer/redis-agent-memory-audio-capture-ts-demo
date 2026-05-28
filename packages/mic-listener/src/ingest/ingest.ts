import { ulid } from 'ulid'

import { MemoryType } from '@redis-iris/agent-memory/models'

import { config } from '@config/config'
import { agentMemory } from '@memory/client'
import { enrichRecording } from '@enricher/enricher'

import { captureRecordings } from './recordings.js'
import { formatRecording } from './format.js'

export async function ingest(): Promise<void> {
  for await (const recording of captureRecordings()) {
    const enriched = await enrichRecording(recording)
    const recordingAsText = formatRecording(enriched)
    logRecording(recordingAsText, recording.audioPath, enriched.text)
    await storeMemory(recordingAsText)
  }
}

function logRecording(description: string, audioPath: string, rawText: string): void {
  console.log(description)
  console.log('-----')
  console.log(`Audio path: ${audioPath}`)
  console.log(`Raw text:\n${rawText}`)
  console.log('')
}

async function storeMemory(description: string): Promise<void> {
  const id = ulid()
  const text = description
  const memoryType = MemoryType.Episodic
  const ownerId = config.listenerOwnerId

  try {
    await agentMemory.bulkCreateLongTermMemories({
      memories: [{ id, text, memoryType, ownerId }]
    })
  } catch (err) {
    console.error('store memory failed:', err)
  }
}
