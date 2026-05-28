import dedent from 'dedent'
import { z } from 'zod'

import { fetchChatModel } from '@models/models'
import type { EnrichmentState } from '@enricher/state'

const PROMPT = dedent`
  Extract named entities from the following transcript. Return JSON
  matching the provided schema.

  Categories:
  - people: person names (first, last, full, nicknames).
  - places: cities, states, countries, regions, neighborhoods, named
    venues.
  - organizations: companies, clubs, agencies, named programs.

  Return empty arrays for categories with no matches.
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
