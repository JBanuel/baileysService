import { test } from 'node:test'
import assert from 'node:assert/strict'
import { emptyDraft } from '../src/report/draft.js'
import { toReportPayload } from '../src/report/send.js'

// 2026-10-18 14:00 in Mexico City (UTC-6)
const NOW = new Date('2026-10-18T20:00:00Z')

const draft = () => ({
    ...emptyDraft(),
    description: 'Niño vendiendo dulces en el crucero',
    latitude: 19.4326,
    longitude: -99.1332,
    children_quantity: 1,
    children_age: '6 a 11 años',
    work_type: ['Venta ambulante', 'Limpieza de parabrisas'],
    risk: 'si',
    immediate_danger: false,
    sighting_date: '2026-10-18',
    sighting_time: '14:30',
    place: 'Frente a la farmacia',
})

test('the payload has the shape the API expects', () => {
    assert.deepEqual(toReportPayload(draft(), NOW), {
        description: 'Niño vendiendo dulces en el crucero',
        latitude: 19.4326,
        longitude: -99.1332,
        children_quantity: 1,
        children_age: '6 a 11 años',
        work_type: 'Venta ambulante, Limpieza de parabrisas',
        sighting_time: '2026-10-18T14:30',
        risk: 'si',
        immediate_danger: false,
        reference: 'Frente a la farmacia',
    })
})

test('an unknown quantity is left out', () => {
    assert.equal('children_quantity' in toReportPayload({ ...draft(), children_quantity: 'No sé' }, NOW), false)
})

test('without a day, the sighting is on the day of the report', () => {
    assert.equal(toReportPayload({ ...draft(), sighting_date: null }, NOW).sighting_time, '2026-10-18T14:30')
})

test('the reference comes from the map when the person did not describe the place', () => {
    const payload = toReportPayload({ ...draft(), place: null, location_label: 'Farmacia del Ahorro' }, NOW)
    assert.equal(payload.reference, 'Farmacia del Ahorro')

    assert.equal('reference' in toReportPayload({ ...draft(), place: null }, NOW), false)
})

test('the reference is cut to the 500 characters the API accepts', () => {
    assert.equal(toReportPayload({ ...draft(), place: 'x'.repeat(600) }, NOW).reference.length, 500)
})

test('a missing risk is sent as "no_se"', () => {
    assert.equal(toReportPayload({ ...draft(), risk: null }, NOW).risk, 'no_se')
})
