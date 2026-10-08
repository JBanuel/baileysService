import { connectToWhatsApp } from './whatsapp/connection.js'

process.loadEnvFile()

await connectToWhatsApp({
    onMessage: (sock, msg) => {
        console.log(msg.phone, msg.type, msg.text)
        if (msg.phone !== process.env.TEST_PHONE_NUMBER) return
        sock.sendMessage(msg.jid, { text: msg.text })
    }
})