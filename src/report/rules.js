/**
 * Decides what the bot does next with a draft: which field to ask, when to
 * offer approximate options or use a default value, and when to show the
 * summary or send the report. All of it is code, never the model.
 *
 * @module report/rules
 */

import { REVIEW_STEPS, bringsReportData } from './draft.js'
import { MAX_PHOTOS } from './photoStore.js'
import { toSightingTime } from './time.js'

/**
 * Order in which missing fields are asked.
 */
const ORDER = ['description', 'work_type', 'children_quantity', 'children_age', 'time_period', 'sighting_time', 'location', 'photos']

/**
 * Steps in which the bot is waiting for photos.
 */
const PHOTO_STEPS = ['photos', 'more_photos']

/**
 * Options offered the first time a person does not know the answer to a field.
 */
const APPROXIMATIONS = {
    work_type: ['vendiendo algo', 'pidiendo dinero', 'limpiando parabrisas', 'cargando cosas'],
    children_quantity: ['2', '5', '10', '20'],
    children_age: ['menos de 5 años', 'como 7', 'como 10', 'como 13', 'como 16'],
    sighting_time: ['en la mañana', 'en la tarde', 'en la noche'],
}

/**
 * Values used when a person still does not know after being offered options.
 * They are flagged in the summary so the person can correct them.
 */
const DEFAULTS = {
    work_type: () => ({ work_type: 'No sé' }),
    children_quantity: () => ({ children_quantity: 1 }),
    children_age: () => ({ children_age: 'No sé' }),
    time_period: (draft) => ({ sighting_time: guessTime(draft.pending_time), pending_time: null }),
    sighting_time: (draft, now) => ({ sighting_time: currentTime(now) }),
}

/**
 * Shorter descriptions get one invitation to tell a bit more.
 */
const MIN_DESCRIPTION_WORDS = 15

/**
 * What the bot does next.
 *
 * - `ask`: ask `field`. With `options`, offer them as approximate answers;
 *   with `help`, the field was already asked and needs a different explanation.
 * - `summary`: show the summary. `defaults_used` lists approximated fields;
 *   `added_details` says the person just added something.
 * - `confirmed`: the person confirmed; send the report.
 * - `courtesy`: answer a greeting or thanks.
 * - `off_topic`: refer the person somewhere else.
 * - `photo_rejected`: a photo was not saved, for the given `reason`.
 *
 * Any action can also carry `emergency` (show the 911 notice first) and
 * `photo_ack` (number of photos received, to acknowledge the last one).
 * `reviewing` says whether the person was reviewing the summary.
 *
 * @typedef {object} Action
 * @property {'ask' | 'summary' | 'confirmed' | 'courtesy' | 'off_topic' | 'photo_rejected'} type
 * @property {string} [field]
 * @property {boolean} [help]
 * @property {string[]} [options]
 * @property {string[]} [defaults_used]
 * @property {boolean} [added_details]
 * @property {boolean} [reviewing]
 * @property {'too_many'} [reason]
 * @property {boolean} [emergency]
 * @property {number} [photo_ack]
 */

/**
 * The updated draft and what to do with it.
 * @typedef {object} Step
 * @property {import('./draft.js').Draft} draft
 * @property {Action} action
 */

/**
 * What happened in this message: the extracted data, plus whether a location
 * was shared or a photo received.
 *
 * @typedef {Partial<import('./extractor.js').ExtractedData> & {
 *   location?: boolean,
 *   photo?: 'accepted' | 'too_many',
 * }} TurnData
 */

/**
 * Decides the next step after a message. The 911 notice is added only the
 * first time a message describes an emergency.
 *
 * @param {import('./draft.js').Draft} draft Draft with the message's data already merged.
 * @param {TurnData} data
 * @param {Date} [now] Current time, used when the sighting time defaults to now.
 * @returns {Step}
 */
export function nextStep(draft, data, now = new Date()) {
    if (data.photo === 'too_many') return { draft, action: { type: 'photo_rejected', reason: 'too_many' } }

    const emergency = data.emergency && !draft.emergency_notified
    const step = decide(emergency ? { ...draft, emergency_notified: true } : draft, data, now)
    if (emergency) step.action.emergency = true
    if (data.photo === 'accepted') step.action.photo_ack = step.draft.photos.length
    return step
}

/**
 * Decides the next step, in this order: photos, courtesy and off-topic
 * messages, the summary review, a missing answer to the last question
 * (options first, then a default value), the next missing field, an
 * invitation to tell more and, last, the summary.
 *
 * @param {import('./draft.js').Draft} draft
 * @param {TurnData} data
 * @param {Date} now
 * @returns {Step}
 */
function decide(draft, data, now) {
    let next = { ...draft }
    const asked = draft.last_asked_field
    const reviewing = REVIEW_STEPS.includes(asked)
    const photoStep = PHOTO_STEPS.includes(asked)

    if (data.photo === 'accepted') {
        if (reviewing) return summary(next)
        if (photoStep && next.photos.length < MAX_PHOTOS) return ask(next, { field: 'more_photos' })
    }

    if (!photoStep) {
        if (data.intent === 'courtesy' && !bringsReportData(data)) return { draft: next, action: { type: 'courtesy', reviewing } }

        if (data.intent === 'other' && !bringsReportData(data) && !data.dont_know) {
            return { draft: next, action: { type: 'off_topic', reviewing } }
        }
    }

    if (reviewing) {        if (data.intent === 'confirm' && asked === 'correction') {
            return { draft: { ...next, last_asked_field: 'summary' }, action: { type: 'summary', defaults_used: next.defaults_used } }
        }
        if (data.intent === 'confirm') {
            return { draft: { ...next, confirmed: true, last_asked_field: null }, action: { type: 'confirmed' } }
        }
        if (data.intent === 'add') return { draft: next, action: { type: 'summary', added_details: true, defaults_used: next.defaults_used } }

        if (!bringsReportData(data)) {
            if (!data.correction_field) return ask(next, { field: 'correction' })
            next = clearField(next, data.correction_field)
        }
    }

    const answeredInText = !data.location && !data.photo
    if (answeredInText && asked && isMissing(next, asked)) {
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

    return summary(next)
}

/**
 * Shows the summary.
 * @param {import('./draft.js').Draft} draft
 * @returns {Step}
 */
function summary(draft) {
    return { draft: { ...draft, last_asked_field: 'summary' }, action: { type: 'summary', defaults_used: draft.defaults_used } }
}

/**
 * Asks `field`, remembering it as the last question.
 *
 * @param {import('./draft.js').Draft} draft
 * @param {object} question
 * @param {string} question.field Field or step to ask.
 * @param {boolean} [question.help] The field was already asked.
 * @param {string[]} [question.options] Approximate options to offer.
 * @returns {Step}
 */
function ask(draft, { field, help = false, options }) {
    const action = { type: 'ask', field }
    if (help) action.help = true
    if (options) action.options = options
    const asked = { ...draft, last_asked_field: field }
    if (field === 'photos') asked.photos_asked = true 
    return { draft: asked, action }
}

/**
 * Empties a field the person wants to correct, so it is asked again, and
 * forgets that options or a default were used for it.
 *
 * @param {import('./draft.js').Draft} draft
 * @param {string} field Draft field, or `location`.
 * @returns {import('./draft.js').Draft}
 */
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

/**
 * Whether `field` still has to be asked.
 * @param {import('./draft.js').Draft} draft
 * @param {string} field Field or step from {@link ORDER}.
 * @returns {boolean}
 */
function isMissing(draft, field) {
    if (field === 'time_period') return draft.pending_time !== null
    if (field === 'sighting_time') return draft.sighting_time === null && draft.pending_time === null
    if (field === 'location') return draft.latitude === null || draft.longitude === null
    if (field === 'photos') return !draft.photos_asked && draft.photos.length === 0
    if (field === 'more_details' || field === 'more_photos') return false
    return draft[field] === null
}

/**
 * Picks the most likely time for a 1–12 hour whose part of the day the person
 * does not know: 6 to 11 in the morning, 12 at noon, the rest in the afternoon.
 *
 * @param {import('./draft.js').PendingTime} pending
 * @returns {string} Time as `HH:MM`.
 */
function guessTime({ hour, minutes }) {
    const period = hour >= 6 && hour <= 11 ? 'morning' : hour === 12 ? 'noon' : 'afternoon'
    return toSightingTime({ hour, minutes, period }).time
}

/**
 * Current time in Mexico City, as `HH:MM`.
 * @param {Date} now
 * @returns {string}
 */
function currentTime(now) {
    return new Intl.DateTimeFormat('en-GB', {
        timeZone: 'America/Mexico_City',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
    }).format(now)
}

/**
 * Number of words in `text`; 0 when it is empty.
 * @param {string | null} text
 * @returns {number}
 */
const wordCount = (text) => (text ? text.trim().split(/\s+/).length : 0)
