import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
    confirmedMessage,
    correctionQuestion,
    emergencyMessage,
    offTopicMessage,
    summaryMessage,
    riskQuestion,
    timePeriodQuestion,
    toWhatsAppFormat,
    courtesyMessage,
    followUp,
    writeReply,
    writeReplyParts,
} from '../src/report/writer.js'
import { REFERRAL_OPTIONS } from '../src/report/referrals.js'

const draft = {
    children_quantity: 3,
    children_age: '12 a 14 años',
    work_type: ['Limpieza de parabrisas', 'Venta ambulante'],
    risk: 'si',
    immediate_danger: false,
    sighting_date: null,
    sighting_time: '17:00',
    photos: [],
}

// 2026-10-18 14:00 in Mexico City (UTC-6)
const NOW = new Date('2026-10-18T20:00:00Z')

test('the emergency message always mentions 911', () => {
    assert.match(emergencyMessage(), /911/)
})

test('the summary shows the exact data', () => {
    const message = summaryMessage(draft, {}, NOW)

    assert.match(message, /Niñas o niños:\* 3/)
    assert.match(message, /Edad aproximada:\* 12 a 14 años/)
    assert.match(message, /Actividad:\* Limpieza de parabrisas, Venta ambulante/)
    assert.match(message, /Situación de riesgo:\* Sí/)
    assert.match(message, /Peligro inmediato:\* No/)
    assert.match(message, /Cuándo:\* hoy a las 17:00/)
    assert.match(message, /¿Los datos son correctos\?/)
})

test('the summary shows 5 as "5 o más" and the day of the sighting', () => {
    assert.match(summaryMessage({ ...draft, children_quantity: 5 }, {}, NOW), /Niñas o niños:\* 5 o más/)
    assert.match(summaryMessage({ ...draft, sighting_date: '2026-10-17' }, {}, NOW), /Cuándo:\* ayer a las 17:00/)
    assert.match(summaryMessage({ ...draft, sighting_date: '2026-10-12' }, {}, NOW), /Cuándo:\* el 12\/10\/2026 a las 17:00/)
})

test('the summary says which data was left as "No sé"', () => {
    const one = summaryMessage(draft, { defaults_used: ['children_quantity'] }, NOW)
    assert.match(one, /la cantidad quedó como \*No sé\*/)

    const two = summaryMessage(draft, { defaults_used: ['children_quantity', 'children_age'] }, NOW)
    assert.match(two, /la cantidad y la edad quedaron como \*No sé\*/)
})

test('the summary says when the time is approximate, only once', () => {
    const message = summaryMessage(draft, { defaults_used: ['time_period', 'sighting_time'] }, NOW)

    assert.equal(message.match(/La hora es aproximada/g).length, 1)
})

test('the summary without defaults does not mention them', () => {
    const message = summaryMessage(draft, {}, NOW)

    assert.doesNotMatch(message, /No sé\*\. Si sabes/)
    assert.doesNotMatch(message, /La hora es aproximada/)
})

test('the summary acknowledges new details', () => {
    assert.match(summaryMessage(draft, { added_details: true }), /agregué eso a tu reporte/)
})

test('the confirmation thanks the person and gives the folio when there is one', () => {
    assert.match(confirmedMessage(), /gracias/i)
    assert.doesNotMatch(confirmedMessage(), /folio/)
    assert.match(confirmedMessage('RIETI-ATIZAPAN-2026-000123'), /Tu folio es \*RIETI-ATIZAPAN-2026-000123\*/)
})

test('the risk question gives examples and the three answers', () => {
    assert.match(riskQuestion(), /situación de riesgo[\s\S]*construcción[\s\S]*\*sí\*, \*no\* o \*no sé\*/)
})

test('the a.m./p.m. question uses words the code understands', () => {
    assert.equal(timePeriodQuestion({ hour: 5, minutes: 0 }), '¿Las 5 fueron *de la mañana* o *de la tarde*?')
    assert.equal(timePeriodQuestion({ hour: 7, minutes: 30 }), '¿Las 7:30 fueron *de la mañana* o *de la tarde*?')
})

test('an off-topic answer includes the exact link and asks about the summary again', () => {
    const message = offTopicMessage(REFERRAL_OPTIONS.municipality)

    assert.match(message, /https:\/\/www\.atizapan\.gob\.mx/)
    assert.match(message, /¿Los datos del resumen de tu reporte son correctos\?/)
})

test('an off-topic answer with no matching referral still asks about the summary', () => {
    const message = offTopicMessage(null)

    assert.doesNotMatch(message, /https?:/)
    assert.match(message, /¿Los datos del resumen de tu reporte son correctos\?/)
})

test('Markdown from the model is converted to WhatsApp format', () => {
    assert.equal(toWhatsAppFormat('Toca el botón **+** y elige **Ubicación**'), 'Toca el botón *+* y elige *Ubicación*')
    assert.equal(toWhatsAppFormat('## Gracias\nTexto'), 'Gracias\nTexto')
    assert.equal(toWhatsAppFormat('"¿Cuántos eran?"'), '¿Cuántos eran?')
})

test('the correction question is open, not yes/no', () => {
    assert.match(correctionQuestion(), /^¿Qué dato quieres corregir\?/)
})

test('after off topic: during the summary, ask about the summary again', () => {
    assert.equal(followUp({ reviewing: true }, {}), '¿Los datos del resumen de tu reporte son correctos?')
})

test('after off topic: before the report started, invite the person to report', () => {
    assert.match(followUp({ reviewing: false }, { description: null }), /cuéntame qué viste/)
})

test('after off topic: in the middle of the report, repeat the pending question', () => {
    const draft = { description: 'vi dos niños', last_reply: '¿Qué edad aproximada tenían?' }

    assert.match(followUp({ reviewing: false }, draft), /¿Qué edad aproximada tenían\?/)
})

test('courtesy with no report in progress introduces the bot', () => {
    assert.match(courtesyMessage({ reviewing: false }, { description: null }), /Soy \*Sipinnito\*/)
})

test('courtesy in the middle of the report repeats the pending question', () => {
    const draft = { description: 'vi dos niños', last_reply: '¿Qué edad aproximada tenían?' }

    assert.match(courtesyMessage({ reviewing: false }, draft), /¿Qué edad aproximada tenían\?/)
})

test('a message entirely in bold is unwrapped', () => {
    assert.equal(toWhatsAppFormat('*Toca el clip y elige "Ubicación".*'), 'Toca el clip y elige "Ubicación".')
    assert.equal(toWhatsAppFormat('Toca *Ubicación* y envía el punto.'), 'Toca *Ubicación* y envía el punto.')
})

test('the summary shows how many photos there are', () => {
    assert.match(summaryMessage(draft), /Fotos:\* ninguna/)
    assert.match(summaryMessage({ ...draft, photos: [{}, {}] }), /Fotos:\* 2/)
})

test('the 911 warning goes before the next question', async () => {
    const draft = { photos: [], pending_time: { hour: 5, minutes: 0 } }
    const reply = await writeReply({ type: 'ask', field: 'time_period', emergency: true }, draft, 'le están pegando a un niño')

    assert.match(reply, /^Si un niño o niña está en peligro[\s\S]*911[\s\S]*seguimos con tu reporte:\n\n¿Las 5 fueron/)
})

test('the question to repeat later has no 911 warning and no photo acknowledgement', async () => {
    const draft = { photos: [{}], pending_time: { hour: 5, minutes: 0 } }
    const { text, question } = await writeReplyParts({ type: 'ask', field: 'time_period', emergency: true, photo_ack: 1 }, draft, '')

    assert.match(text, /911[\s\S]*Recibí tu foto[\s\S]*¿Las 5 fueron/)
    assert.equal(question, '¿Las 5 fueron *de la mañana* o *de la tarde*?')
})
