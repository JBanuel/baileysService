/**
 * Catalogs of the SIPINNA report. Values are in Spanish because they are sent
 * to the API exactly as written.
 *
 * @module report/categories
 */

/**
 * Activities a child can be reported doing (`work_type`).
 * @type {string[]}
 */
export const WORK_TYPES = [
    'Venta ambulante',
    'Limpieza de parabrisas',
    'Mendicidad',
    'Carga y descarga',
    'Trabajo en comercio',
    'Campo',
    'Construcción',
    'Trabajo doméstico',
    'Recolección de residuos',
    'Otra actividad',
    'No sé',
]

/**
 * Age ranges of the report (`children_age`), the same as in the web form.
 * @type {string[]}
 */
export const AGE_RANGES = ['0 a 5 años', '6 a 11 años', '12 a 14 años', '15 a 17 años', 'No sé']

/**
 * Converts an approximate age in years into its range, for example `12` → `"12 a 14 años"`.
 *
 * @param {number | null | undefined} age
 * @returns {string | null} One of {@link AGE_RANGES}, or `null` when there is
 *   no age or it is 18 or more.
 */
export function ageRange(age) {
    if (age === null || age === undefined) return null
    if (age <= 5) return '0 a 5 años'
    if (age <= 11) return '6 a 11 años'
    if (age <= 14) return '12 a 14 años'
    if (age <= 17) return '15 a 17 años'
    return null
}

/**
 * Highest `children_quantity` the API accepts; it means "5 or more".
 * @type {number}
 */
export const MAX_CHILDREN_QUANTITY = 5

/**
 * Answers to "¿Observaste alguna situación de riesgo?" (`risk`), as the API expects them.
 * @type {string[]}
 */
export const RISK_ANSWERS = ['si', 'no', 'no_se']
