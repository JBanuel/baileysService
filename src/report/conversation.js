import { createApiClient } from '../api/sipinnaApi.js'
import { API_URL } from '../config.js'
import { deleteDraft, getDraft, mergeData, saveDraft, setLocation } from './draft.js'
import { extractData } from './extractor.js'
import { nextStep } from './rules.js'
import { sendReport } from './send.js'
import { confirmedMessage, sendFailedMessage, writeReply } from './writer.js'

const api = createApiClient(API_URL)

export async function handleMessage(chatId, { text, location }) {
    let draft = await getDraft(chatId)
    let data = { emergency: false }

    if (location) {
        draft = setLocation(draft, location)
    } else {
        data = await extractData(text, draft.last_reply ?? undefined)
        draft = mergeData(draft, data, text)
    }

    const step = nextStep(draft, data)

    if (step.action.type === 'confirmed') return sendConfirmed(chatId, step.draft)

    const reply = await writeReply(step.action, step.draft, text ?? '(compartió una ubicación)')
    await saveDraft(chatId, { ...step.draft, last_reply: reply })
    return reply
}

async function sendConfirmed(chatId, draft) {
    let progress = draft
    try {
        await sendReport({
            api,
            draft,
            saveProgress: async (updated) => {
                progress = updated
                await saveDraft(chatId, updated)
            },
        })
        await deleteDraft(chatId)
        return confirmedMessage()
    } catch (error) {
        console.error('[api] could not send the report:', error.message)
        const reply = sendFailedMessage()
        await saveDraft(chatId, { ...progress, confirmed: false, last_asked_field: 'summary', last_reply: reply })
        return reply
    }
}
