export const TIPOS_TRABAJO = [
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

export const RANGOS_EDAD = ['Menos de 5 años', '5 a 7 años', '8 a 10 años', '11 a 13 años', '14 a 17 años', 'No sé']

export function rangoDeEdad(edad) {
    if (edad === null || edad === undefined) return null
    if (edad < 5) return 'Menos de 5 años'
    if (edad <= 7) return '5 a 7 años'
    if (edad <= 10) return '8 a 10 años'
    if (edad <= 13) return '11 a 13 años'
    if (edad <= 17) return '14 a 17 años'
    return null 
}
