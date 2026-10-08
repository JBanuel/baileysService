import { toSightingTime } from './time.js'

// Report drafts, one per conversation. In-memory for now; in brick 3 getDraft, saveDraft and deleteDraft move to Redis.
const drafts = new Map()

// Fields copied straight from extractData()
const EXTRACTED_FIELDS = ['children_quantity', 'children_age', 'work_type', 'place']

// Fields that can't be left as "No sé"
const REQUIRED_FIELDS = ['description', 'children_quantity', 'children_age', 'work_type', 'sighting_time', 'place']

// Field names match the database payload
export function emptyDraft() {
    return {
        description: null,
        children_quantity: null,
        children_age: null,
        work_type: null,
        sighting_time: null,
        pending_time: null,
        place: null,
        photos_asked: false,
        last_asked_field: null,
    }
}

export function getDraft(id) {
    return drafts.get(id) ?? emptyDraft()
}

export function saveDraft(id, draft) {
    drafts.set(id, draft)
}

export function deleteDraft(id) {
    drafts.delete(id)
}

/**
 * Returns a new draft with the extracted data merged in (the original is not modified).
 * @param {object} draft    current draft
 * @param {object} data     what extractData() returned
 * @param {string} message  what the person wrote
 */
export function mergeData(draft, data, message) {
    const next = { ...draft }

    // New data fills or corrects a field. A null never erases what was already there.
    for (const field of EXTRACTED_FIELDS) {
        if (data[field] !== null && data[field] !== undefined) next[field] = data[field]
    }

    mergeTime(next, draft, data)

    // "No sé" answers the last question, so it isn't asked again (except for required fields).
    const asked = draft.last_asked_field
    if (data.dont_know && asked && !REQUIRED_FIELDS.includes(asked) && next[asked] === null) {
        next[asked] = 'No sé'
    }

    // Every message that brings report data is added to the description, in the person's own words.
    const broughtData =
        EXTRACTED_FIELDS.some((field) => data[field] !== null && data[field] !== undefined) ||
        Boolean(data.hour ?? data.period)
    if (broughtData) next.description = next.description ? `${next.description}\n${message}` : message

    return next
}

// If there was a pending time ("a las 5") and now only the period arrives ("de la tarde"), they are combined.
function mergeTime(next, draft, data) {
    const { hour = null, minutes = null, period = null } = data
    const completesPending = hour === null && period !== null && draft.pending_time !== null

    const { time, pending } = completesPending
        ? toSightingTime({ ...draft.pending_time, period })
        : toSightingTime({ hour, minutes, period })

    if (time) {
        next.sighting_time = time
        next.pending_time = null
    } else if (pending) {
        next.pending_time = pending
    }
}
