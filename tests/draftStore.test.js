import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import { REDIS_URL } from '../src/config.js'
import { draftKey, redisStore } from '../src/report/draftStore.js'

test('the key does not contain the phone number', () => {
    const key = draftKey('5215512345678@s.whatsapp.net')

    assert.match(key, /^draft:[0-9a-f]{32}$/)
    assert.doesNotMatch(key, /5512345678/)
})

test('the same chat always gets the same key, different chats get different keys', () => {
    assert.equal(draftKey('chat-a'), draftKey('chat-a'))
    assert.notEqual(draftKey('chat-a'), draftKey('chat-b'))
})

// These use the real Redis from REDIS_URL; they are skipped when it isn't running
let store = null
before(async () => {
    store = await Promise.race([
        redisStore(REDIS_URL || 'redis://127.0.0.1:6379'),
        new Promise((resolve) => setTimeout(() => resolve(null), 1000)),
    ]).catch(() => null)
})
after(() => store?.close())

const KEY = 'draft:test-draftstore'
const withRedis = (name, fn) => test(name, async (t) => (store ? fn() : t.skip('Redis is not running')))

withRedis('Redis: save, get and delete a draft', async () => {
    await store.set(KEY, { children_quantity: 2, defaults_used: ['children_age'] }, 60)
    assert.deepEqual(await store.get(KEY), { children_quantity: 2, defaults_used: ['children_age'] })

    await store.delete(KEY)
    assert.equal(await store.get(KEY), null)
})

withRedis('Redis: the draft has an expiration, and saving again renews it', async () => {
    await store.set(KEY, { children_quantity: 2 }, 60)
    assert.ok((await store.ttl(KEY)) <= 60)

    await store.set(KEY, { children_quantity: 3 }, 3600)
    assert.ok((await store.ttl(KEY)) > 60)
    await store.delete(KEY)
})

withRedis('Redis: an expired draft is gone', async () => {
    await store.set(KEY, { children_quantity: 2 }, 1)
    await new Promise((resolve) => setTimeout(resolve, 1100))

    assert.equal(await store.get(KEY), null)
})
