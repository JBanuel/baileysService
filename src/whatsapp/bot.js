/**
 * Turns incoming WhatsApp messages into replies: checks the allowlist, handles
 * `/reset`, shows "typing…" and sends whatever the conversation answers.
 *
 * @module whatsapp/bot
 */

import { errorMessage, unsupportedMessage } from '../report/writer.js'

/**
 * Creates the handler for incoming messages. Dependencies are injected so the
 * handler can be tested without WhatsApp, Redis or the model.
 *
 * @param {object} deps
 * @param {typeof import('../report/conversation.js').handleMessage} deps.handleMessage Processes one message and returns the reply.
 * @param {typeof import('../report/conversation.js').resetConversation} deps.resetConversation Discards the chat's draft and photos.
 * @param {string[]} deps.allowedNumbers Phone numbers allowed to use the bot.
 * @param {(sock: import('@whiskeysockets/baileys').WASocket, msg: import('./message_handler.js').IncomingMessage) => Promise<Buffer>} deps.downloadImage
 *   Downloads the image of an image message.
 * @returns {(sock: import('@whiskeysockets/baileys').WASocket, msg: import('./message_handler.js').IncomingMessage) => Promise<void>}
 *   Handler that answers one message. Errors while building the reply are
 *   logged and answered with a generic apology.
 */
export function createMessageHandler({ handleMessage, resetConversation, allowedNumbers, downloadImage }) {
    const allowed = new Set(allowedNumbers.map(normalizePhone))

    return async function onMessage(sock, msg) {
        if (!allowed.has(normalizePhone(msg.phone))) {
            console.log(`[wa] ignored message from …${String(msg.phone ?? msg.jid).slice(-4)} (not in ALLOWED_NUMBERS)`)
            return
        }
        console.log(`[wa] ${msg.phone} (${msg.type}): ${msg.text ?? msg.caption ?? ''}`)

        if (msg.type === 'text' && msg.text.toLowerCase() === '/reset') {
            await resetConversation(msg.jid)
            await sock.sendMessage(msg.jid, { text: 'Listo, empecemos de nuevo.' })
            return
        }

        await quietly(sock.readMessages([msg.key]))
        await quietly(sock.sendPresenceUpdate('composing', msg.jid))

        let reply
        try {
            reply = await replyTo(sock, msg, { handleMessage, downloadImage })
        } catch (error) {
            console.error('[bot] error:', error)
            reply = errorMessage()
        }

        await quietly(sock.sendPresenceUpdate('paused', msg.jid))
        await sock.sendMessage(msg.jid, { text: reply })
        console.log(`[bot] → ${msg.phone}: ${reply.split('\n')[0]}`)
    }
}

/**
 * Builds the reply for a message according to its type. Audio, video and
 * documents are not processed; if they carry a caption, the caption is
 * answered after the note saying so.
 *
 * @param {import('@whiskeysockets/baileys').WASocket} sock
 * @param {import('./message_handler.js').IncomingMessage} msg
 * @param {object} deps
 * @param {typeof import('../report/conversation.js').handleMessage} deps.handleMessage
 * @param {(sock: import('@whiskeysockets/baileys').WASocket, msg: import('./message_handler.js').IncomingMessage) => Promise<Buffer>} deps.downloadImage
 * @returns {Promise<string>}
 */
async function replyTo(sock, msg, { handleMessage, downloadImage }) {
    if (msg.type === 'text') return handleMessage(msg.jid, { text: msg.text })
    if (msg.type === 'location') return handleMessage(msg.jid, { location: msg.location })
    if (msg.type === 'image') {
        const buffer = await downloadImage(sock, msg)
        return handleMessage(msg.jid, { image: { buffer, contentType: msg.mimetype ?? 'image/jpeg' }, caption: msg.caption })
    }

    const note = unsupportedMessage(msg.type)
    if (!msg.caption) return note
    return `${note}\n\n${await handleMessage(msg.jid, { text: msg.caption })}`
}

/**
 * Reduces a phone number to digits so numbers can be compared. Mexican mobile
 * numbers that arrive with the old `1` after the country code (`521…`, 13
 * digits) are rewritten as `52…`.
 *
 * @param {string | number | null | undefined} phone
 * @returns {string | null} The digits, or `null` when there is no number.
 */
export function normalizePhone(phone) {
    if (!phone) return null
    const digits = String(phone).replace(/\D/g, '')
    return digits.length === 13 && digits.startsWith('521') ? `52${digits.slice(3)}` : digits
}

/**
 * Waits for a non-essential call (read receipts, presence) and ignores its errors.
 * @param {unknown} promise
 * @returns {Promise<unknown>}
 */
const quietly = (promise) => Promise.resolve(promise).catch(() => {})
