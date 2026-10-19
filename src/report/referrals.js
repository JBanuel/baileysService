/**
 * Where to send people who ask about something other than child labor.
 *
 * @module report/referrals
 */

/**
 * A place that can help with a topic.
 * @typedef {object} Referral
 * @property {string} label The topic it helps with, shown to the person.
 * @property {string} contact Phone number or website.
 */

/**
 * Referral options, by id. The model picks one of these ids for off-topic messages.
 * @type {Record<string, Referral>}
 */
export const REFERRAL_OPTIONS = {
    emergency: {
        label: 'Emergencia o riesgo inmediato para un niño, niña o adolescente',
        contact: 'llamar al 911',
    },
    crime_report: { label: 'Denuncia anónima de un delito', contact: '089' },
    cyber_police: {
        label: 'Contenido sexual de menores en internet o redes sociales',
        contact: 'Policía Cibernética de la Guardia Nacional, 088',
    },
    sipinna: {
        label: 'Información general sobre SIPINNA y derechos de niñas, niños y adolescentes',
        contact: 'https://www.gob.mx/sipinna',
    },
    municipality: {
        label: 'Trámites y servicios del municipio de Atizapán de Zaragoza',
        contact: 'https://www.atizapan.gob.mx',
    },
    dif: {
        label: 'Asistencia social, DIF Atizapán (apoyos, orientación familiar)',
        contact: 'https://www.difatizapan.gob.mx',
    },
    child_protection: {
        label: 'Procuraduría de Protección de Niñas, Niños y Adolescentes del Estado de México (maltrato, abuso, abandono)',
        contact: 'https://difem.edomex.gob.mx/centros-asistencia-social-nna',
    },
}

/**
 * Every referral as a bulleted list, one per line.
 * @type {string}
 */
export const REFERRALS = Object.values(REFERRAL_OPTIONS)
    .map(({ label, contact }) => `- ${label}: ${contact}.`)
    .join('\n')
