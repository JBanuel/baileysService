try {
    process.loadEnvFile()
} catch { }

export const LLM_MODEL = process.env.LLM_MODEL ?? 'qwen2.5:3b'
export const TEST_PHONE_NUMBER = process.env.TEST_PHONE_NUMBER
