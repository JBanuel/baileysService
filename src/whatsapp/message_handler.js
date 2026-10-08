import { isPnUser, normalizeMessageContent, isLidUser, jidDecode } from "@whiskeysockets/baileys"

function extractContent(msg) {
    const content = normalizeMessageContent(msg)
    if (!content) return null

    var plainText = ""
    
    if (content.conversation !== null && content.conversation !== undefined) {
        plainText = content.conversation
    } else {
        plainText = content.extendedTextMessage?.text
    }

    if (plainText) return {type: 'text', text: plainText}
    
    const location = content.locationMessage ?? content.liveLocationMessage

    if (location){
        return {
            type: 'location', 
            location: {
                lat: location.degreesLatitude,
                lng: location.degreesLongitude,
                name: location.name || undefined,
                address: location.address || undefined,
            },
        }
    }

    if (content.imageMessage) return {
        type: 'image',
        caption: content.imageMessage.caption, 
        mimetype: content.imageMessage.mimetype
    }

    if (content.audioMessage) return { type: 'audio' }
    if (content.videoMessage) return { type: 'video', caption: content.videoMessage.caption }
    if (content.documentMessage) return { type: 'document', caption: content.documentMessage.caption }

    return null 
}

export function parseIncoming(msg){
    const jid = msg.key.remoteJid
    if (!jid)  return null
    if (msg.key.fromMe) return null

    if (!isPnUser(jid) && !isLidUser(jid)) return null
    
    const content = extractContent(msg.message)
    if(!content) return null

    if (content.type === 'text') {
        content.text = content.text.trim()
        if (!content.text) return null
    }

    if (content.caption) content.caption = content.caption.trim()
    
    const pnJid = isPnUser(jid) ? jid : msg.key.remoteJidAlt
    const phone = pnJid ? jidDecode(pnJid)?.user : undefined

    return {
        ...content, 
        jid,
        phone,
        name: msg.pushName ?? undefined, 
        key: msg.key,
        raw:msg
    }
}