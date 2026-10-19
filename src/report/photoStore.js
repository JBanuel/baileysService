/**
 * Photos received during a conversation, kept on disk in {@link PHOTOS_DIR}
 * until the report is sent or discarded.
 *
 * @module report/photoStore
 */

import { randomUUID } from 'node:crypto'
import { mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { PHOTOS_DIR } from '../config.js'

/**
 * Maximum number of photos per report.
 * @type {number}
 */
export const MAX_PHOTOS = 2

/**
 * A photo saved on disk, as kept in the draft.
 *
 * @typedef {object} StoredPhoto
 * @property {string} path Path of the file.
 * @property {string} contentType MIME type, such as `image/jpeg`.
 */

/**
 * A photo read back from disk, ready to upload.
 *
 * @typedef {object} LoadedPhoto
 * @property {Buffer} buffer Bytes of the image.
 * @property {string} fileName Name for the upload: `foto1.jpg`, `foto2.png`…
 * @property {string} contentType MIME type.
 */

/**
 * Saves a photo under a random name. PNG images keep their extension;
 * everything else is saved as `.jpg`.
 *
 * @param {Buffer} buffer Bytes of the image.
 * @param {string} contentType MIME type of the image.
 * @returns {Promise<StoredPhoto>}
 */
export async function savePhoto(buffer, contentType) {
    await mkdir(PHOTOS_DIR, { recursive: true })
    const extension = contentType === 'image/png' ? 'png' : 'jpg'
    const filePath = path.join(PHOTOS_DIR, `${randomUUID()}.${extension}`)
    await writeFile(filePath, buffer)
    return { path: filePath, contentType }
}

/**
 * Reads the draft's photos back from disk, in order.
 * @param {StoredPhoto[]} photos
 * @returns {Promise<LoadedPhoto[]>}
 */
export async function loadPhotos(photos) {
    return Promise.all(
        photos.map(async ({ path: filePath, contentType }, i) => ({
            buffer: await readFile(filePath),
            fileName: `foto${i + 1}${path.extname(filePath)}`,
            contentType,
        })),
    )
}

/**
 * Deletes photo files. Files that no longer exist are ignored.
 * @param {StoredPhoto[]} photos
 * @returns {Promise<void>}
 */
export async function deletePhotos(photos) {
    await Promise.all(photos.map(({ path: filePath }) => rm(filePath, { force: true })))
}

/**
 * Deletes photos older than `maxAgeMs`, such as those of drafts that expired
 * before the report was sent.
 *
 * @param {number} [maxAgeMs] Maximum age, in milliseconds. One day by default.
 * @param {number} [now] Current time, in milliseconds since the epoch.
 * @returns {Promise<number>} How many photos were deleted.
 */
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
