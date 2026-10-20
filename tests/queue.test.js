import { test } from 'node:test'
import assert from 'node:assert/strict'
import { enqueue } from '../src/whatsapp/queue.js'

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

test('messages from the same chat are processed in order', async () => {
    const order = []
    await Promise.all([
        enqueue('chat-a', async () => {
            await wait(30)
            order.push('first')
        }),
        enqueue('chat-a', async () => order.push('second')),
    ])

    assert.deepEqual(order, ['first', 'second'])
})

test('different chats do not wait for each other', async () => {
    const order = []
    await Promise.all([
        enqueue('chat-b', async () => {
            await wait(30)
            order.push('slow chat')
        }),
        enqueue('chat-c', async () => order.push('fast chat')),
    ])

    assert.deepEqual(order, ['fast chat', 'slow chat'])
})

test('an error in one message does not block the next ones', async () => {
    const order = []
    const failing = enqueue('chat-d', async () => {
        throw new Error('boom')
    })
    const next = enqueue('chat-d', async () => order.push('next'))

    await assert.rejects(failing)
    await next
    assert.deepEqual(order, ['next'])
})
