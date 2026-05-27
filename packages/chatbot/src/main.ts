import { createInterface } from 'node:readline/promises'
import chalk from 'chalk'

import { config } from '@config/config'
import { chat } from '@chatbot/chatbot'

process.on('SIGINT', () => {
  console.log(chalk.dim('\nstopping'))
  process.exit(0)
})

const repl = createInterface({ input: process.stdin, output: process.stdout })

console.log(chalk.dim('Earshot Chat Bot — Ctrl+C to stop\n'))

const user = config.userName
const userPrompt = `${chalk.cyan(user)}${chalk.dim('> ')}`
const botLabel = `${chalk.yellow('Earshot')}${chalk.dim('> ')}`

try {
  while (true) {
    const message = (await repl.question(userPrompt)).trim()
    if (message === '') continue
    const reply = await chat(user, message)
    console.log(`${botLabel}${reply}\n`)
  }
} catch (err) {
  console.error(chalk.red('error:'), (err as Error).message)
  process.exit(1)
}
