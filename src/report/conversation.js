import { deleteDraft, getDraft, mergeData, saveDraft, setLocation } from './draft.js'
import { extractData } from './extractor.js'
import { nextStep } from './rules.js'
import { writeReply } from './writer.js'

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
    const reply = await writeReply(step.action, step.draft, text ?? '(compartió una ubicación)')

    if (step.action.type === 'confirmed') {
        await deleteDraft(chatId)
    } else {
        await saveDraft(chatId, { ...step.draft, last_reply: reply })
    }

    return reply
}
