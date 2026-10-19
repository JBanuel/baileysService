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

/**
 * Time zone used for dates and "now": the bot serves Atizapán de Zaragoza.
 */
const TIME_ZONE = 'America/Mexico_City'

const WEEKDAY_NUMBERS = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }

/**
 * Date, time and day of the week of `now` in Mexico City.
 *
 * @param {Date} [now]
 * @returns {{ date: string, time: string, weekday: number }} `date` as `YYYY-MM-DD`,
 *   `time` as `HH:MM` and `weekday` from 0 (Sunday) to 6 (Saturday).
 */
export function localNow(now = new Date()) {
    const parts = Object.fromEntries(
        new Intl.DateTimeFormat('en-CA', {
            timeZone: TIME_ZONE,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hourCycle: 'h23',
            weekday: 'short',
        })
            .formatToParts(now)
            .map(({ type, value }) => [type, value]),
    )
    return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}`, weekday: WEEKDAY_NUMBERS[parts.weekday] }
}

/**
 * Moves a `YYYY-MM-DD` date by `days`.
 * @param {string} date
 * @param {number} days Negative to go back.
 * @returns {string}
 */
export function shiftDate(date, days) {
    const [year, month, day] = date.split('-').map(Number)
    return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10)
}

/**
 * Words for a day relative to today, and how many days back they are.
 * "antes de ayer" and "anteayer" go before "ayer", which they contain.
 */
const RELATIVE_DAYS = [
    ['antes de ayer', 2],
    ['anteayer', 2],
    ['antier', 2],
    ['anoche', 1],
    ['ayer', 1],
    ['hoy', 0],
]

const WEEKDAY_NAMES = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado']

/**
 * Lowercases and removes accents, so "sábado" and "sabado" read the same.
 * @param {string} text
 * @returns {string}
 */
const normalize = (text) => text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

/**
 * Day of the sighting named in the message: "hoy", "ayer", "antier", "anoche"
 * or a day of the week ("el sábado" is the most recent Saturday, today included).
 * Read by the code, not the model: it is a small, fixed vocabulary.
 *
 * @param {string} message
 * @param {Date} [now]
 * @returns {string | null} The date as `YYYY-MM-DD`, or `null` when no day is named.
 */
export function dayFromMessage(message, now = new Date()) {
    const text = normalize(message)
    const { date: today, weekday } = localNow(now)

    const relative = RELATIVE_DAYS.find(([words]) => new RegExp(`\\b${words}\\b`).test(text))
    if (relative) return shiftDate(today, -relative[1])

    const named = WEEKDAY_NAMES.findIndex((day) => new RegExp(`\\b${day}\\b`).test(text))
    if (named >= 0) return shiftDate(today, -((weekday - named + 7) % 7))

    return null
}

/**
 * Whether the person says it is happening right now ("ahorita", "en este momento").
 * @param {string} message
 * @returns {boolean}
 */
export function isHappeningNow(message) {
    return /\b(ahorita|ahora mismo|en este momento|justo ahora)\b/.test(normalize(message))
}
