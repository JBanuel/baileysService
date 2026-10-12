import readline from 'node:readline/promises'
import { deleteDraft, getDraft } from '../report/draft.js'
import { handleMessage } from '../report/conversation.js'

const CHAT_ID = 'terminal'

const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
rl.on('close', () => process.exit(0))

console.log('Chat with Sipinnito. Commands: /location lat,lng · /draft · /reset · Ctrl+C to exit\n')

while (true) {
    const input = (await rl.question('you> ')).trim()
    if (!input) continue

    if (input === '/reset') {
        deleteDraft(CHAT_ID)
        console.log('(draft deleted)\n')
        continue
    }
    if (input === '/draft') {
        console.log(getDraft(CHAT_ID), '\n')
        continue
    }

    let message = { text: input }
    if (input.startsWith('/location')) {
        const [lat, lng] = input.replace('/location', '').split(',').map(Number)
        message = { location: { lat, lng } }
    }

    try {
        console.log(`bot> ${await handleMessage(CHAT_ID, message)}\n`)
    } catch (error) {
        console.error('error:', error.message, '\n')
    }
}
