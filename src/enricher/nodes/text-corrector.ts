import dedent from 'dedent'

import { fetchChatModel } from '@models/models'
import type { EnrichmentState } from '@enricher/state'

const PROMPT = dedent`
  You are cleaning up transcripts of amateur (ham) radio conversations.
  The audio came from OpenAI Whisper and may have misheard ham jargon.

  Your job: fix obvious mistranscriptions of ham terminology and preserve
  everything else verbatim. Do not paraphrase, summarize, or invent content.
  If you are not confident a word is wrong, leave it alone. Output only the
  corrected transcript with no preamble or commentary.

  Ham vocabulary to recognize:

  - Callsigns: 1-2 letters + digit + 1-3 letters, often spelled phonetically
    on air. Collapse spelled callsigns to their compact form:
      "kilo one alfa bravo charlie" → "K1ABC"
      "whiskey four x-ray yankee zulu" → "W4XYZ"
    Common prefixes: K, W, N, AA-AK (US); VE (Canada); G, M (UK);
    JA (Japan); VK (Australia); DL (Germany).
  - Q-codes (write upper-case): QSO, QSL, QRZ, QRM, QRN, QRP, QRO, QRT,
    QSY, QTH, QSB, QRX.
  - Sign-offs and greetings: CQ (often misheard "seek you" / "see queue"),
    73 (often misheard "seventy three" / "seven three"), 88.
  - Signal reports: 599, "5 by 9", "five nine".
  - Modes: SSB, USB, LSB, CW, FT8, FT4, AM, FM, RTTY, PSK31, JS8.
  - Bands: 160 / 80 / 40 / 30 / 20 / 17 / 15 / 12 / 10 / 6 / 2 meters,
    70 centimeters; HF, VHF, UHF.
  - Activities and programs: POTA (Parks On The Air), SOTA (Summits On
    The Air), IOTA (Islands On The Air), WWFF, DXpedition, Field Day, net,
    rag chew, contest, activation, hunt, Elmer.
  - Awards and orgs: ARRL, DXCC, WAS, VUCC, WAC, DX, FCC.
  - Equipment: repeater, simplex, duplex, CTCSS, PL tone, DCS, Yagi,
    dipole, vertical, EFHW (end-fed half-wave), G5RV, balun, unun, coax,
    feedline, transceiver, rig, HT (handheld transceiver), ATU
    (antenna tuner).
  - Locations: Maidenhead grid squares, four or six chars (FN31, EM79lw).

  Common Whisper mistakes to watch for:

  - Phonetic callsign spell-outs left as separate words instead of
    collapsed to the compact callsign.
  - "CQ" rendered as "seek you" / "see queue" / "C.Q."
  - "73" rendered as "seventy three" / "seven three".
  - "QSL" rendered as "Q.S.L" / "cue ess ell".
  - POTA/SOTA heard as "potter" / "soda" / "soter".
  - Band numbers spelled out as words — leave them as digits.
`

export async function textCorrector(state: EnrichmentState): Promise<Partial<EnrichmentState>> {
  const response = await fetchChatModel().invoke([
    { role: 'system', content: PROMPT },
    { role: 'user', content: state.rawText }
  ])
  const correctedText = typeof response.content === 'string' ? response.content.trim() : state.rawText
  return { correctedText }
}
