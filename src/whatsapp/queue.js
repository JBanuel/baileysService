/**
 * Per-key task queue, used to answer each chat's messages one at a time.
 *
 * @module whatsapp/queue
 */

/**
 * Last queued task of each key. A key is removed once its queue is empty.
 * @type {Map<string, Promise<void>>}
 */
const tails = new Map()

/**
 * Runs `task` after every task already queued under `key` has finished. Tasks
 * under different keys run concurrently. A failed task does not stop the ones
 * queued after it.
 *
 * @template T
 * @param {string} key Queue key, such as the chat id.
 * @param {() => T | Promise<T>} task
 * @returns {Promise<T>} Settles with the result of `task`.
 */
export function enqueue(key, task) {
    const run = (tails.get(key) ?? Promise.resolve()).then(task)
    const tail = run
        .catch(() => {})
        .finally(() => {
            if (tails.get(key) === tail) tails.delete(key)
        })
    tails.set(key, tail)
    return run
}
