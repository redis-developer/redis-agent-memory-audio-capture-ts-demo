import { spawn } from 'node:child_process'
import { SerialPort } from 'serialport'

interface AudioDevice {
  index: string
  name: string
}

await listAudioDevices()
console.log('')
await listSerialPorts()

async function listAudioDevices(): Promise<void> {
  const devices = await fetchAvfoundationAudioDevices()
  if (devices.length === 0) {
    console.log('audio devices (avfoundation): none found')
    return
  }
  console.log('audio devices (avfoundation):')
  for (const device of devices) {
    console.log(`  [${device.index}] ${device.name}`)
  }
  console.log('  → set MIC_AUDIO_DEVICE / RADIO_AUDIO_DEVICE in .env to the index (e.g. "1") or the device name (e.g. "USB Audio CODEC")')
}

async function listSerialPorts(): Promise<void> {
  const ports = await SerialPort.list()
  if (ports.length === 0) {
    console.log('serial ports: none found')
    return
  }
  console.log('serial ports:')
  for (const port of ports) {
    const details = [port.manufacturer, port.serialNumber].filter(Boolean).join(' · ')
    const callUpPath = port.path.replace('/dev/tty.', '/dev/cu.')
    console.log(`  ${callUpPath}${details ? `  (${details})` : ''}`)
  }
  console.log('  → set RIG_PORT in .env to the FT-991 Enhanced port (CAT). The Standard port is for RTS / PTT keying.')
  console.log('    Use the /dev/cu.* path, not /dev/tty.* — tty blocks on open waiting for DCD, which the rig never asserts.')
  console.log('    (Audio is on a separate USB sound card — see the audio devices listed above.)')
}

function fetchAvfoundationAudioDevices(): Promise<AudioDevice[]> {
  return new Promise((resolvePromise, rejectPromise) => {
    const proc = spawn('ffmpeg', ['-hide_banner', '-f', 'avfoundation', '-list_devices', 'true', '-i', ''])
    let stderr = ''
    proc.stderr.on('data', chunk => {
      stderr += chunk.toString()
    })
    proc.on('error', err => {
      const hint =
        (err as NodeJS.ErrnoException).code === 'ENOENT' ? ' Is ffmpeg installed? Try: brew install ffmpeg' : ''
      rejectPromise(new Error(`Failed to run ffmpeg:${hint}`))
    })
    proc.on('exit', () => resolvePromise(parseAudioDevices(stderr)))
  })
}

function parseAudioDevices(stderr: string): AudioDevice[] {
  const devices: AudioDevice[] = []
  let inAudioSection = false
  for (const line of stderr.split('\n')) {
    if (/AVFoundation video devices/i.test(line)) {
      inAudioSection = false
      continue
    }
    if (/AVFoundation audio devices/i.test(line)) {
      inAudioSection = true
      continue
    }
    if (!inAudioSection) continue
    const match = line.match(/\[(\d+)\]\s+(.+?)\s*$/)
    if (match && match[1] && match[2]) devices.push({ index: match[1], name: match[2] })
  }
  return devices
}
