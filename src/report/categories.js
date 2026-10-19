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
 * Age ranges of the report (`children_age`).
 * @type {string[]}
 */
export const AGE_RANGES = ['Menos de 5 años', '5 a 7 años', '8 a 10 años', '11 a 13 años', '14 a 17 años', 'No sé']

/**
 * Converts an approximate age in years into its range, for example `12` → `"11 a 13 años"`.
 *
 * @param {number | null | undefined} age
 * @returns {string | null} One of {@link AGE_RANGES}, or `null` when there is
 *   no age or it is 18 or more.
 */
export function ageRange(age) {
    if (age === null || age === undefined) return null
    if (age < 5) return 'Menos de 5 años'
    if (age <= 7) return '5 a 7 años'
    if (age <= 10) return '8 a 10 años'
    if (age <= 13) return '11 a 13 años'
    if (age <= 17) return '14 a 17 años'
    return null
}
