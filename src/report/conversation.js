/**
 * Processes one message of a conversation from start to finish: reads the
 * data, updates the draft, decides what comes next and writes the reply. When
 * the person confirms the summary, it sends the report to the SIPINNA API.
 *
 * @module report/conversation
 */

import { createApiClient } from '../api/sipinnaApi.js'
import { API_URL } from '../config.js'
import { deleteDraft, getDraft, mergeData, saveDraft, setLocation } from './draft.js'
import { extractData } from './extractor.js'
import { MAX_PHOTOS, deletePhotos, loadPhotos, savePhoto } from './photoStore.js'
import { nextStep } from './rules.js'
import { sendReport } from './send.js'
import { confirmedMessage, sendFailedMessage, writeReplyParts } from './writer.js'

const api = createApiClient(API_URL)

/**
 * Processes one message and returns the reply for the person.
 *
 * @param {string} chatId Id of the chat, used as the draft key.
 * @param {object} message What the person sent. Only one of `text`,
 *   `location` or `image` is expected.
 * @param {string} [message.text] Text of the message.
 * @param {{ lat: number, lng: number }} [message.location] Shared location.
 * @param {{ buffer: Buffer, contentType: string }} [message.image] Received photo.
 * @param {string} [message.caption] Caption of the photo; read like a text message.
 * @returns {Promise<string>} The reply to send.
 */
export async function handleMessage(chatId, { text, location, image, caption }) {
    let draft = await getDraft(chatId)
    let data = { emergency: false }
    const message = text ?? caption

    if (location) {
        draft = setLocation(draft, location)
        data = { ...data, location: true }
    } else if (message) {
        data = await extractData(message, draft.last_reply ?? undefined)
        draft = mergeData(draft, data, message)
    }

    if (image) {
        const received = await receivePhoto(draft, image)
        draft = received.draft
        data = { ...data, photo: received.status }
    }

    const step = nextStep(draft, data)

    if (step.action.type === 'confirmed') return sendConfirmed(chatId, step.draft)

    const reply = await writeReplyParts(step.action, step.draft, message ?? '(compartió una ubicación o una foto)')
    await saveDraft(chatId, { ...step.draft, last_reply: reply.question })
    return reply.text
}

/**
 * Discards a chat's draft and the photos it holds.
 * @param {string} chatId
 * @returns {Promise<void>}
 */
export async function resetConversation(chatId) {
    const draft = await getDraft(chatId)
    await deletePhotos(draft.photos)
    await deleteDraft(chatId)
}

/**
 * Saves a received photo and adds it to the draft, unless the draft already
 * has {@link MAX_PHOTOS}.
 *
 * @param {import('./draft.js').Draft} draft
 * @param {{ buffer: Buffer, contentType: string }} image
 * @returns {Promise<{ draft: import('./draft.js').Draft, status: 'accepted' | 'too_many' }>}
 */
async function receivePhoto(draft, { buffer, contentType }) {
    if (draft.photos.length >= MAX_PHOTOS) return { draft, status: 'too_many' }

    const photo = await savePhoto(buffer, contentType)
    return { draft: { ...draft, photos: [...draft.photos, photo] }, status: 'accepted' }
}

/**
 * Sends the confirmed report. On success the draft and its photos are deleted.
 * On failure the draft is kept, together with whatever was already created in
 * the API, and goes back to the summary so a new "sí" retries the send.
 *
 * @param {string} chatId
 * @param {import('./draft.js').Draft} draft
 * @returns {Promise<string>} The confirmation or the failure message.
 */
async function sendConfirmed(chatId, draft) {
    let progress = draft
    try {
        const { folio } = await sendReport({
            api,
            draft,
            photos: await loadPhotos(draft.photos),
            saveProgress: async (updated) => {
                progress = updated
                await saveDraft(chatId, updated)
            },
        })
        await deletePhotos(draft.photos)
        await deleteDraft(chatId)
        return confirmedMessage(folio)
    } catch (error) {
        console.error('[api] could not send the report:', error.message)
        const reply = sendFailedMessage()
        await saveDraft(chatId, { ...progress, confirmed: false, last_asked_field: 'summary', last_reply: reply })
        return reply
    }
}
