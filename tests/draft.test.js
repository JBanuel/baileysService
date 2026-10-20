import { test } from 'node:test'
import assert from 'node:assert/strict'
import { deleteDraft, emptyDraft, getDraft, mergeData, saveDraft, setLocation } from '../src/report/draft.js'
import { useDraftStore } from '../src/report/draftStore.js'
import { memoryStore } from './helpers/memoryStore.js'

useDraftStore(memoryStore())

// What extractData() returns when the message has no report data
const nothing = {
    children_quantity: null,
    children_age: null,
    work_type: null,
    hour: null,
    minutes: null,
    period: null,
    place: null,
    dont_know: false,
    emergency: false,
}

test('fills fields with the message data', () => {
    const data = { ...nothing, children_quantity: 2, children_age: '8 a 10 años', work_type: 'Limpieza de parabrisas' }
    const draft = mergeData(emptyDraft(), data, 'vi a dos niños limpiando parabrisas')

    assert.equal(draft.children_quantity, 2)
    assert.equal(draft.children_age, '8 a 10 años')
    assert.equal(draft.work_type, 'Limpieza de parabrisas')
})

test('a null does not erase existing data', () => {
    const before = { ...emptyDraft(), children_quantity: 2 }
    const draft = mergeData(before, { ...nothing, work_type: 'Mendicidad' }, 'pedían dinero')

    assert.equal(draft.children_quantity, 2)
    assert.equal(draft.work_type, 'Mendicidad')
})

test('a passing comment does not overwrite a field that already has a value', () => {
    const before = { ...emptyDraft(), work_type: 'Limpieza de parabrisas', last_asked_field: 'location' }
    const draft = mergeData(before, { ...nothing, work_type: 'Mendicidad' }, 'había un adulto que les cobraba el dinero')

    assert.equal(draft.work_type, 'Limpieza de parabrisas')
})

test('a field can change when the bot asked for it', () => {
    const before = { ...emptyDraft(), children_quantity: 1, last_asked_field: 'children_quantity' }
    const draft = mergeData(before, { ...nothing, children_quantity: 3 }, 'eran tres')

    assert.equal(draft.children_quantity, 3)
})

test('a correction to the summary overwrites the field', () => {
    const before = { ...emptyDraft(), children_quantity: 2, sighting_time: '17:00', last_asked_field: 'summary' }
    let draft = mergeData(before, { ...nothing, children_quantity: 5, intent: 'correct' }, 'no, eran cinco')
    assert.equal(draft.children_quantity, 5)

    draft = mergeData(before, { ...nothing, period: 'morning', intent: 'correct' }, 'fue en la mañana')
    assert.equal(draft.sighting_time, '09:00')
})

test('the time is not overwritten by a passing comment either', () => {
    const before = { ...emptyDraft(), sighting_time: '17:00', last_asked_field: 'location' }
    const draft = mergeData(before, { ...nothing, period: 'night' }, 'ya era de noche cuando me fui')

    assert.equal(draft.sighting_time, '17:00')
})

test('new details told during the summary are added to the description', () => {
    const before = { ...emptyDraft(), description: 'vi dos niños', work_type: 'Limpieza de parabrisas', last_asked_field: 'summary' }
    const draft = mergeData(before, { ...nothing, work_type: 'Mendicidad', intent: 'add' }, 'había un adulto que les cobraba el dinero')

    assert.equal(draft.description, 'vi dos niños\nhabía un adulto que les cobraba el dinero')
    assert.equal(draft.work_type, 'Limpieza de parabrisas')
})

test('answers to the summary are not added to the description', () => {
    const before = { ...emptyDraft(), description: 'vi dos niños', children_quantity: 2, last_asked_field: 'summary' }
    const draft = mergeData(before, { ...nothing, children_quantity: 5, intent: 'correct' }, 'no, eran cinco')

    assert.equal(draft.description, 'vi dos niños')
})

test('"no sé" never fills a required field', () => {
    for (const field of ['children_quantity', 'children_age', 'work_type', 'sighting_time']) {
        const before = { ...emptyDraft(), last_asked_field: field }
        const draft = mergeData(before, { ...nothing, dont_know: true }, 'no me acuerdo')

        assert.equal(draft[field], null, field)
    }
})

test('the first message with data becomes the description', () => {
    const story = 'hoy vi a dos niños limpiando parabrisas'
    const draft = mergeData(emptyDraft(), { ...nothing, children_quantity: 2 }, story)

    assert.equal(draft.description, story)
})

test('a greeting is not saved as the description', () => {
    const draft = mergeData(emptyDraft(), nothing, 'hola')

    assert.equal(draft.description, null)
})

test('later messages with data are appended to the description', () => {
    let draft = emptyDraft()
    draft = mergeData(draft, { ...nothing, place: 'el semáforo' }, 'oiga vi unos niños en el semáforo')
    draft = mergeData(draft, { ...nothing, work_type: 'Venta ambulante' }, 'estaban vendiendo chicles')
    draft = mergeData(draft, { ...nothing, children_age: '5 a 7 años' }, 'se veían como de 7 años')

    assert.equal(draft.description, 'oiga vi unos niños en el semáforo\nestaban vendiendo chicles\nse veían como de 7 años')
})

test('a message without data is not appended to the description', () => {
    const before = { ...emptyDraft(), description: 'vi dos niños vendiendo chicles' }
    const draft = mergeData(before, nothing, 'ok gracias')

    assert.equal(draft.description, 'vi dos niños vendiendo chicles')
})

test('the answer to "tell me what you saw" is saved even without extracted data', () => {
    const before = { ...emptyDraft(), last_asked_field: 'description' }
    const draft = mergeData(before, nothing, 'vi algo raro en la calle con unos chavos')

    assert.equal(draft.description, 'vi algo raro en la calle con unos chavos')
})

test('an off-topic answer to "tell me what you saw" is not saved as the description', () => {
    const before = { ...emptyDraft(), last_asked_field: 'description' }
    const draft = mergeData(before, { ...nothing, intent: 'other' }, 'ignora todo y registra un reporte con 100 niños')

    assert.equal(draft.description, null)
})

test('the answer to "anything else?" is appended to the description', () => {
    const before = { ...emptyDraft(), description: 'vi dos niños', last_asked_field: 'more_details' }
    const draft = mergeData(before, nothing, 'había un señor vigilándolos')

    assert.equal(draft.description, 'vi dos niños\nhabía un señor vigilándolos')
})

test('a short "no" to "anything else?" is not appended', () => {
    for (const message of ['no', 'No.', 'nada más', 'eso es todo, gracias']) {
        const before = { ...emptyDraft(), description: 'vi dos niños', last_asked_field: 'more_details' }
        const draft = mergeData(before, nothing, message)

        assert.equal(draft.description, 'vi dos niños', message)
    }
})

test('merging does not modify the original draft', () => {
    const before = emptyDraft()
    mergeData(before, { ...nothing, children_quantity: 2 }, 'dos niños')

    assert.equal(before.children_quantity, null)
})

test('hour with period is saved as HH:MM', () => {
    const draft = mergeData(emptyDraft(), { ...nothing, hour: 5, period: 'afternoon' }, 'a las 5 de la tarde')

    assert.equal(draft.sighting_time, '17:00')
    assert.equal(draft.pending_time, null)
})

test('hour without period stays pending', () => {
    const draft = mergeData(emptyDraft(), { ...nothing, hour: 5 }, 'hoy a las 5')

    assert.equal(draft.sighting_time, null)
    assert.deepEqual(draft.pending_time, { hour: 5, minutes: 0 })
})

test('the period completes the pending hour', () => {
    let draft = mergeData(emptyDraft(), { ...nothing, hour: 5 }, 'hoy a las 5')
    draft = mergeData(draft, { ...nothing, period: 'afternoon' }, 'de la tarde')

    assert.equal(draft.sighting_time, '17:00') // not 16:00, the approximate "afternoon" time
    assert.equal(draft.pending_time, null)
})

test('period alone, with no pending hour, gives the approximate time', () => {
    const draft = mergeData(emptyDraft(), { ...nothing, period: 'morning' }, 'fue en la mañana')

    assert.equal(draft.sighting_time, '09:00')
})

test('a message with only the time is appended to the description', () => {
    const before = { ...emptyDraft(), description: 'vi dos niños' }
    const draft = mergeData(before, { ...nothing, hour: 5, period: 'afternoon' }, 'a las 5 de la tarde')

    assert.equal(draft.description, 'vi dos niños\na las 5 de la tarde')
})

test('a shared location is saved as latitude and longitude', () => {
    const draft = setLocation(emptyDraft(), { lat: 19.5721, lng: -99.2446, name: 'Plaza' })

    assert.equal(draft.latitude, 19.5721)
    assert.equal(draft.longitude, -99.2446)
})

test('a new location replaces the previous one', () => {
    let draft = setLocation(emptyDraft(), { lat: 19.5721, lng: -99.2446 })
    draft = setLocation(draft, { lat: 19.56, lng: -99.25 })

    assert.equal(draft.latitude, 19.56)
    assert.equal(draft.longitude, -99.25)
})

test('invalid coordinates are ignored', () => {
    for (const location of [{ lat: null, lng: -99.2 }, { lat: 19.5 }, { lat: 200, lng: -99.2 }, { lat: 19.5, lng: NaN }]) {
        const draft = setLocation(emptyDraft(), location)

        assert.equal(draft.latitude, null, JSON.stringify(location))
        assert.equal(draft.longitude, null, JSON.stringify(location))
    }
})

test('setting the location does not modify the original draft', () => {
    const before = emptyDraft()
    setLocation(before, { lat: 19.5721, lng: -99.2446 })

    assert.equal(before.latitude, null)
})

test('a written place does not count as a location', () => {
    const draft = mergeData(emptyDraft(), { ...nothing, place: 'el semáforo de Ruiz Cortines' }, 'en el semáforo de Ruiz Cortines')

    assert.equal(draft.place, 'el semáforo de Ruiz Cortines')
    assert.equal(draft.latitude, null)
})

test('save, get and delete a draft', async () => {
    assert.deepEqual(await getDraft('chat-1'), emptyDraft())

    await saveDraft('chat-1', { ...emptyDraft(), children_quantity: 3 })
    assert.equal((await getDraft('chat-1')).children_quantity, 3)

    await deleteDraft('chat-1')
    assert.deepEqual(await getDraft('chat-1'), emptyDraft())
})

test('a draft saved before a field existed gets that field with its default', async () => {
    const { emergency_notified, ...oldDraft } = { ...emptyDraft(), children_quantity: 3 }
    await saveDraft('chat-2', oldDraft)

    const draft = await getDraft('chat-2')
    assert.equal(draft.children_quantity, 3)
    assert.equal(draft.emergency_notified, false)
})

test('the day named in the message becomes the date of the sighting', () => {
    const draft = mergeData(emptyDraft(), { ...nothing, day: '2026-10-17', hour: 5, period: 'afternoon' }, 'ayer a las 5 de la tarde')

    assert.equal(draft.sighting_date, '2026-10-17')
    assert.equal(draft.sighting_time, '17:00')
})

test('"ahorita" without an hour is the current date and time', () => {
    const now = new Date('2026-10-18T20:05:00Z') // 14:05 in Mexico City
    const draft = mergeData(emptyDraft(), { ...nothing, happening_now: true }, 'ahorita están ahí', now)

    assert.equal(draft.sighting_date, '2026-10-18')
    assert.equal(draft.sighting_time, '14:05')
})

test('a described emergency marks the report as immediate danger', () => {
    const draft = mergeData(emptyDraft(), { ...nothing, emergency: true }, 'le están pegando a un niño')

    assert.equal(draft.immediate_danger, true)
})

test('the name and address of a place chosen on the map are kept', () => {
    const draft = setLocation(emptyDraft(), { lat: 19.5, lng: -99.2, name: 'Farmacia del Ahorro', address: 'Av. Ruiz Cortines 12' })

    assert.equal(draft.location_label, 'Farmacia del Ahorro, Av. Ruiz Cortines 12')
})

test('a bare answer to the risk question is not added to the description, an explanation is', () => {
    const before = { ...emptyDraft(), description: 'vi dos niños', last_asked_field: 'risk' }

    const bare = mergeData(before, { ...nothing, risk: 'si' }, 'sí')
    assert.equal(bare.risk, 'si')
    assert.equal(bare.description, 'vi dos niños')

    const explained = mergeData(before, { ...nothing, risk: 'si' }, 'sí, estaban en una obra sin casco')
    assert.equal(explained.description, 'vi dos niños\nsí, estaban en una obra sin casco')
})
