import { sessionId } from '@memory/client'

import { graph } from './graph.js'

export async function chat(username: string, message: string): Promise<string> {
  return await graph.invoke({
    sessionId,
    username,
    userMessage: message
  }).responseMessage
}
