import { Ollama } from 'ollama'
import { LLM_MODEL } from '../config.js'

const client = new Ollama({ host: 'http://127.0.0.1:11434' })
const MODEL = LLM_MODEL

export async function chat(messages) {
    const response = await client.chat({
        model: MODEL,
        messages,
        think: false,
        options: {
            temperature: 0.3,
            num_ctx: 8192,
        },
    })
    return response.message.content
}

export async function chatJSON(messages, schema) {
    const response = await client.chat({
        model: MODEL,
        messages,
        think: false,
        format: schema,
        options: {
            temperature: 0,
            num_ctx: 8192,
        },
    })
    return JSON.parse(response.message.content)
}