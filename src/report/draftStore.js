/**
 * Storage for drafts. Redis in production; tests can swap in another store
 * with {@link useDraftStore}.
 *
 * @module report/draftStore
 */

import { createHash } from 'node:crypto'
import { createClient } from 'redis'
import { DRAFT_TTL_SECONDS, REDIS_URL } from '../config.js'

/**
 * Key-value store with expiration, where values are saved as JSON.
 *
 * @typedef {object} DraftStore
 * @property {(key: string) => Promise<any>} get Value of `key`, or `null`.
 * @property {(key: string, value: unknown, ttlSeconds: number) => Promise<void>} set Saves `value`, expiring after `ttlSeconds`.
 * @property {(key: string) => Promise<void>} delete Deletes `key`.
 * @property {(key: string) => Promise<number>} ttl Seconds left before `key` expires.
 * @property {() => Promise<void>} close Closes the connection.
 */

/** @type {DraftStore | null} */
let store = null

/**
 * Connects to Redis at {@link REDIS_URL}. Calling it again returns the same store.
 *
 * @returns {Promise<DraftStore>}
 * @throws {Error} When `REDIS_URL` is not set or Redis cannot be reached.
 */
export async function initDraftStore() {
    if (store) return store
    if (!REDIS_URL) throw new Error('REDIS_URL is not set in .env (example: redis://127.0.0.1:6379)')

    store = await redisStore(REDIS_URL)
    console.log(`[drafts] stored in Redis, expire after ${DRAFT_TTL_SECONDS / 60} min without activity`)
    return store
}

/**
 * Replaces the store, for example with an in-memory one in tests.
 * @param {DraftStore} newStore
 */
export function useDraftStore(newStore) {
    store = newStore
}

/**
 * Returns the current store, connecting to Redis first if needed.
 * @returns {Promise<DraftStore>}
 */
export async function getStore() {
    return store ?? initDraftStore()
}

/**
 * Key of a chat's draft. The chat id (which contains the phone number) is
 * hashed so it is not stored in Redis.
 *
 * @param {string} chatId
 * @returns {string} `draft:` followed by 32 hex characters.
 */
export function draftKey(chatId) {
    return `draft:${createHash('sha256').update(chatId).digest('hex').slice(0, 32)}`
}

/**
 * Connects to Redis and returns a {@link DraftStore} over it.
 *
 * The first connection fails right away if Redis is not running; once
 * connected, lost connections are retried with a growing delay of up to 5 seconds.
 *
 * @param {string} url Redis connection URL.
 * @returns {Promise<DraftStore>}
 */
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
