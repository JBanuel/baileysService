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
