import { errorMessage, unsupportedMessage } from '../report/writer.js'

export function createMessageHandler({ handleMessage, resetConversation, allowedNumbers }) {
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
            reply = await replyTo(msg, handleMessage)
        } catch (error) {
            console.error('[bot] error:', error)
            reply = errorMessage()
        }

        await quietly(sock.sendPresenceUpdate('paused', msg.jid))
        await sock.sendMessage(msg.jid, { text: reply })
        console.log(`[bot] → ${msg.phone}: ${reply.split('\n')[0]}`)
    }
}

async function replyTo(msg, handleMessage) {
    if (msg.type === 'text') return handleMessage(msg.jid, { text: msg.text })
    if (msg.type === 'location') return handleMessage(msg.jid, { location: msg.location })

    const note = unsupportedMessage(msg.type)
    if (!msg.caption) return note
    return `${note}\n\n${await handleMessage(msg.jid, { text: msg.caption })}`
}

export function normalizePhone(phone) {
    if (!phone) return null
    const digits = String(phone).replace(/\D/g, '')
    return digits.length === 13 && digits.startsWith('521') ? `52${digits.slice(3)}` : digits
}

const quietly = (promise) => Promise.resolve(promise).catch(() => {})
