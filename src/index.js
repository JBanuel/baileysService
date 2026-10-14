import { ALLOWED_NUMBERS } from './config.js'
import { handleMessage } from './report/conversation.js'
import { deleteDraft } from './report/draft.js'
import { initDraftStore } from './report/draftStore.js'
import { createMessageHandler } from './whatsapp/bot.js'
import { connectToWhatsApp } from './whatsapp/connection.js'
import { enqueue } from './whatsapp/queue.js'

try {
    await initDraftStore()
} catch (error) {
    console.error(`[bot] ${error.message}\n      With Docker: open Docker Desktop and run "docker start sipinna-redis"`)
    process.exit(1)
}

if (ALLOWED_NUMBERS.length === 0) console.warn('[bot] ALLOWED_NUMBERS is empty in .env: the bot will not answer anyone')

const onMessage = createMessageHandler({ handleMessage, resetConversation: deleteDraft, allowedNumbers: ALLOWED_NUMBERS })

await connectToWhatsApp({
    onMessage: (sock, msg) =>
        enqueue(msg.jid, () => onMessage(sock, msg)).catch((error) => console.error('[bot] could not reply:', error)),
})
