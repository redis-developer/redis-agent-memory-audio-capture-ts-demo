import dedent from 'dedent'
import { z } from 'zod'

import { fetchChatModel } from '@models/models'
import type { EnrichmentState } from '@enricher/state'

const PROMPT = dedent`
  Extract any frequencies mentioned in the following amateur radio
  transmission. Return JSON matching the provided schema.

  For each mention, return:
  - raw: the original phrasing exactly as it appears ("14.250",
    "two meters", "446.000 megahertz", "twenty meter band").
  - hz: the numeric frequency in Hertz if it is a specific value, or null
    if it is only a band reference.

  Numeric convention: bare numbers like "14.250" or "146.520" are MHz.
  Convert to Hz by multiplying by 1,000,000.

  Examples:
  - "14.250" → { raw: "14.250", hz: 14250000 }
  - "446.000" → { raw: "446.000", hz: 446000000 }
  - "146.520 megahertz" → { raw: "146.520 megahertz", hz: 146520000 }
  - "two meters" → { raw: "two meters", hz: null }
  - "twenty meter band" → { raw: "twenty meter band", hz: null }

  Return an empty array if no frequencies are mentioned.
`

const MentionSchema = z.object({
  raw: z.string(),
  hz: z.number().nullable()
})

const Schema = z.object({
  frequenciesMentioned: z.array(MentionSchema)
})

export type FrequencyMention = z.infer<typeof MentionSchema>

export async function frequenciesExtractor(state: EnrichmentState): Promise<Partial<EnrichmentState>> {
  const model = fetchChatModel().withStructuredOutput(Schema, { strict: true })
  const result = await model.invoke([
    { role: 'system', content: PROMPT },
    { role: 'user', content: state.correctedText }
  ])
  return { frequenciesMentioned: result.frequenciesMentioned }
}
