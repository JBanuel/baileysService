import { test } from 'node:test'
import assert from 'node:assert/strict'
import { amPmPeriod, mentionsPeriod, periodFromText, toSightingTime } from '../src/report/time.js'

test('hour with period', () => {
    assert.deepEqual(toSightingTime({ hour: 5, period: 'afternoon' }), { time: '17:00' })
    assert.deepEqual(toSightingTime({ hour: 8, period: 'morning' }), { time: '08:00' })
    assert.deepEqual(toSightingTime({ hour: 9, period: 'night' }), { time: '21:00' })
    assert.deepEqual(toSightingTime({ hour: 1, period: 'noon' }), { time: '13:00' })
    assert.deepEqual(toSightingTime({ hour: 3, period: 'early_morning' }), { time: '03:00' })
})

test('12 depends on the period', () => {
    assert.deepEqual(toSightingTime({ hour: 12, period: 'noon' }), { time: '12:00' })
    assert.deepEqual(toSightingTime({ hour: 12, period: 'afternoon' }), { time: '12:00' })
    assert.deepEqual(toSightingTime({ hour: 12, period: 'night' }), { time: '00:00' })
})

test('"las 2 de la noche" means early morning', () => {
    assert.deepEqual(toSightingTime({ hour: 2, period: 'night' }), { time: '02:00' })
})

test('minutes', () => {
    assert.deepEqual(toSightingTime({ hour: 7, minutes: 30, period: 'night' }), { time: '19:30' })
    assert.deepEqual(toSightingTime({ hour: 19, minutes: 5 }), { time: '19:05' })
})

test('24-hour times need no period', () => {
    assert.deepEqual(toSightingTime({ hour: 19 }), { time: '19:00' })
    assert.deepEqual(toSightingTime({ hour: 0 }), { time: '00:00' })
})

test('period alone gives an approximate time', () => {
    assert.deepEqual(toSightingTime({ period: 'morning' }), { time: '09:00' })
    assert.deepEqual(toSightingTime({ period: 'afternoon' }), { time: '16:00' })
    assert.deepEqual(toSightingTime({ period: 'night' }), { time: '20:00' })
})

test('1 to 12 without period stays pending', () => {
    assert.deepEqual(toSightingTime({ hour: 5 }), { pending: { hour: 5, minutes: 0 } })
    assert.deepEqual(toSightingTime({ hour: 7, minutes: 30 }), { pending: { hour: 7, minutes: 30 } })
})

test('no hour and no period returns nothing', () => {
    assert.deepEqual(toSightingTime({}), {})
    assert.deepEqual(toSightingTime({ hour: null, period: null }), {})
})

test('impossible values are ignored', () => {
    assert.deepEqual(toSightingTime({ hour: 30 }), {})
    assert.deepEqual(toSightingTime({ hour: 5, minutes: 90, period: 'afternoon' }), { time: '17:00' })
})

test('period from text', () => {
    assert.equal(periodFromText('de la tarde'), 'afternoon')
    assert.equal(periodFromText('todas las mañanas'), 'morning')
    assert.equal(periodFromText('al mediodía'), 'noon')
    assert.equal(periodFromText('en la madrugada'), 'early_morning')
    assert.equal(periodFromText('hoy'), null)
})

test('the period counts only if the message mentions it', () => {
    assert.equal(mentionsPeriod('en la tarde, no me fijé la hora', 'afternoon'), true)
    assert.equal(mentionsPeriod('hoy a las 5', 'morning'), false)
    assert.equal(mentionsPeriod('hoy a las 5', null), false)
})

test('am and pm right after a number', () => {
    assert.equal(amPmPeriod('como a las 8 am'), 'morning')
    assert.equal(amPmPeriod('a las 7 pm'), 'afternoon')
    assert.equal(amPmPeriod('7:30 p.m.'), 'afternoon')
    assert.equal(amPmPeriod('a las 9 a. m.'), 'morning')
    assert.equal(amPmPeriod('A las 6 o 7 PM'), 'afternoon')
})

test('am and pm inside words do not count', () => {
    assert.equal(amPmPeriod('vi a 2 amigos'), null)
    assert.equal(amPmPeriod('estaba en la cama'), null)
    assert.equal(amPmPeriod('pm'), null)
})
