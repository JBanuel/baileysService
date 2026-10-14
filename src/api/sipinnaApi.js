export class ApiError extends Error {
    constructor(step, status, body) {
        super(`${step} failed with HTTP ${status}: ${typeof body === 'string' ? body : JSON.stringify(body)}`)
        this.name = 'ApiError'
        this.step = step
        this.status = status
        this.body = body
    }
}

export function createApiClient(baseUrl, { timeoutMs = 15_000 } = {}) {
    const root = baseUrl.replace(/\/+$/, '')

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

function parseJson(text) {
    if (!text) return null
    try {
        return JSON.parse(text)
    } catch {
        return null
    }
}
