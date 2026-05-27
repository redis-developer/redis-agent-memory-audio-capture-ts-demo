import { ulid } from 'ulid'

import { AgentMemory } from '@redis-iris/agent-memory'

import { config } from '@config/config'

export const agentMemory = new AgentMemory({
  serverURL: config.memory.host,
  storeId: config.memory.storeId,
  apiKey: config.memory.apiKey
})

export const sessionId = ulid()
