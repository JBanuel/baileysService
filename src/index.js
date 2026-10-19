/**
 * Entry point of the WhatsApp bot.
 *
 * Connects to Redis, schedules the hourly cleanup of abandoned photos, and
 * connects to WhatsApp. Incoming messages are queued per chat so each person's
 * messages are answered one at a time, in order.
 *
 * @module index
 */

import { downloadMediaMessage } from '@whiskeysockets/baileys'
import { ALLOWED_NUMBERS } from './config.js'
import { handleMessage, resetConversation } from './report/conversation.js'
import { initDraftStore } from './report/draftStore.js'
import { deleteOldPhotos } from './report/photoStore.js'
import { createMessageHandler } from './whatsapp/bot.js'
import { connectToWhatsApp, logger } from './whatsapp/connection.js'
import { enqueue } from './whatsapp/queue.js'

try {
    await initDraftStore()
} catch (error) {
    console.error(`[bot] ${error.message}\n      With Docker: open Docker Desktop and run "docker start sipinna-redis"`)
    process.exit(1)
}

if (ALLOWED_NUMBERS.length === 0) console.warn('[bot] ALLOWED_NUMBERS is empty in .env: the bot will not answer anyone')

/**
 * Deletes photos older than a day and logs the result. Errors are logged, never thrown.
 * @returns {Promise<void>}
 */
const cleanPhotos = () =>
    deleteOldPhotos()
        .then((deleted) => deleted && console.log(`[photos] deleted ${deleted} old photo(s)`))
        .catch((error) => console.error('[photos] cleanup failed:', error.message))
cleanPhotos()
setInterval(cleanPhotos, 60 * 60 * 1000).unref()

const onMessage = createMessageHandler({
    handleMessage,
    resetConversation,
    allowedNumbers: ALLOWED_NUMBERS,
    downloadImage: (sock, msg) =>
        downloadMediaMessage(msg.raw, 'buffer', {}, { logger, reuploadRequest: sock.updateMediaMessage }),
})

await connectToWhatsApp({
    onMessage: (sock, msg) =>
        enqueue(msg.jid, () => onMessage(sock, msg)).catch((error) => console.error('[bot] could not reply:', error)),
})
