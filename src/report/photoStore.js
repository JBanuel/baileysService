import { randomUUID } from 'node:crypto'
import { mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { PHOTOS_DIR } from '../config.js'

export const MAX_PHOTOS = 2

export async function savePhoto(buffer, contentType) {
    await mkdir(PHOTOS_DIR, { recursive: true })
    const extension = contentType === 'image/png' ? 'png' : 'jpg'
    const filePath = path.join(PHOTOS_DIR, `${randomUUID()}.${extension}`)
    await writeFile(filePath, buffer)
    return { path: filePath, contentType }
}

export async function loadPhotos(photos) {
    return Promise.all(
        photos.map(async ({ path: filePath, contentType }, i) => ({
            buffer: await readFile(filePath),
            fileName: `foto${i + 1}${path.extname(filePath)}`,
            contentType,
        })),
    )
}

export async function deletePhotos(photos) {
    await Promise.all(photos.map(({ path: filePath }) => rm(filePath, { force: true })))
}

export async function deleteOldPhotos(maxAgeMs = 24 * 60 * 60 * 1000, now = Date.now()) {
    let names
    try {
        names = await readdir(PHOTOS_DIR)
    } catch {
        return 0
    }
    let deleted = 0
    for (const name of names) {
        const filePath = path.join(PHOTOS_DIR, name)
        const { mtimeMs } = await stat(filePath)
        if (now - mtimeMs > maxAgeMs) {
            await rm(filePath, { force: true })
            deleted++
        }
    }
    return deleted
}
