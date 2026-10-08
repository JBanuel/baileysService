// Parts of the day, as the extractor reports them
export const PERIODS = ['morning', 'noon', 'afternoon', 'night', 'early_morning']

// "de la tarde" → "afternoon", "todas las mañanas" → "morning". null if no part of the day is mentioned.
export function periodFromText(text) {
    if (!text) return null
    const t = text.toLowerCase()
    if (t.includes('madrugada')) return 'early_morning'
    if (t.includes('mediod')) return 'noon'
    if (t.includes('tarde')) return 'afternoon'
    if (t.includes('noche')) return 'night'
    if (t.includes('mañana')) return 'morning'
    return null
}

// Time saved when the person only mentions the part of the day ("en la tarde")
const APPROXIMATE_TIMES = { morning: '09:00', noon: '12:00', afternoon: '16:00', night: '20:00', early_morning: '03:00' }

/**
 * Converts what the person said into the "HH:MM" (24 h) time the database expects.
 * Returns { time } when the time is known, { pending } when it is unclear whether it was a.m. or p.m.,
 * or {} when no time was mentioned.
 */
export function toSightingTime({ hour = null, minutes = null, period = null }) {
    if (hour === null) return period ? { time: APPROXIMATE_TIMES[period] } : {}
    if (!Number.isInteger(hour) || hour < 0 || hour > 24) return {}

    const min = Number.isInteger(minutes) && minutes >= 0 && minutes < 60 ? minutes : 0

    // "19:00" or "a las 0" are already in 24-hour format
    if (hour === 0 || hour >= 13) return { time: formatTime(hour % 24, min) }

    // "a las 5" without a period: could be 05:00 or 17:00, we have to ask
    if (!period) return { pending: { hour, minutes: min } }

    return { time: formatTime(to24Hour(hour, period), min) }
}

// hour between 1 and 12 → 0 to 23 depending on the period
function to24Hour(hour, period) {
    if (period === 'morning' || period === 'early_morning') return hour === 12 ? 0 : hour
    if (period === 'noon' || period === 'afternoon') return hour === 12 ? 12 : hour + 12
    // night: "las 9 de la noche" → 21, "las 12 de la noche" → 0, "las 2 de la noche" → 2
    if (hour === 12) return 0
    return hour >= 6 ? hour + 12 : hour
}

function formatTime(hour, minutes) {
    return `${String(hour).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}
