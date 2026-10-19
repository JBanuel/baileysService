/**
 * Times of a sighting. The model copies the hour and the words for the part of
 * the day; this module turns them into a 24-hour time, or says that the part
 * of the day is still needed.
 *
 * @module report/time
 */

/**
 * Parts of the day.
 * @type {string[]}
 */
export const PERIODS = ['morning', 'noon', 'afternoon', 'night', 'early_morning']

/**
 * Word that identifies each part of the day. "mañana" goes last because it
 * also means "tomorrow": "mañana en la tarde" is in the afternoon.
 */
const PERIOD_KEYWORDS = [
    ['early_morning', 'madrugada'],
    ['noon', 'mediod'],
    ['afternoon', 'tarde'],
    ['night', 'noche'],
    ['morning', 'mañana'],
]

/**
 * Part of the day named in `text`, for example `"de la tarde"` → `"afternoon"`.
 * @param {string | null} text
 * @returns {string | null} One of {@link PERIODS}, or `null`.
 */
export function periodFromText(text) {
    if (!text) return null
    const t = text.toLowerCase()
    return PERIOD_KEYWORDS.find(([, keyword]) => t.includes(keyword))?.[0] ?? null
}

/**
 * Whether the person's message contains the words for `period`.
 * @param {string} message
 * @param {string | null} period
 * @returns {boolean}
 */
export function mentionsPeriod(message, period) {
    const keyword = PERIOD_KEYWORDS.find(([name]) => name === period)?.[1]
    return Boolean(keyword) && message.toLowerCase().includes(keyword)
}

/**
 * Part of the day from "am" or "pm" in the message.
 * "8 am", "7 p.m.": only right after a number, so words like "amigos" or "cama" don't count
 * @param {string} message
 * @returns {'morning' | 'afternoon' | null}
 */
export function amPmPeriod(message) {
    if (/\d\s*p\.?\s?m\b\.?(?![a-záéíóúñ])/i.test(message)) return 'afternoon'
    if (/\d\s*a\.?\s?m\b\.?(?![a-záéíóúñ])/i.test(message)) return 'morning'
    return null
}

/**
 * Time used when the person only gives the part of the day.
 */
const APPROXIMATE_TIMES = { morning: '09:00', noon: '12:00', afternoon: '16:00', night: '20:00', early_morning: '03:00' }

/**
 * Converts an hour and a part of the day into a 24-hour time.
 *
 * - Only a part of the day: its approximate time ("en la tarde" → `16:00`).
 * - 0 or 13–24: already unambiguous.
 * - 1–12 without a part of the day: returned as `pending`, to ask whether it
 *   was in the morning or the afternoon.
 * - Invalid minutes count as 0.
 *
 * @param {object} time
 * @param {number | null} [time.hour]
 * @param {number | null} [time.minutes]
 * @param {string | null} [time.period] One of {@link PERIODS}.
 * @returns {{ time?: string, pending?: import('./draft.js').PendingTime }}
 *   `time` as `HH:MM`, `pending`, or neither when there is no valid hour.
 */
export function toSightingTime({ hour = null, minutes = null, period = null }) {
    if (hour === null) return period ? { time: APPROXIMATE_TIMES[period] } : {}
    if (!Number.isInteger(hour) || hour < 0 || hour > 24) return {}

    const min = Number.isInteger(minutes) && minutes >= 0 && minutes < 60 ? minutes : 0

    if (hour === 0 || hour >= 13) return { time: formatTime(hour % 24, min) }

    if (!period) return { pending: { hour, minutes: min } }

    return { time: formatTime(to24Hour(hour, period), min) }
}

/**
 * Converts a 1–12 hour into 24-hour format. At night, 6 to 11 are p.m. and
 * 1 to 5 are a.m. ("a las 2 de la noche" → 2); 12 at night is midnight.
 *
 * @param {number} hour
 * @param {string} period
 * @returns {number}
 */
function to24Hour(hour, period) {
    if (period === 'morning' || period === 'early_morning') return hour === 12 ? 0 : hour
    if (period === 'noon' || period === 'afternoon') return hour === 12 ? 12 : hour + 12
    if (hour === 12) return 0
    return hour >= 6 ? hour + 12 : hour
}

/**
 * Formats a time as `HH:MM`.
 * @param {number} hour
 * @param {number} minutes
 * @returns {string}
 */
function formatTime(hour, minutes) {
    return `${String(hour).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}
