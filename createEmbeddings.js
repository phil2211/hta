import OpenAI from "openai";
import { openAIKey } from "./config.js"; 

/**
 * Generates text embeddings using OpenAI's latest embedding model.
 *
 * @param {string} text The text to generate embeddings for.
 * @returns {Promise<number[] | null>} A promise that resolves to an array of numbers representing the embedding, or null if an error occurs.
 * @throws {Error} If the OpenAI API key is missing or invalid, or if the OpenAI API request fails.
 */
async function createEmbeddings(text) {

  const openai = new OpenAI({ apiKey: openAIKey });

  try {
    const response = await openai.embeddings.create({
      input: text,
      model: "text-embedding-3-large"
    });

    if (response.data && response.data.length > 0 && response.data[0].embedding) {
      return response.data[0].embedding;
    } else {
      console.error("Unexpected response structure from OpenAI:", response);
      return null; // Or throw an error, depending on desired error handling.
    }

  } catch (error) {
    console.error("Error creating embeddings:", error);
    if (error.response) {
        console.error(error.response.status);
        console.error(error.response.data);
    }
    throw error; // Re-throw the error for handling by the caller.
  }
}


export { createEmbeddings };