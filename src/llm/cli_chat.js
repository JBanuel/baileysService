import readline from 'node:readline/promises'
import { chat } from './ollama.js'
import { buildSystemPrompt } from './prompt.js'

const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
rl.on('close', () => process.exit(0))

const messages = [
    { role: 'system', content: buildSystemPrompt({ user: { name: 'system' } }) },
]

while (true) {
    const text = (await rl.question('you> ')).trim()
    if (!text) continue

    messages.push({ role: 'user', content: text })
    const reply = await chat(messages)
    messages.push({ role: 'assistant', content: reply })

    console.log(`bot> ${reply}\n`)
}