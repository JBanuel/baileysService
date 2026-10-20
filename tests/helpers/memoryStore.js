// Replaces Redis in unit tests. Behaves like the Redis store: values are copies and expire.
export function memoryStore({ now = () => Date.now() } = {}) {
    const items = new Map()
    return {
        async get(key) {
            const item = items.get(key)
            if (!item) return null
            if (item.expiresAt <= now()) {
                items.delete(key)
                return null
            }
            return item.value
        },
        async set(key, value, ttlSeconds) {
            items.set(key, { value: structuredClone(value), expiresAt: now() + ttlSeconds * 1000 })
        },
        async delete(key) {
            items.delete(key)
        },
    }
}
