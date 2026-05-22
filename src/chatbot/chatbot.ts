import dedent from 'dedent'
import { StateGraph, START, END } from '@langchain/langgraph'
import { createReactAgent } from '@langchain/langgraph/prebuilt'

import { fetchChatModel } from '@models/models'
import { Rig } from '@rig/rig'

import { ChatbotStateAnnotation } from './state.js'
import { tuneRig } from './tools/tune-rig.js'

const SYSTEM_PROMPT = dedent`
  You are ham-buddy, an assistant for an amateur radio operator. The user
  is talking to you to control their Yaesu FT-991 transceiver and to ask
  about ham radio.

  You have a tool, tuneRig, that changes the rig's frequency and/or mode.
  Frequencies must be passed in hertz — convert from MHz or kHz before
  calling. Modes are one of: LSB, USB, CW, FM, AM, RTTY, RTTYR, CWR,
  PKTLSB, PKTUSB, PKTFM, C4FM.

  Be brief. Confirm tool actions in plain language.
`

export function buildChatbot(rig: Rig) {
  const agent = createReactAgent({
    llm: fetchChatModel(),
    tools: [tuneRig(rig)],
    prompt: SYSTEM_PROMPT
  })

  const builder = new StateGraph(ChatbotStateAnnotation) as any
  builder.addNode('agent', agent)
  builder.addEdge(START, 'agent')
  builder.addEdge('agent', END)

  return builder.compile()
}
