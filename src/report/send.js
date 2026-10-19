/**
 * Sends a confirmed report to the SIPINNA API.
 *
 * @module report/send
 */

import { localNow } from './time.js'

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
 * @property {number} [children_quantity] 1 to 5 (5 means "5 or more"); left out when unknown.
 * @property {string} children_age One of `AGE_RANGES`.
 * @property {string} work_type Activities from `WORK_TYPES`, separated by ", ".
 * @property {string} sighting_time Local date and time, `YYYY-MM-DDTHH:MM`.
 * @property {string} risk One of `RISK_ANSWERS`.
 * @property {boolean} immediate_danger
 * @property {string} [reference] Where it was, in the person's words; left out when there is none.
 */

/**
 * Longest reference the API accepts.
 */
const MAX_REFERENCE_LENGTH = 500

/**
 * Builds the request body from a draft.
 *
 * @param {import('./draft.js').Draft} draft
 * @param {Date} [now] The day of the report, used when the person did not say the day.
 * @returns {ReportPayload}
 */
export function toReportPayload(draft, now = new Date()) {
    const payload = {
        description: draft.description,
        latitude: draft.latitude,
        longitude: draft.longitude,
        children_age: draft.children_age,
        work_type: (draft.work_type ?? ['No sé']).join(', '),
        sighting_time: `${draft.sighting_date ?? localNow(now).date}T${draft.sighting_time}`,
        risk: draft.risk ?? 'no_se',
        immediate_danger: draft.immediate_danger,
    }
    if (Number.isInteger(draft.children_quantity)) payload.children_quantity = draft.children_quantity

    const reference = draft.place ?? draft.location_label
    if (reference) payload.reference = reference.slice(0, MAX_REFERENCE_LENGTH)

    return payload
}
