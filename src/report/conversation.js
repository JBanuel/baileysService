import { createApiClient } from '../api/sipinnaApi.js'
import { API_URL } from '../config.js'
import { deleteDraft, getDraft, mergeData, saveDraft, setLocation } from './draft.js'
import { extractData } from './extractor.js'
import { MAX_PHOTOS, deletePhotos, loadPhotos, savePhoto } from './photoStore.js'
import { nextStep } from './rules.js'
import { sendReport } from './send.js'
import { confirmedMessage, sendFailedMessage, writeReplyParts } from './writer.js'

const api = createApiClient(API_URL)

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

export async function resetConversation(chatId) {
    const draft = await getDraft(chatId)
    await deletePhotos(draft.photos)
    await deleteDraft(chatId)
}

async function receivePhoto(draft, { buffer, contentType }) {
    if (draft.photos.length >= MAX_PHOTOS) return { draft, status: 'too_many' }

    const photo = await savePhoto(buffer, contentType)
    return { draft: { ...draft, photos: [...draft.photos, photo] }, status: 'accepted' }
}

async function sendConfirmed(chatId, draft) {
    let progress = draft
    try {
        await sendReport({
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
        return confirmedMessage()
    } catch (error) {
        console.error('[api] could not send the report:', error.message)
        const reply = sendFailedMessage()
        await saveDraft(chatId, { ...progress, confirmed: false, last_asked_field: 'summary', last_reply: reply })
        return reply
    }
}
