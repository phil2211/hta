import OpenAI from "openai";
import { openAIKey } from "./config.js"; // Import the OpenAI API key from a separate file

if (!openAIKey) {
    throw new Error("OpenAI API key is required.");
 }

const openai = new OpenAI({ apiKey: openAIKey });

export async function createEmbedding(text) {
    /**
     * Creates an embedding for a given text using OpenAI's ADA002 model.
     *
     * @param {string} text The text to embed.
     * @returns {Array<number>} The embedding vector.
     * @throws {Error} If there is an error during the OpenAI API call.
     */
    try {
      const response = await openai.embeddings.create({
        model: "text-embedding-ada-002",
        input: text,
      });

      if (response.data && response.data.length > 0) {
        return response.data[0].embedding;
      } else {
        throw new Error("No embedding returned from OpenAI API.");
      }
    } catch (error) {
      console.error("Error creating embedding:", error);
      throw error; // Re-throw the error for handling by the caller
    }
  }

export function getOpenAI() {
    return openai;
}
