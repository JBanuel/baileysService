import { toSightingTime } from './time.js'

const drafts = new Map()

const EXTRACTED_FIELDS = ['children_quantity', 'children_age', 'work_type', 'place']

const FREE_TEXT_FIELDS = ['description', 'more_details']

const REFUSAL = /^(no|nada|nada más|ninguno|ya|eso es todo|es todo)(,?\s*gracias)?[.!\s]*$/i

export function emptyDraft() {
    return {
        description: null,
        children_quantity: null,
        children_age: null,
        work_type: null,
        sighting_time: null,
        pending_time: null,
        latitude: null,
        longitude: null,
        place: null, 
        photos_asked: false,
        last_asked_field: null,
        approximation_asked: [],
        details_asked: false,
        defaults_used: [],
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

export function setLocation(draft, { lat, lng }) {
    const valid = Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180
    if (!valid) return draft
    return { ...draft, latitude: lat, longitude: lng }
}

export function mergeData(draft, data, message) {
    const next = { ...draft }

    for (const field of EXTRACTED_FIELDS) {
        if (data[field] !== null && data[field] !== undefined) next[field] = data[field]
    }

    mergeTime(next, draft, data)

    const broughtData =
        EXTRACTED_FIELDS.some((field) => data[field] !== null && data[field] !== undefined) ||
        Boolean(data.hour ?? data.period)
    const answeredStory = FREE_TEXT_FIELDS.includes(draft.last_asked_field) && !REFUSAL.test(message.trim())
    if (broughtData || answeredStory) next.description = next.description ? `${next.description}\n${message}` : message

    return next
}

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
