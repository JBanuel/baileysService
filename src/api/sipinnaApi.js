/**
 * HTTP client for the SIPINNA reports API.
 *
 * A report is created in steps: create it, register its images, upload each
 * image and finally submit it. Every step after the first is authorized with
 * the edit token returned on creation.
 *
 * @module api/sipinnaApi
 */

/**
 * Error thrown when the API answers with a non-2xx status or an unexpected body.
 */
export class ApiError extends Error {
    /**
     * @param {string} step Request that failed, as `"METHOD /path"`.
     * @param {number} status HTTP status of the response.
     * @param {unknown} body Parsed JSON body, or the raw text when it is not JSON.
     */
    constructor(step, status, body) {
        super(`${step} failed with HTTP ${status}: ${typeof body === 'string' ? body : JSON.stringify(body)}`)
        this.name = 'ApiError'
        this.step = step
        this.status = status
        this.body = body
    }
}

/**
 * A report created in the API, plus the ids of its registered images once they exist.
 * This is what the draft keeps in `api_report` so a failed send can resume.
 *
 * @typedef {object} ApiReport
 * @property {string} reportId Id of the report (`reporte_id`).
 * @property {string} editToken Token that authorizes later changes to the report.
 * @property {string | null} folio Public folio of the report, when the API returns one.
 * @property {string[]} [imageIds] Ids returned by {@link ApiClient.registerImages}, in photo order.
 */

/**
 * Client returned by {@link createApiClient}.
 *
 * @typedef {object} ApiClient
 * @property {(report: import('../report/send.js').ReportPayload) => Promise<ApiReport>} createReport
 *   Creates a draft report and returns its id, edit token and folio.
 * @property {(report: ApiReport, photos: import('../report/photoStore.js').LoadedPhoto[]) => Promise<string[]>} registerImages
 *   Registers one image per photo and returns their ids, in the same order.
 * @property {(report: ApiReport, imageId: string, photo: import('../report/photoStore.js').LoadedPhoto) => Promise<object>} uploadImage
 *   Uploads the bytes of a registered image as `multipart/form-data`.
 * @property {(report: ApiReport) => Promise<unknown>} submitReport
 *   Marks the report as submitted, after which it can no longer be edited.
 */

/**
 * Creates a client for the API at `baseUrl`.
 *
 * @param {string} baseUrl Base URL of the API; trailing slashes are ignored.
 * @param {object} [options]
 * @param {number} [options.timeoutMs=15000] Timeout of each request, in milliseconds.
 * @returns {ApiClient}
 */
export function createApiClient(baseUrl, { timeoutMs = 15_000 } = {}) {
    const root = baseUrl.replace(/\/+$/, '')

    /**
     * Sends one request and returns its parsed JSON body.
     *
     * @param {string} method HTTP method.
     * @param {string} path Path under the base URL, starting with `/`.
     * @param {object} [options]
     * @param {unknown} [options.json] Body to send as JSON.
     * @param {FormData} [options.form] Body to send as multipart form data.
     * @param {string} [options.editToken] Sent as the `X-Edit-Token` header.
     * @returns {Promise<any>} The parsed body, or `null` when it is empty or not JSON.
     * @throws {ApiError} When the response status is not 2xx.
     */
    async function request(method, path, { json, form, editToken } = {}) {
        const headers = {}
        if (editToken) headers['X-Edit-Token'] = editToken
        let body
        if (json !== undefined) {
            headers['Content-Type'] = 'application/json'
            body = JSON.stringify(json)
        }
        if (form) body = form 

        const response = await fetch(`${root}${path}`, { method, headers, body, signal: AbortSignal.timeout(timeoutMs) })
        const text = await response.text()
        const data = parseJson(text)
        if (!response.ok) throw new ApiError(`${method} ${path}`, response.status, data ?? text)
        return data
    }

    return {
        async createReport(report) {
            const data = await request('POST', '/report', { json: report })
            if (!data?.reporte_id || !data?.edit_token) throw new ApiError('POST /report', 200, data)
            return { reportId: data.reporte_id, editToken: data.edit_token, folio: data.folio ?? null }
        },

        async registerImages({ reportId, editToken }, photos) {
            const images = photos.map(({ fileName, contentType }) => ({ file_name: fileName, content_type: contentType }))
            const data = await request('POST', `/report/${reportId}/images`, { editToken, json: { Images: images } })
            if (!Array.isArray(data?.success) || data.success.length !== photos.length) {
                throw new ApiError(`POST /report/${reportId}/images`, 200, data)
            }
            return data.success
        },

        async uploadImage({ reportId, editToken }, imageId, { buffer, fileName, contentType }) {
            const form = new FormData()
            form.append('file', new Blob([buffer], { type: contentType }), fileName)
            const data = await request('PUT', `/report/${reportId}/images/${imageId}`, { editToken, form })
            if (!data?.success) throw new ApiError(`PUT /report/${reportId}/images/${imageId}`, 200, data)
            return data
        },

        async submitReport({ reportId, editToken }) {
            return request('PUT', `/report/${reportId}/submit`, { editToken })
        },
    }
}

/**
 * Parses `text` as JSON, returning `null` when it is empty or invalid.
 * @param {string} text
 * @returns {any}
 */
function parseJson(text) {
    if (!text) return null
    try {
        return JSON.parse(text)
    } catch {
        return null
    }
}
