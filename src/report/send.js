/**
 * Sends a confirmed report to the SIPINNA API.
 *
 * @module report/send
 */

/**
 * Creates the report, uploads its photos and submits it.
 *
 * Progress is saved after creating the report and after registering its
 * images, so a retry after a failure continues where it stopped instead of
 * creating a duplicate report.
 *
 * @param {object} options
 * @param {import('../api/sipinnaApi.js').ApiClient} options.api
 * @param {import('./draft.js').Draft} options.draft Confirmed draft.
 * @param {(draft: import('./draft.js').Draft) => Promise<void>} options.saveProgress
 *   Saves the draft with the updated `api_report`.
 * @param {import('./photoStore.js').LoadedPhoto[]} [options.photos] Photos to upload.
 * @returns {Promise<{ folio: string | null }>}
 */
export async function sendReport({ api, draft, saveProgress, photos = [] }) {
    let created = draft.api_report
    if (!created) {
        created = await api.createReport(toReportPayload(draft))
        await saveProgress({ ...draft, api_report: created })
    }

    if (photos.length) {
        if (!created.imageIds) {
            created = { ...created, imageIds: await api.registerImages(created, photos) }
            await saveProgress({ ...draft, api_report: created })
        }
        await Promise.all(photos.map((photo, i) => api.uploadImage(created, created.imageIds[i], photo)))
    }

    await api.submitReport(created)
    return { folio: created.folio }
}

/**
 * Body of the request that creates a report.
 *
 * @typedef {object} ReportPayload
 * @property {string} description
 * @property {number} latitude
 * @property {number} longitude
 * @property {number} children_quantity
 * @property {string} children_age
 * @property {string} work_type
 * @property {string} sighting_time `HH:MM`, 24-hour format.
 */

/**
 * Builds the request body from a draft.
 * @param {import('./draft.js').Draft} draft
 * @returns {ReportPayload}
 */
export function toReportPayload(draft) {
    return {
        description: draft.description,
        latitude: draft.latitude,
        longitude: draft.longitude,
        children_quantity: draft.children_quantity,
        children_age: draft.children_age,
        work_type: draft.work_type,
        sighting_time: draft.sighting_time,
    }
}
