/**
 * Converts raw Baileys messages into the simple shape the bot works with.
 *
 * @module whatsapp/message_handler
 */

import { isPnUser, normalizeMessageContent, isLidUser, jidDecode } from "@whiskeysockets/baileys"

/**
 * Content of a message, by type.
 *
 * @typedef {object} MessageContent
 * @property {'text' | 'location' | 'image' | 'audio' | 'video' | 'document'} type
 * @property {string} [text] Text of a text message.
 * @property {{ lat: number, lng: number, name?: string, address?: string }} [location] Shared location.
 * @property {string} [caption] Caption of an image, video or document.
 * @property {string} [mimetype] MIME type of an image.
 */

/**
 * Extracts the content of a message. Live locations count as locations.
 *
 * @param {import('@whiskeysockets/baileys').proto.IMessage | null | undefined} msg
 * @returns {MessageContent | null} `null` for message types the bot does not handle.
 */
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

/**
 * A message from a person, ready for the bot.
 *
 * @typedef {MessageContent & {
 *   jid: string,
 *   phone: string | undefined,
 *   name: string | undefined,
 *   key: import('@whiskeysockets/baileys').WAMessageKey,
 *   raw: import('@whiskeysockets/baileys').WAMessage,
 * }} IncomingMessage
 * `jid` is the chat id; `phone` the sender's number, when known; `name` their
 * WhatsApp display name; `key` identifies the message (for read receipts) and
 * `raw` is the original message (to download media).
 */

/**
 * Parses a raw message. Text and captions are trimmed.
 *
 * The phone number is taken from the chat id, or from the alternate id when
 * the chat uses a LID (WhatsApp's privacy id) instead of the phone number.
 *
 * @param {import('@whiskeysockets/baileys').WAMessage} msg
 * @returns {IncomingMessage | null} `null` for the bot's own messages, chats
 *   that are not with a person, unsupported types and empty text.
 */
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