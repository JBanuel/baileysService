/**
 * WhatsApp connection through Baileys, linked as a device of the bot's number.
 *
 * @module whatsapp/connection
 */

import makeWASocket, { useMultiFileAuthState, DisconnectReason, isJidBroadcast, isJidNewsletter, isJidGroup } from '@whiskeysockets/baileys'
import qrcode from 'qrcode-terminal'
import { parseIncoming } from './message_handler.js'
import pino from 'pino'

/**
 * Logger shared with Baileys; only warnings and errors are printed.
 */
export const logger = pino({level: 'warn'})

/**
 * Connects to WhatsApp and delivers incoming messages to `onMessage`.
 *
 * Credentials are kept in `auth_info_baileys/`; on the first run a QR code is
 * printed to link the device. Groups, broadcasts and newsletters are ignored.
 * When the connection closes it reconnects on its own, unless the device was
 * logged out.
 *
 * @param {object} options
 * @param {(sock: import('@whiskeysockets/baileys').WASocket, msg: import('./message_handler.js').IncomingMessage) => void} options.onMessage
 *   Called for each new message from a person.
 * @returns {Promise<import('@whiskeysockets/baileys').WASocket>} The connected socket.
 */
export async function connectToWhatsApp({ onMessage }) {
    
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys')
    const sock = makeWASocket({
        auth: state,
        logger,
        shouldIgnoreJid: (jid) => isJidBroadcast(jid) || isJidNewsletter(jid) || isJidGroup(jid),
    })

    sock.ev.on('creds.update', saveCreds)

    sock.ev.on('connection.update', ({ qr }) => {
        if (qr) qrcode.generate(qr, { small: true })
    })

    sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect } = update
    if (connection === 'close') {
        const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut
        console.log('connection closed due to', lastDisconnect?.error, ', reconnecting:', shouldReconnect)
        if (shouldReconnect) {
            connectToWhatsApp({ onMessage })
        }
    } else if (connection === 'open') {
        console.log('opened connection')
    }
    })

    sock.ev.on('messages.upsert', ({ type, messages }) => {
        if (type !== 'notify') return
        for (const msg of messages) {
            const incoming = parseIncoming(msg)
            if (incoming) onMessage(sock, incoming)
        }
    })

    return sock
}