import { REVIEW_STEPS, bringsReportData } from './draft.js'
import { toSightingTime } from './time.js'

const ORDER = ['description', 'work_type', 'children_quantity', 'children_age', 'time_period', 'sighting_time', 'location']

const APPROXIMATIONS = {
    work_type: ['vendiendo algo', 'pidiendo dinero', 'limpiando parabrisas', 'cargando cosas'],
    children_quantity: ['2', '5', '10', '20'],
    children_age: ['menos de 5 años', 'como 7', 'como 10', 'como 13', 'como 16'],
    sighting_time: ['en la mañana', 'en la tarde', 'en la noche'],
}

const DEFAULTS = {
    work_type: () => ({ work_type: 'No sé' }),
    children_quantity: () => ({ children_quantity: 1 }),
    children_age: () => ({ children_age: 'No sé' }),
    time_period: (draft) => ({ sighting_time: guessTime(draft.pending_time), pending_time: null }),
    sighting_time: (draft, now) => ({ sighting_time: currentTime(now) }),
}

const MIN_DESCRIPTION_WORDS = 15

export function nextStep(draft, data, now = new Date()) {
    if (data.emergency) return { draft: { ...draft, last_asked_field: null }, action: { type: 'emergency' } }

    let next = { ...draft }
    const asked = draft.last_asked_field

    if (REVIEW_STEPS.includes(asked)) {
        if (data.intent === 'confirm') {
            return { draft: { ...next, confirmed: true, last_asked_field: null }, action: { type: 'confirmed' } }
        }
        if (data.intent === 'other') return { draft: next, action: { type: 'off_topic' } }
        if (data.intent === 'add') return { draft: next, action: { type: 'summary', added_details: true, defaults_used: next.defaults_used } }

        if (!bringsReportData(data)) {
            if (!data.correction_field) return ask(next, { field: 'correction' })
            next = clearField(next, data.correction_field)
        }
    }

    if (asked && isMissing(next, asked)) {
        if (APPROXIMATIONS[asked] && !next.approximation_asked.includes(asked)) {
            next.approximation_asked = [...next.approximation_asked, asked]
            return ask(next, { field: asked, options: APPROXIMATIONS[asked] })
        }
        if (DEFAULTS[asked]) {
            next = { ...next, ...DEFAULTS[asked](next, now), defaults_used: [...next.defaults_used, asked] }
        }
    }

    const missing = ORDER.find((field) => isMissing(next, field))
    if (missing) return ask(next, { field: missing, help: missing === asked })

    if (wordCount(next.description) < MIN_DESCRIPTION_WORDS && !next.details_asked) {
        return ask({ ...next, details_asked: true }, { field: 'more_details' })
    }

    return {
        draft: { ...next, last_asked_field: 'summary' },
        action: { type: 'summary', defaults_used: next.defaults_used },
    }
}

function ask(draft, { field, help = false, options }) {
    const action = { type: 'ask', field }
    if (help) action.help = true
    if (options) action.options = options
    return { draft: { ...draft, last_asked_field: field }, action }
}

function clearField(draft, field) {
    const cleared = {
        ...draft,
        approximation_asked: draft.approximation_asked.filter((f) => f !== field),
        defaults_used: draft.defaults_used.filter((f) => f !== field),
    }
    if (field === 'location') return { ...cleared, latitude: null, longitude: null }
    if (field === 'sighting_time') return { ...cleared, sighting_time: null, pending_time: null }
    return { ...cleared, [field]: null }
}

function isMissing(draft, field) {
    if (field === 'time_period') return draft.pending_time !== null
    if (field === 'sighting_time') return draft.sighting_time === null && draft.pending_time === null
    if (field === 'location') return draft.latitude === null || draft.longitude === null
    if (field === 'more_details') return false
    return draft[field] === null
}

function guessTime({ hour, minutes }) {
    const period = hour >= 6 && hour <= 11 ? 'morning' : hour === 12 ? 'noon' : 'afternoon'
    return toSightingTime({ hour, minutes, period }).time
}

function currentTime(now) {
    return new Intl.DateTimeFormat('en-GB', {
        timeZone: 'America/Mexico_City',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
    }).format(now)
}

const wordCount = (text) => (text ? text.trim().split(/\s+/).length : 0)
