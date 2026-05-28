import dedent from 'dedent'

import { config } from '@config/config'
import { fetchChatModel } from '@models/models'
import type { EnrichmentState } from '@enricher/state'

const BASE_PROMPT = dedent`
  You are cleaning up transcripts of everyday speech captured by an
  ambient microphone.

  Your job: fix obvious mistranscriptions and preserve everything else
  verbatim. Do not paraphrase, summarize, or invent content. If you are
  not confident a word is wrong, leave it alone. Output only the
  corrected transcript with no preamble or commentary.
`

const PROMPT = config.audio.locationContext
  ? dedent`
      ${BASE_PROMPT}

      Local context (use this to disambiguate proper nouns Whisper may
      have misheard — towns, people, businesses, organizations near the
      microphone):

      ${config.audio.locationContext}
    `
  : BASE_PROMPT

export async function textCorrector(state: EnrichmentState): Promise<Partial<EnrichmentState>> {
  const response = await fetchChatModel().invoke([
    { role: 'system', content: PROMPT },
    { role: 'user', content: state.text }
  ])
  const correctedText = typeof response.content === 'string' ? response.content.trim() : state.text
  return { correctedText }
}
