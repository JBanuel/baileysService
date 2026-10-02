import makeWASocket, { useMultiFileAuthState, DisconnectReason, isJidBroadcast, isJidNewsletter, isJidGroup } from '@whiskeysockets/baileys'
import qrcode from 'qrcode-terminal'
import { parseIncoming } from './message_handler.js'
import pino from 'pino'

export const logger = pino({level: 'warn'})

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