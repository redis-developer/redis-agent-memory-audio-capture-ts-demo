import dedent from 'dedent'
import { z } from 'zod'

import { fetchChatModel } from '@models/models'
import type { EnrichmentState } from '@enricher/state'

const PROMPT = dedent`
  Extract amateur radio callsigns from the following transmission and
  assign roles. Return JSON matching the provided schema.

  Callsign format: 1-2 letters + digit + 1-3 letters (e.g. K1ABC, W4XYZ,
  VE3ABC, G0XYZ). Use the compact form as it appears in the transcript.

  Roles:
  - sender: the station transmitting. Often appears after "this is" or
    "de" (CW shorthand for "from"). In a hail like "K1ABC W1AW", the
    sender is the LAST callsign.
  - receiver: the station being called. Often the FIRST callsign in a hail.
    If the sender is calling CQ (a general call), set receiver to null.
  - mentioned: any other callsigns referenced (spotting, signal reports
    about a third station, etc.). Do not duplicate sender/receiver here.

  Examples:
  - "CQ CQ CQ this is K1ABC" → sender K1ABC, receiver null
  - "W1AW de K1ABC" → sender K1ABC, receiver W1AW
  - "K1ABC W1AW" → sender W1AW, receiver K1ABC
  - "Just worked W4XYZ on twenty" → sender null, receiver null,
    mentioned [W4XYZ]

  If you cannot confidently identify sender or receiver, use null.
  Do not guess.
`

const Schema = z.object({
  sender: z.string().nullable(),
  receiver: z.string().nullable(),
  mentioned: z.array(z.string())
})

export type Callsigns = z.infer<typeof Schema>

export async function callsignsExtractor(state: EnrichmentState): Promise<Partial<EnrichmentState>> {
  const model = fetchChatModel().withStructuredOutput(Schema, { strict: true })
  const callsigns = await model.invoke([
    { role: 'system', content: PROMPT },
    { role: 'user', content: state.correctedText }
  ])
  return { callsigns }
}
