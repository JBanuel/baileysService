import { TEST_PHONE_NUMBER } from './config.js'
import { connectToWhatsApp } from './whatsapp/connection.js'

await connectToWhatsApp({
    onMessage: (sock, msg) => {
        console.log(msg.phone, msg.type, msg.text)
        if (msg.phone !== TEST_PHONE_NUMBER) return
        sock.sendMessage(msg.jid, { text: msg.text })
    }
})