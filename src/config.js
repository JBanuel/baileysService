try {
    process.loadEnvFile()
} catch { }

export const LLM_MODEL = process.env.LLM_MODEL
export const ALLOWED_NUMBERS = (process.env.ALLOWED_NUMBERS ?? '')
    .split(',')
    .map((number) => number.trim())
    .filter(Boolean)
