/**
 * Terminal chat with the bot, to try conversations without WhatsApp
 * (`npm run chat`). Uses the same conversation logic and Redis drafts as the bot.
 *
 * Commands:
 * - `/location lat,lng` shares a location.
 * - `/draft` prints the current draft.
 * - `/reset` deletes the draft.
 *
 * @module llm/cli_chat
 */

import readline from 'node:readline/promises'
import { deleteDraft, getDraft } from '../report/draft.js'
import { handleMessage } from '../report/conversation.js'
import { initDraftStore } from '../report/draftStore.js'

/**
 * Chat id of the terminal conversation in the draft store.
 */
const CHAT_ID = 'terminal'

await initDraftStore()

const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
rl.on('close', () => process.exit(0))

console.log('Chat with Sipinnito. Commands: /location lat,lng · /draft · /reset · Ctrl+C to exit\n')

while (true) {
    const input = (await rl.question('you> ')).trim()
    if (!input) continue

    if (input === '/reset') {
        await deleteDraft(CHAT_ID)
        console.log('(draft deleted)\n')
        continue
    }
    if (input === '/draft') {
        console.log(await getDraft(CHAT_ID), '\n')
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
