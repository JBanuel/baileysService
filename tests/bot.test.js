import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createMessageHandler, normalizePhone } from '../src/whatsapp/bot.js'

const ALLOWED = '5215500000000'

// A socket that records what the bot sends instead of talking to WhatsApp
function fakeSocket() {
    const sent = []
    return {
        sent,
        readMessages: async () => {},
        sendPresenceUpdate: async () => {},
        sendMessage: async (jid, content) => sent.push({ jid, text: content.text }),
    }
}

function setup({ handleMessage = async () => 'respuesta del bot' } = {}) {
    const calls = []
    const resets = []
    const onMessage = createMessageHandler({
        handleMessage: async (chatId, input) => {
            calls.push({ chatId, input })
            return handleMessage(chatId, input)
        },
        resetConversation: (chatId) => resets.push(chatId),
        allowedNumbers: [ALLOWED],
        downloadImage: async () => Buffer.from('imagen'),
    })
    return { onMessage, calls, resets, sock: fakeSocket() }
}

const message = (fields) => ({ jid: 'chat-1@lid', phone: ALLOWED, key: {}, ...fields })

test('numbers that are not allowed get no answer', async () => {
    const { onMessage, calls, sock } = setup()
    await onMessage(sock, message({ phone: '5219999999999', type: 'text', text: 'hola' }))

    assert.equal(calls.length, 0)
    assert.equal(sock.sent.length, 0)
})

test('a text message goes to the bot and its reply is sent', async () => {
    const { onMessage, calls, sock } = setup()
    await onMessage(sock, message({ type: 'text', text: 'vi a dos niños' }))

    assert.deepEqual(calls, [{ chatId: 'chat-1@lid', input: { text: 'vi a dos niños' } }])
    assert.deepEqual(sock.sent, [{ jid: 'chat-1@lid', text: 'respuesta del bot' }])
})

test('a shared location goes to the bot as a location', async () => {
    const { onMessage, calls, sock } = setup()
    await onMessage(sock, message({ type: 'location', location: { lat: 19.57, lng: -99.24 } }))

    assert.deepEqual(calls[0].input, { location: { lat: 19.57, lng: -99.24 } })
    assert.equal(sock.sent.length, 1)
})

test('an audio gets a note and does not reach the bot', async () => {
    const { onMessage, calls, sock } = setup()
    await onMessage(sock, message({ type: 'audio' }))

    assert.equal(calls.length, 0)
    assert.match(sock.sent[0].text, /no puedo escuchar audios/)
})

test('a photo is downloaded and goes to the bot with its caption', async () => {
    const { onMessage, calls, sock } = setup()
    await onMessage(sock, message({ type: 'image', mimetype: 'image/jpeg', caption: 'estos niños venden chicles aquí' }))

    assert.deepEqual(calls[0].input, {
        image: { buffer: Buffer.from('imagen'), contentType: 'image/jpeg' },
        caption: 'estos niños venden chicles aquí',
    })
    assert.equal(sock.sent[0].text, 'respuesta del bot')
})

test('a video gets a note and does not reach the bot', async () => {
    const { onMessage, calls, sock } = setup()
    await onMessage(sock, message({ type: 'video' }))

    assert.equal(calls.length, 0)
    assert.match(sock.sent[0].text, /no puedo recibir videos/)
})

test('if the bot fails, the person gets an apology instead of silence', async () => {
    const { onMessage, sock } = setup({
        handleMessage: async () => {
            throw new Error('Ollama is not running')
        },
    })
    await onMessage(sock, message({ type: 'text', text: 'hola' }))

    assert.match(sock.sent[0].text, /tuve un problema/)
})

test('/reset deletes the draft', async () => {
    const { onMessage, calls, resets, sock } = setup()
    await onMessage(sock, message({ type: 'text', text: '/reset' }))

    assert.deepEqual(resets, ['chat-1@lid'])
    assert.equal(calls.length, 0)
    assert.match(sock.sent[0].text, /empecemos de nuevo/)
})

test('if read receipts or "typing…" fail, the reply is still sent', async () => {
    const { onMessage } = setup()
    const sock = fakeSocket()
    sock.readMessages = async () => {
        throw new Error('not connected')
    }
    sock.sendPresenceUpdate = async () => {
        throw new Error('not connected')
    }
    await onMessage(sock, message({ type: 'text', text: 'hola' }))

    assert.equal(sock.sent[0].text, 'respuesta del bot')
})

test('Mexican numbers match with or without the 1 after 52', () => {
    assert.equal(normalizePhone('5215512345678'), '525512345678')
    assert.equal(normalizePhone('525512345678'), '525512345678')
    assert.equal(normalizePhone('+52 1 55 1234 5678'), '525512345678')
    assert.equal(normalizePhone(undefined), null)
})

test('a number in the other Mexican format is still allowed', async () => {
    const { onMessage, calls } = setup()
    await onMessage(fakeSocket(), message({ phone: '525500000000', type: 'text', text: 'hola' }))

    assert.equal(calls.length, 1)
})

test('a message without phone number is ignored', async () => {
    const { onMessage, calls } = setup()
    await onMessage(fakeSocket(), message({ phone: undefined, type: 'text', text: 'hola' }))

    assert.equal(calls.length, 0)
})
