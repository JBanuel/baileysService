import { test } from 'node:test'
import assert from 'node:assert/strict'
import { emptyDraft } from '../src/report/draft.js'
import { nextStep } from '../src/report/rules.js'

const nothing = { emergency: false }

const LONG_STORY = 'hoy en la tarde vi a dos niños como de ocho años limpiando parabrisas en el semáforo de Ruiz Cortines'

// A draft with everything the database needs
const complete = () => ({
    ...emptyDraft(),
    description: LONG_STORY,
    work_type: ['Limpieza de parabrisas'],
    children_quantity: 2,
    children_age: '6 a 11 años',
    risk: 'no',
    sighting_time: '17:00',
    latitude: 19.5721,
    longitude: -99.2446,
    photos_asked: true,
})

// 2026-10-08 17:30 in Mexico City (UTC-6)
const NOW = new Date('2026-10-08T23:30:00Z')

test('an emergency warns about 911 and goes on with the next question in the same message', () => {
    const { draft, action } = nextStep(emptyDraft(), { emergency: true })

    assert.deepEqual(action, { type: 'ask', field: 'description', emergency: true })
    assert.equal(draft.emergency_notified, true)
    assert.equal(draft.last_asked_field, 'description')
})

test('after the 911 warning, a courtesy answer repeats the real pending question', () => {
    const first = nextStep({ ...complete(), latitude: null, longitude: null }, { emergency: true })
    const { action } = nextStep(first.draft, { ...nothing, intent: 'courtesy' })

    assert.equal(first.action.field, 'location')
    assert.deepEqual(action, { type: 'courtesy', reviewing: false })
    assert.equal(first.draft.last_asked_field, 'location')
})

test('an empty draft asks for the description', () => {
    const { draft, action } = nextStep(emptyDraft(), nothing)

    assert.deepEqual(action, { type: 'ask', field: 'description' })
    assert.equal(draft.last_asked_field, 'description')
})

test('missing fields are asked in order', () => {
    const draft = { ...complete(), work_type: null, children_age: null }

    assert.equal(nextStep(draft, nothing).action.field, 'work_type')
    assert.equal(nextStep({ ...draft, work_type: 'Mendicidad' }, nothing).action.field, 'children_age')
})

test('a pending hour asks for the period before anything else about time', () => {
    const draft = { ...complete(), sighting_time: null, pending_time: { hour: 5, minutes: 0 } }

    assert.equal(nextStep(draft, nothing).action.field, 'time_period')
})

test('the location is asked last among the data', () => {
    const draft = { ...complete(), latitude: null, longitude: null }

    assert.deepEqual(nextStep(draft, nothing).action, { type: 'ask', field: 'location' })
})

test('an unanswered question gets options once', () => {
    const before = { ...complete(), children_quantity: null, last_asked_field: 'children_quantity' }
    const { draft, action } = nextStep(before, { emergency: false, dont_know: true })

    assert.equal(action.field, 'children_quantity')
    assert.deepEqual(action.options, ['1', '2', '3', '4', '5 o más'])
    assert.deepEqual(draft.approximation_asked, ['children_quantity'])
})

test('still unanswered after the options: the default is used and the bot moves on', () => {
    const before = {
        ...complete(),
        children_quantity: null,
        children_age: null,
        last_asked_field: 'children_quantity',
        approximation_asked: ['children_quantity'],
    }
    const { draft, action } = nextStep(before, nothing)

    assert.equal(draft.children_quantity, 'No sé')
    assert.deepEqual(draft.defaults_used, ['children_quantity'])
    assert.equal(action.field, 'children_age')
})

test('defaults are "No sé", like in the web form', () => {
    const expected = { children_quantity: 'No sé', children_age: 'No sé', work_type: ['No sé'] }
    for (const [field, value] of Object.entries(expected)) {
        const before = { ...complete(), [field]: null, last_asked_field: field, approximation_asked: [field] }
        const { draft } = nextStep(before, nothing)

        assert.deepEqual(draft[field], value, field)
    }
})

test('the risk is asked after the age, and a "no sé" is final', () => {
    const before = { ...complete(), risk: null }
    const asked = nextStep(before, nothing)
    assert.deepEqual(asked.action, { type: 'ask', field: 'risk' })

    const { draft, action } = nextStep(asked.draft, { ...nothing, dont_know: true })
    assert.equal(draft.risk, 'no_se')
    assert.notEqual(action.field, 'risk')
})

test('correcting the danger flips it, unless the message describes an emergency', () => {
    const summary = { ...complete(), immediate_danger: true, emergency_notified: true, last_asked_field: 'summary' }

    const flipped = nextStep(summary, { ...nothing, intent: 'correct', correction_field: 'immediate_danger' })
    assert.equal(flipped.draft.immediate_danger, false)

    const stillDanger = nextStep(summary, { emergency: true, intent: 'correct', correction_field: 'immediate_danger' })
    assert.equal(stillDanger.draft.immediate_danger, true)
})

test('unknown a.m./p.m. is guessed from the hour', () => {
    const ask = (hour) => ({
        ...complete(),
        sighting_time: null,
        pending_time: { hour, minutes: 0 },
        last_asked_field: 'time_period',
    })

    assert.equal(nextStep(ask(5), nothing).draft.sighting_time, '17:00')
    assert.equal(nextStep(ask(8), nothing).draft.sighting_time, '08:00')
    assert.equal(nextStep(ask(12), nothing).draft.sighting_time, '12:00')
})

test('unknown time after the options defaults to the time of the report', () => {
    const before = {
        ...complete(),
        sighting_time: null,
        last_asked_field: 'sighting_time',
        approximation_asked: ['sighting_time'],
    }
    const { draft } = nextStep(before, nothing, NOW)

    assert.equal(draft.sighting_time, '17:30')
    assert.deepEqual(draft.defaults_used, ['sighting_time'])
})

test('the location never gets a default: it is asked again with help', () => {
    const before = { ...complete(), latitude: null, longitude: null, last_asked_field: 'location' }
    const { draft, action } = nextStep(before, nothing)

    assert.deepEqual(action, { type: 'ask', field: 'location', help: true })
    assert.equal(draft.latitude, null)
})

test('the description is asked again with help, without options', () => {
    const before = { ...emptyDraft(), last_asked_field: 'description' }

    assert.deepEqual(nextStep(before, nothing).action, { type: 'ask', field: 'description', help: true })
})

test('a short description asks for more details only once', () => {
    const before = { ...complete(), description: 'vi dos niños' }
    const first = nextStep(before, nothing)

    assert.deepEqual(first.action, { type: 'ask', field: 'more_details' })
    assert.equal(nextStep(first.draft, nothing).action.type, 'summary')
})

test('a complete draft with a long description goes to the summary', () => {
    const { draft, action } = nextStep(complete(), nothing)

    assert.deepEqual(action, { type: 'summary', defaults_used: [] })
    assert.equal(draft.last_asked_field, 'summary')
})

test('the summary lists the defaults used', () => {
    const before = { ...complete(), defaults_used: ['children_quantity'] }

    assert.deepEqual(nextStep(before, nothing).action.defaults_used, ['children_quantity'])
})

test('nextStep does not modify the original draft', () => {
    const before = { ...complete(), children_quantity: null, last_asked_field: 'children_quantity' }
    nextStep(before, nothing)

    assert.equal(before.children_quantity, null)
    assert.deepEqual(before.approximation_asked, [])
})

test('confirming the summary marks the report as confirmed', () => {
    const before = { ...complete(), last_asked_field: 'summary' }
    const { draft, action } = nextStep(before, { ...nothing, intent: 'confirm' })

    assert.deepEqual(action, { type: 'confirmed' })
    assert.equal(draft.confirmed, true)
})

test('a correction with the new value shows the summary again', () => {
    const before = { ...complete(), children_quantity: 5, last_asked_field: 'summary' } // mergeData already applied it
    const { action } = nextStep(before, { ...nothing, intent: 'correct', children_quantity: 5 })

    assert.equal(action.type, 'summary')
})

test('a correction that names the field without a value asks for it again', () => {
    const before = { ...complete(), last_asked_field: 'summary' }
    const { draft, action } = nextStep(before, { ...nothing, intent: 'correct', correction_field: 'children_age' })

    assert.deepEqual(action, { type: 'ask', field: 'children_age' })
    assert.equal(draft.children_age, null)
})

test('correcting a field that had a default lets the person answer from scratch', () => {
    const before = {
        ...complete(),
        children_quantity: 1,
        defaults_used: ['children_quantity'],
        approximation_asked: ['children_quantity'],
        last_asked_field: 'summary',
    }
    const { draft } = nextStep(before, { ...nothing, intent: 'correct', correction_field: 'children_quantity' })

    assert.deepEqual(draft.defaults_used, [])
    assert.deepEqual(draft.approximation_asked, [])
})

test('correcting the location or the time clears them', () => {
    const summary = { ...complete(), last_asked_field: 'summary' }

    const location = nextStep(summary, { ...nothing, intent: 'correct', correction_field: 'location' })
    assert.deepEqual(location.action, { type: 'ask', field: 'location' })
    assert.equal(location.draft.latitude, null)

    const time = nextStep(summary, { ...nothing, intent: 'correct', correction_field: 'sighting_time' })
    assert.deepEqual(time.action, { type: 'ask', field: 'sighting_time' })
    assert.equal(time.draft.sighting_time, null)
})

test('a correction without saying what is wrong asks which data to correct', () => {
    const before = { ...complete(), last_asked_field: 'summary' }
    const { draft, action } = nextStep(before, { ...nothing, intent: 'correct' })

    assert.deepEqual(action, { type: 'ask', field: 'correction' })
    assert.equal(draft.last_asked_field, 'correction')
})

test('after asking which data to correct, naming it asks for that field', () => {
    const before = { ...complete(), last_asked_field: 'correction' }
    const { action } = nextStep(before, { ...nothing, intent: 'correct', correction_field: 'work_type' })

    assert.deepEqual(action, { type: 'ask', field: 'work_type' })
})

test('something off topic during the summary keeps waiting for the confirmation', () => {
    const before = { ...complete(), last_asked_field: 'summary' }
    const { draft, action } = nextStep(before, { ...nothing, intent: 'other' })

    assert.deepEqual(action, { type: 'off_topic', reviewing: true })
    assert.equal(draft.last_asked_field, 'summary')
})

test('an emergency during the summary still comes first', () => {
    const before = { ...complete(), last_asked_field: 'summary' }

    assert.equal(nextStep(before, { emergency: true, intent: 'other' }).action.emergency, true)
})

test('new details during the summary show it again, noting the addition', () => {
    const before = { ...complete(), last_asked_field: 'summary' }
    const { draft, action } = nextStep(before, { ...nothing, intent: 'add' })

    assert.deepEqual(action, { type: 'summary', added_details: true, defaults_used: [] })
    assert.equal(draft.last_asked_field, 'summary')
})

test('the emergency message is sent only once', () => {
    const first = nextStep(emptyDraft(), { emergency: true })
    const second = nextStep({ ...first.draft, description: LONG_STORY }, { emergency: true })

    assert.equal(first.action.emergency, true)
    assert.equal(second.action.emergency, undefined)
})

test('something off topic in the middle of the report keeps the pending question', () => {
    const before = { ...complete(), children_age: null, last_asked_field: 'children_age' }
    const { draft, action } = nextStep(before, { ...nothing, intent: 'other' })

    assert.deepEqual(action, { type: 'off_topic', reviewing: false })
    assert.equal(draft.last_asked_field, 'children_age')
    assert.deepEqual(draft.approximation_asked, []) // it doesn't count as not knowing the answer
})

test('a message marked off topic but with report data is treated as part of the report', () => {
    const before = { ...complete(), children_age: '8 a 10 años', last_asked_field: 'children_age' }
    const { action } = nextStep(before, { ...nothing, intent: 'other', children_age: '8 a 10 años' })

    assert.notEqual(action.type, 'off_topic')
})

test('"no sé" is never treated as off topic', () => {
    const before = { ...complete(), children_quantity: null, last_asked_field: 'children_quantity' }
    const { action } = nextStep(before, { ...nothing, intent: 'other', dont_know: true })

    assert.notEqual(action.type, 'off_topic')
})

test('a "yes" to "what do you want to correct?" shows the summary again instead of confirming', () => {
    const before = { ...complete(), last_asked_field: 'correction' }
    const { draft, action } = nextStep(before, { ...nothing, intent: 'confirm' })

    assert.equal(action.type, 'summary')
    assert.equal(draft.confirmed, false)
    assert.equal(draft.last_asked_field, 'summary')
})

test('a greeting or thanks gets a courtesy answer, not the off-topic one', () => {
    const { draft, action } = nextStep(emptyDraft(), { ...nothing, intent: 'courtesy' })

    assert.deepEqual(action, { type: 'courtesy', reviewing: false })
    assert.equal(draft.last_asked_field, null)
})

test('a courtesy message in the middle of the report keeps the pending question', () => {
    const before = { ...complete(), children_age: null, last_asked_field: 'children_age' }
    const { draft, action } = nextStep(before, { ...nothing, intent: 'courtesy' })

    assert.equal(action.type, 'courtesy')
    assert.equal(draft.last_asked_field, 'children_age')
})

const photo = (n) => ({ path: `storage/photos/${n}.jpg`, contentType: 'image/jpeg' })

test('photos are offered once, after the location', () => {
    const before = { ...complete(), photos_asked: false }
    const { draft, action } = nextStep(before, nothing)

    assert.deepEqual(action, { type: 'ask', field: 'photos' })
    assert.equal(draft.photos_asked, true)
})

test('photos are not offered if the person already sent one', () => {
    const before = { ...complete(), photos_asked: false, photos: [photo(1)] }

    assert.equal(nextStep(before, nothing).action.type, 'summary')
})

test('any text in the photo step moves on, even "no gracias"', () => {
    for (const intent of ['report', 'courtesy', 'other']) {
        const before = { ...complete(), last_asked_field: 'photos' }
        assert.equal(nextStep(before, { ...nothing, intent }).action.type, 'summary', intent)
    }
})

test('the first photo in the photo step asks for another one', () => {
    const before = { ...complete(), last_asked_field: 'photos', photos: [photo(1)] }
    const { action } = nextStep(before, { ...nothing, photo: 'accepted' })

    assert.deepEqual(action, { type: 'ask', field: 'more_photos', photo_ack: 1 })
})

test('the second photo moves on to the summary', () => {
    const before = { ...complete(), last_asked_field: 'more_photos', photos: [photo(1), photo(2)] }
    const { action } = nextStep(before, { ...nothing, photo: 'accepted' })

    assert.equal(action.type, 'summary')
    assert.equal(action.photo_ack, 2)
})

test('a photo sent before being asked is acknowledged and the flow continues', () => {
    const before = { ...complete(), latitude: null, longitude: null, photos_asked: false, photos: [photo(1)] }
    const { action } = nextStep(before, { ...nothing, photo: 'accepted' })

    assert.equal(action.field, 'location')
    assert.equal(action.photo_ack, 1)
})

test('a photo sent during the summary shows it again', () => {
    const before = { ...complete(), last_asked_field: 'summary', photos: [photo(1)] }
    const { action } = nextStep(before, { ...nothing, photo: 'accepted' })

    assert.equal(action.type, 'summary')
})

test('a third photo is rejected and the pending question is kept', () => {
    const before = { ...complete(), last_asked_field: 'summary', photos: [photo(1), photo(2)] }
    const { draft, action } = nextStep(before, { ...nothing, photo: 'too_many' })

    assert.deepEqual(action, { type: 'photo_rejected', reason: 'too_many' })
    assert.equal(draft.last_asked_field, 'summary')
})

test('a shared location is not a failed answer: the same question is asked again, without options', () => {
    const before = { ...complete(), children_quantity: null, last_asked_field: 'children_quantity' }
    const { draft, action } = nextStep(before, { ...nothing, location: true })

    assert.deepEqual(action, { type: 'ask', field: 'children_quantity', help: true })
    assert.deepEqual(draft.approximation_asked, [])
})

test('a photo is not a failed answer either: no default is used', () => {
    const before = {
        ...complete(),
        children_quantity: null,
        last_asked_field: 'children_quantity',
        approximation_asked: ['children_quantity'],
        photos: [photo(1)],
    }
    const { draft, action } = nextStep(before, { ...nothing, photo: 'accepted' })

    assert.equal(draft.children_quantity, null)
    assert.deepEqual(draft.defaults_used, [])
    assert.equal(action.field, 'children_quantity')
    assert.equal(action.photo_ack, 1)
})
