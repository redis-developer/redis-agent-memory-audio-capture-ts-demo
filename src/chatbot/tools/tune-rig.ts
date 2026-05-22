import dedent from 'dedent'
import { z } from 'zod'
import { tool } from '@langchain/core/tools'

import { Rig } from '@rig/rig'
import { Mode } from '@rig/modes'

const DESCRIPTION = dedent`
  Tune the radio by setting its frequency, mode, or both. Provide at least
  one of frequency or mode. Frequencies are in hertz — convert from MHz
  before calling (14.250 MHz is 14250000).
`

const Schema = z.object({
  frequency: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('Frequency in hertz. 14.250 MHz is 14250000.'),
  mode: z
    .enum(Mode)
    .optional()
    .describe('Modulation mode. One of LSB, USB, CW, FM, AM, RTTY, RTTYR, CWR, PKTLSB, PKTUSB, PKTFM, C4FM.')
})

export function tuneRig(rig: Rig) {
  return tool(
    async (input: z.infer<typeof Schema>) => {
      const changes: string[] = []
      if (input.frequency !== undefined) {
        rig.frequency = input.frequency
        changes.push(`frequency ${(input.frequency / 1_000_000).toFixed(6)} MHz`)
      }
      if (input.mode !== undefined) {
        rig.mode = input.mode
        changes.push(`mode ${input.mode}`)
      }
      if (changes.length === 0) return 'No change — provide frequency, mode, or both.'
      return `Tuned: ${changes.join(', ')}.`
    },
    {
      name: 'tuneRig',
      description: DESCRIPTION,
      schema: Schema
    }
  )
}
