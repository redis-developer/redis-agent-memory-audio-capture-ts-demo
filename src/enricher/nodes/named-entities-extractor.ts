import dedent from 'dedent'
import { z } from 'zod'

import { fetchChatModel } from '@models/models'
import type { EnrichmentState } from '@enricher/state'

const PROMPT = dedent`
  Extract named entities from the following amateur radio transmission
  transcript. Return JSON matching the provided schema.

  Categories:
  - people: person names (first, last, full, nicknames). Not callsigns.
  - places: cities, states, countries, regions, parks, summits, grid squares.
  - organizations: clubs, agencies, awards, and named programs (ARRL, POTA,
    SOTA, DXCC, FCC, ARES, etc.).

  Do NOT include callsigns — those are extracted separately. Do NOT include
  generic ham equipment terms (dipole, Yagi, HT). Return empty arrays for
  categories with no matches.
`

const Schema = z.object({
  people: z.array(z.string()),
  places: z.array(z.string()),
  organizations: z.array(z.string())
})

export type NamedEntities = z.infer<typeof Schema>

export async function namedEntitiesExtractor(state: EnrichmentState): Promise<Partial<EnrichmentState>> {
  const model = fetchChatModel().withStructuredOutput(Schema, { strict: true })
  const entities = await model.invoke([
    { role: 'system', content: PROMPT },
    { role: 'user', content: state.correctedText }
  ])
  return { entities }
}
