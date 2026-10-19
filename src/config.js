/**
 * Runtime configuration, read from environment variables.
 *
 * Loads `.env` from the working directory when it exists; otherwise the process
 * environment is used as is.
 *
 * @module config
 */

try {
    process.loadEnvFile()
} catch { }

/**
 * Ollama model used for extraction and replies (for example `qwen3.5:4b`).
 * @type {string | undefined}
 */
export const LLM_MODEL = process.env.LLM_MODEL
/**
 * Phone numbers the bot answers, from the comma-separated `ALLOWED_NUMBERS`.
 * Messages from any other number are ignored.
 * @type {string[]}
 */
export const ALLOWED_NUMBERS = (process.env.ALLOWED_NUMBERS ?? '')
    .split(',')
    .map((number) => number.trim())
    .filter(Boolean)

/**
 * Redis connection URL where drafts are stored (for example `redis://127.0.0.1:6379`).
 * @type {string | undefined}
 */
export const REDIS_URL = process.env.REDIS_URL
/**
 * Seconds a draft lives without activity before Redis expires it (2 hours).
 * @type {number}
 */
export const DRAFT_TTL_SECONDS = 2 * 60 * 60

/**
 * Base URL of the SIPINNA reports API.
 * @type {string | undefined}
 */
export const API_URL = process.env.API_URL

/**
 * Directory where photos received during a conversation are kept until the report is sent.
 * @type {string}
 */
export const PHOTOS_DIR = process.env.PHOTOS_DIR ?? 'storage/photos'
