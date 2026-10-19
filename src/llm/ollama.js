/**
 * Calls to the local language model through Ollama (`http://127.0.0.1:11434`).
 * Thinking mode is turned off to keep answers fast.
 *
 * @module llm/ollama
 */

import { Ollama } from 'ollama'
import { LLM_MODEL } from '../config.js'

const client = new Ollama({ host: 'http://127.0.0.1:11434' })
const MODEL = LLM_MODEL

/**
 * Asks the model for free text, such as a reply to the person.
 *
 * @param {import('ollama').Message[]} messages Conversation to send, system prompt first.
 * @returns {Promise<string>} The model's answer.
 */
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

/**
 * Asks the model for JSON constrained to `schema`, with temperature 0 so the
 * same message yields the same data.
 *
 * @param {import('ollama').Message[]} messages Conversation to send, system prompt first.
 * @param {object} schema JSON Schema the answer must follow.
 * @returns {Promise<any>} The parsed answer.
 */
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