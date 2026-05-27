#!/usr/bin/env bash
# Capture audio from an avfoundation device and segment into one WAV per utterance.
# ffmpeg streams raw PCM; sox slices on silence and rotates files via its
# :newfile :restart effect chain. The first output is at $OUTPUT_TEMPLATE; sox
# auto-numbers subsequent files (e.g. utterance001.wav, utterance002.wav, ...).

set -euo pipefail

OUTPUT_TEMPLATE="${1:?usage: capture.sh OUTPUT_TEMPLATE [DEVICE]}"
AUDIO_DEVICE="${2:-0}"

# Bash doesn't forward signals to a foreground pipeline by default; kill our
# job group explicitly so ffmpeg + sox die when this script is signalled.
cleanup() { jobs -p | xargs -r kill 2>/dev/null || true; }
trap cleanup EXIT INT TERM

ffmpeg -hide_banner -loglevel error \
       -f avfoundation -i ":$AUDIO_DEVICE" \
       -ac 1 -ar 16000 -f s16le - \
  | sox -t raw -r 16000 -c 1 -b 16 -e signed-integer - \
        "$OUTPUT_TEMPLATE" \
        silence 1 0.1 1% 1 2.0 1% pad 0 0.5 \
        : newfile : restart
