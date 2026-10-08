export const PERIODS = ['morning', 'noon', 'afternoon', 'night', 'early_morning']

// Order matters: the first keyword found in the text wins
const PERIOD_KEYWORDS = [
    ['early_morning', 'madrugada'],
    ['noon', 'mediod'],
    ['afternoon', 'tarde'],
    ['night', 'noche'],
    ['morning', 'mañana'],
]

export function periodFromText(text) {
    if (!text) return null
    const t = text.toLowerCase()
    return PERIOD_KEYWORDS.find(([, keyword]) => t.includes(keyword))?.[0] ?? null
}

// True if the message itself mentions that part of the day (the model may rephrase "en la tarde" as "de la tarde")
export function mentionsPeriod(message, period) {
    const keyword = PERIOD_KEYWORDS.find(([name]) => name === period)?.[1]
    return Boolean(keyword) && message.toLowerCase().includes(keyword)
}

const APPROXIMATE_TIMES = { morning: '09:00', noon: '12:00', afternoon: '16:00', night: '20:00', early_morning: '03:00' }

export function toSightingTime({ hour = null, minutes = null, period = null }) {
    if (hour === null) return period ? { time: APPROXIMATE_TIMES[period] } : {}
    if (!Number.isInteger(hour) || hour < 0 || hour > 24) return {}

    const min = Number.isInteger(minutes) && minutes >= 0 && minutes < 60 ? minutes : 0

    if (hour === 0 || hour >= 13) return { time: formatTime(hour % 24, min) }

    if (!period) return { pending: { hour, minutes: min } }

    return { time: formatTime(to24Hour(hour, period), min) }
}

function to24Hour(hour, period) {
    if (period === 'morning' || period === 'early_morning') return hour === 12 ? 0 : hour
    if (period === 'noon' || period === 'afternoon') return hour === 12 ? 12 : hour + 12
    if (hour === 12) return 0
    return hour >= 6 ? hour + 12 : hour
}

function formatTime(hour, minutes) {
    return `${String(hour).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}
