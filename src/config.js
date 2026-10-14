try {
    process.loadEnvFile()
} catch { }

export const LLM_MODEL = process.env.LLM_MODEL
export const ALLOWED_NUMBERS = (process.env.ALLOWED_NUMBERS ?? '')
    .split(',')
    .map((number) => number.trim())
    .filter(Boolean)

export const REDIS_URL = process.env.REDIS_URL
export const DRAFT_TTL_SECONDS = 2 * 60 * 60

export const API_URL = process.env.API_URL

export const PHOTOS_DIR = process.env.PHOTOS_DIR ?? 'storage/photos'
