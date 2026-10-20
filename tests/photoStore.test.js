import { after, test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, utimesSync } from 'node:fs'
import { readdir } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

// A temporary folder instead of storage/photos (set before the store reads the config)
const dir = mkdtempSync(path.join(os.tmpdir(), 'sipinna-photos-'))
process.env.PHOTOS_DIR = dir
const { deleteOldPhotos, deletePhotos, loadPhotos, savePhoto } = await import('../src/report/photoStore.js')
after(() => rmSync(dir, { recursive: true, force: true }))

test('a saved photo can be loaded back, named foto1, foto2…', async () => {
    const first = await savePhoto(Buffer.from('uno'), 'image/jpeg')
    const second = await savePhoto(Buffer.from('dos'), 'image/png')

    const loaded = await loadPhotos([first, second])
    assert.deepEqual(
        loaded.map(({ buffer, fileName, contentType }) => [buffer.toString(), fileName, contentType]),
        [
            ['uno', 'foto1.jpg', 'image/jpeg'],
            ['dos', 'foto2.png', 'image/png'],
        ],
    )
    await deletePhotos([first, second])
})

test('file names are random, never a phone number', async () => {
    const photo = await savePhoto(Buffer.from('x'), 'image/jpeg')

    assert.match(path.basename(photo.path), /^[0-9a-f-]{36}\.jpg$/)
    await deletePhotos([photo])
})

test('deleting photos removes the files', async () => {
    const photo = await savePhoto(Buffer.from('x'), 'image/jpeg')
    await deletePhotos([photo])

    assert.deepEqual(await readdir(dir), [])
})

test('old photos are cleaned up, recent ones are kept', async () => {
    const old = await savePhoto(Buffer.from('vieja'), 'image/jpeg')
    const recent = await savePhoto(Buffer.from('nueva'), 'image/jpeg')
    const twoDaysAgo = (Date.now() - 2 * 24 * 60 * 60 * 1000) / 1000
    utimesSync(old.path, twoDaysAgo, twoDaysAgo)

    assert.equal(await deleteOldPhotos(), 1)
    assert.deepEqual(await readdir(dir), [path.basename(recent.path)])
    await deletePhotos([recent])
})
