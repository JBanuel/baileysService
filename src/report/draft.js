/**
 * The draft of a report: the data gathered so far in a conversation, stored
 * in Redis and expired after {@link DRAFT_TTL_SECONDS} without activity.
 *
 * @module report/draft
 */

import { DRAFT_TTL_SECONDS } from '../config.js'
import { draftKey, getStore } from './draftStore.js'
import { localNow, toSightingTime } from './time.js'

/**
 * Fields copied straight from the extracted data into the draft.
 */
const EXTRACTED_FIELDS = ['children_quantity', 'children_age', 'work_type', 'risk', 'place']

/**
 * Questions whose answer is added to the description as is.
 */
const FREE_TEXT_FIELDS = ['description', 'more_details']

/**
 * Answers that decline to add anything ("no", "eso es todo, gracias"), which
 * are not added to the description.
 */
const REFUSAL = /^(no|nada|nada más|ninguno|ya|eso es todo|es todo)(,?\s*gracias)?[.!\s]*$/i

/**
 * Steps in which the person is reviewing the summary.
 * @type {string[]}
 */
export const REVIEW_STEPS = ['summary', 'correction']

/**
 * Pending hour of a sighting: a 1–12 hour that still needs to know whether it
 * was in the morning or the afternoon.
 *
 * @typedef {object} PendingTime
 * @property {number} hour
 * @property {number} minutes
 */

/**
 * The draft of a report.
 *
 * @typedef {object} Draft
 * @property {string | null} description The person's account, one message per line.
 * @property {number | 'No sé' | null} children_quantity How many children, 1 to 5 (5 means "5 or more").
 * @property {string | null} children_age One of `AGE_RANGES`.
 * @property {string[] | null} work_type Activities, each one of `WORK_TYPES`.
 * @property {string | null} risk Whether there was a risky situation, one of `RISK_ANSWERS`.
 * @property {boolean} immediate_danger Whether a child was in danger right now (an emergency was detected).
 * @property {string | null} sighting_date Day of the sighting, `YYYY-MM-DD`; `null` means the day of the report.
 * @property {string | null} sighting_time Time of the sighting, `HH:MM` in 24-hour format.
 * @property {PendingTime | null} pending_time Hour waiting for "de la mañana" or "de la tarde".
 * @property {number | null} latitude Of the shared location.
 * @property {number | null} longitude Of the shared location.
 * @property {string | null} place Place in the person's words; sent as the reference.
 * @property {string | null} location_label Name and address of the place chosen on the map, when WhatsApp sends them.
 * @property {import('./photoStore.js').StoredPhoto[]} photos Photos received so far.
 * @property {boolean} photos_asked Whether the bot already offered to receive photos.
 * @property {string | null} last_asked_field Field or step of the last question.
 * @property {string[]} approximation_asked Fields for which approximate options were already offered.
 * @property {boolean} details_asked Whether the bot already invited the person to tell more.
 * @property {string[]} defaults_used Fields filled with a default value because the person did not know.
 * @property {boolean} confirmed Whether the person confirmed the summary.
 * @property {string | null} last_reply Last question sent, given to the model as context.
 * @property {boolean} emergency_notified Whether the 911 notice was already shown.
 * @property {import('../api/sipinnaApi.js').ApiReport | null} api_report What was already created in the API, so a failed send can resume.
 */

/**
 * Creates a draft with no data.
 * @returns {Draft}
 */
export function emptyDraft() {
    return {
        description: null,
        children_quantity: null,
        children_age: null,
        work_type: null,
        risk: null,
        immediate_danger: false,
        sighting_date: null,
        sighting_time: null,
        pending_time: null,
        latitude: null,
        longitude: null,
        place: null,
        location_label: null,
        photos: [], 
        photos_asked: false,
        last_asked_field: null,
        approximation_asked: [],
        details_asked: false,
        defaults_used: [],
        confirmed: false,
        last_reply: null,
        emergency_notified: false,
        api_report: null, 
    }
}

/**
 * Loads a chat's draft, or an empty one when it has none.
 * Fields added to the draft after it was saved get their empty value.
 *
 * @param {string} id Chat id.
 * @returns {Promise<Draft>}
 */
export async function getDraft(id) {
    const saved = await (await getStore()).get(draftKey(id))
    return saved ? { ...emptyDraft(), ...saved } : emptyDraft()
}

/**
 * Saves a chat's draft and restarts its expiration.
 * @param {string} id Chat id.
 * @param {Draft} draft
 * @returns {Promise<void>}
 */
export async function saveDraft(id, draft) {
    await (await getStore()).set(draftKey(id), draft, DRAFT_TTL_SECONDS)
}

/**
 * Deletes a chat's draft.
 * @param {string} id Chat id.
 * @returns {Promise<void>}
 */
export async function deleteDraft(id) {
    await (await getStore()).delete(draftKey(id))
}

/**
 * Sets the location of the sighting. Invalid coordinates are ignored.
 *
 * @param {Draft} draft
 * @param {{ lat: number, lng: number }} location
 * @returns {Draft} A new draft, or the same one when the location is invalid.
 */
export function setLocation(draft, { lat, lng, name, address }) {
    const valid = Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180
    if (!valid) return draft
    const label = [name, address].filter(Boolean).join(', ')
    return { ...draft, latitude: lat, longitude: lng, location_label: label || null }
}

/**
 * Whether the extracted data includes any report field (quantity, age,
 * activity, place, day, hour or part of the day). The risk alone does not
 * count: a bare "sí" to the risk question is not part of the account.
 *
 * @param {Partial<import('./extractor.js').ExtractedData>} data
 * @returns {boolean}
 */
export function bringsReportData(data) {
    return (
        EXTRACTED_FIELDS.some((field) => field !== 'risk' && data[field] !== null && data[field] !== undefined) ||
        Boolean(data.hour ?? data.period ?? data.day) ||
        Boolean(data.happening_now)
    )
}

/**
 * Merges the data extracted from a message into the draft.
 *
 * A field that already has a value is only overwritten when it is the one
 * just asked, or when the person is correcting the summary. The message is
 * added to the description when it carries report data or answers an
 * open question; while reviewing the summary, only when the person adds
 * something new.
 *
 * @param {Draft} draft
 * @param {import('./extractor.js').ExtractedData} data Data extracted from `message`.
 * @param {string} message The person's message.
 * @param {Date} [now] For "ahorita" without an hour.
 * @returns {Draft} A new draft.
 */
export function mergeData(draft, data, message, now = new Date()) {
    const next = { ...draft }
    const asked = draft.last_asked_field
    const reviewing = REVIEW_STEPS.includes(asked)
    const correcting = reviewing && data.intent === 'correct'

    const canWrite = (field, askedAs = [field]) => draft[field] === null || askedAs.includes(asked) || correcting

    for (const field of EXTRACTED_FIELDS) {
        if (data[field] !== null && data[field] !== undefined && canWrite(field)) next[field] = data[field]
    }

    if (canWrite('sighting_time', ['sighting_time', 'time_period'])) mergeTime(next, draft, data, now)

    // Once an emergency is described the report is marked as immediate danger (shown in the summary to confirm)
    if (data.emergency) next.immediate_danger = true

    const answeredStory = FREE_TEXT_FIELDS.includes(asked) && data.intent !== 'other' && !REFUSAL.test(message.trim())
    // "sí, estaban en una obra sin casco" explains the risk; a bare "sí" does not
    const explainsRisk = asked === 'risk' && message.trim().split(/\s+/).length > 3
    const addsToStory = reviewing && data.intent === 'add'
    if ((!reviewing && (bringsReportData(data) || answeredStory || explainsRisk)) || addsToStory) next.description = next.description ? `${next.description}\n${message}` : message

    return next
}

/**
 * Updates the time of the sighting in `next`. A part of the day alone
 * completes a pending hour; an hour without a part of the day is kept as
 * pending until it is known.
 *
 * @param {Draft} next Draft being built; modified in place.
 * @param {Draft} draft Draft before this message.
 * @param {Partial<import('./extractor.js').ExtractedData>} data
 */
function mergeTime(next, draft, data, now) {
    const { hour = null, minutes = null, period = null } = data

    if (data.day) next.sighting_date = data.day
    // "ahorita" without an hour: it is happening now
    if (data.happening_now && hour === null && period === null) {
        const { date, time } = localNow(now)
        next.sighting_date = date
        next.sighting_time = time
        next.pending_time = null
        return
    }
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
