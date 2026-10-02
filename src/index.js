import { connectToWhatsApp } from './whatsapp/connection.js'

process.loadEnvFile()

await connectToWhatsApp({
    onMessage: (sock, msg) => {
        console.log(msg.phone, msg.type, msg.text)
        if (msg.phone !== process.env.NUMERO_PRUEBA) return
        sock.sendMessage(msg.jid, { text: msg.text })
    }
})