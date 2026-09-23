import makeWASocket, { useMultiFileAuthState } from '@whiskeysockets/baileys'
import qrcode from 'qrcode-terminal'
import { DisconnectReason } from '@whiskeysockets/baileys'

const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys')

async function connectToWhatsApp() {
const sock = makeWASocket({
    auth: state
})

sock.ev.on('connection.update', ({ qr }) => {
    if (qr) qrcode.generate(qr, { small: true })
})

sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect } = update
    if (connection === 'close') {
        const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut
        console.log('connection closed due to', lastDisconnect?.error, ', reconnecting:', shouldReconnect)
        if (shouldReconnect) {
            connectToWhatsApp()
        }
    } else if (connection === 'open') {
        console.log('opened connection')
    }
})

sock.ev.on('messages.upsert', async (event) => {
    if (event.type !== 'notify') return
    for (const m of event.messages) {
        if (m.key.fromMe) continue
        const jid = m.key.remoteJid
        if(!jid) continue
        console.log(jid, "Send a message")
    }
})

sock.ev.on('creds.update', saveCreds)
}
connectToWhatsApp()