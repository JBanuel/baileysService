const tails = new Map()

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
