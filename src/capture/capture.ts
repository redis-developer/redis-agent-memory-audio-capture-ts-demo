import { spawn } from 'node:child_process'
import { mkdir, watch } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { config } from '@config/config'

const SCRIPT_PATH = fileURLToPath(new URL('./capture.sh', import.meta.url))

/* Spawns the capture pipeline (ffmpeg | sox) via ./capture.sh and yields each
   utterance WAV path as it's closed. Sox segments on silence with :newfile
   :restart. We yield the *previous* file when the next one is opened — that's
   when sox has just closed it, so it's complete on disk. The in-progress file
   at the time of abort is never yielded (it's empty: sox is sitting in
   skip-silence mode waiting for the next take). */
export async function* captureUtterances(signal: AbortSignal): AsyncIterableIterator<string> {
  /* Each session gets its own subdirectory. */
  const sessionId = new Date().toISOString().replace(/[:.]/g, '-')
  const sessionFolder = resolve(join(config.audio.outputDir, sessionId))
  await mkdir(sessionFolder, { recursive: true })

  /* Pattern for filenames—sox will append 001, 002, etc. to the filename. */
  const filenameTemplate = join(sessionFolder, 'utterance-.wav')

  /* Start watching the folder before spawning or we'll miss the first file. */
  const folderWatcher = watch(sessionFolder, { signal })

  /* Run the script */
  spawn(SCRIPT_PATH, [filenameTemplate, config.audio.device], { signal, stdio: 'inherit' })

  let currentFile: string | null = null
  try {
    /* Wait for events from the folder watcher */
    for await (const event of folderWatcher) {
      /* Ignore renames */
      if (event.eventType !== 'rename') continue

      /* Ignore anything not a .wav file */
      if (!event.filename?.endsWith('.wav')) continue

      /* We've found a new file, so yield the previous one (it's now closed) */
      const newFile = resolve(join(sessionFolder, event.filename))
      if (currentFile && currentFile !== newFile) yield currentFile
      currentFile = newFile
    }
  } catch (err) {
    if (signal.aborted) return
    throw err
  }
}
