import { createHash } from 'node:crypto'
import { createClient } from 'redis'
import { DRAFT_TTL_SECONDS, REDIS_URL } from '../config.js'

let store = null

export async function initDraftStore() {
    if (store) return store
    if (!REDIS_URL) throw new Error('REDIS_URL is not set in .env (example: redis://127.0.0.1:6379)')

    store = await redisStore(REDIS_URL)
    console.log(`[drafts] stored in Redis, expire after ${DRAFT_TTL_SECONDS / 60} min without activity`)
    return store
}

export function useDraftStore(newStore) {
    store = newStore
}

export async function getStore() {
    return store ?? initDraftStore()
}

export function draftKey(chatId) {
    return `draft:${createHash('sha256').update(chatId).digest('hex').slice(0, 32)}`
}

export async function redisStore(url) {
    let connected = false
    const client = createClient({
        url,
        socket: {
            reconnectStrategy: (retries) =>
                connected ? Math.min(retries * 200, 5000) : new Error(`Could not connect to Redis at ${url}. Is it running?`),
        },
    })
    client.on('error', (error) => {
        if (connected) console.error('[redis]', error.message)
    })
    await client.connect()
    connected = true

    return {
        async get(key) {
            const value = await client.get(key)
            return value ? JSON.parse(value) : null
        },
        async set(key, value, ttlSeconds) {
            await client.set(key, JSON.stringify(value), { expiration: { type: 'EX', value: ttlSeconds } })
        },
        async delete(key) {
            await client.del(key)
        },
        async ttl(key) {
            return client.ttl(key)
        },
        async close() {
            await client.close()
        },
    }
}
