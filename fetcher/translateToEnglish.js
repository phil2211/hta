// translation_module.js

import { OpenAI } from "openai";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { openAIKey } from "./config.js";

const openai = new OpenAI({
    apiKey: openAIKey
});

async function translateToEnglish(inputText) {
    if (!inputText) {
        return ""; // Handle empty input
    }

    const textSplitter = new RecursiveCharacterTextSplitter({
        chunkSize: 10000,  // Adjust as needed.  This is *characters*, not tokens, but it's a reasonable proxy.
        chunkOverlap: 200, // Overlap to maintain context between chunks
        separators: [". ", "? ", "! ", "\n"],  // Prioritize sentence boundaries.  Add others if needed.
    });

    const chunks = await textSplitter.splitText(inputText);
    const translatedChunks = [];
    let chunkIndex = 1;

    for (const chunk of chunks) {
        console.log(`Translating chunk ${chunkIndex} of ${chunks.length}`);
        chunkIndex++;
        //Check Token count before sending to OpenAI
        const num_tokens = Math.ceil(chunk.length/4); //Estimate token count: very rough approximation of 1 token per 4 characters
        if(num_tokens > 16384) {
          throw new Error(`Chunk size too large, exceeds token limit. Estimated at ${num_tokens} tokens.`);
        }


        try {
            const chatCompletion = await openai.chat.completions.create({
                messages: [
                    { role: 'system', content: 'You are a helpful assistant that translates any text to English.' },
                    { role: 'user', content: `Translate the following text to English:\n\n${chunk}` },
                ],
                model: 'gpt-3.5-turbo', // Or another suitable model, like gpt-4-32k if you need longer context and have access
                max_tokens: 4096, //Important: make sure the response can complete
                temperature: 0.2,  // Lower temperature for more focused translations
            });

            const translatedChunk = chatCompletion.choices[0].message.content;

            if (translatedChunk) { //prevent null/undefined chunks.
                translatedChunks.push(translatedChunk);
            } else {
                console.warn("Received empty translation for a chunk.  Original chunk:", chunk); // Log a warning
                translatedChunks.push(""); // Add an empty string, or decide how else to handle it
            }


        } catch (error) {
            console.error("Error during translation:", error);
            if (error.response) {
                console.error(error.response.status);
                console.error(error.response.data);
            } else if (error.request) {
                console.error(error.request); // The request was made but no response was received
            }
            throw new Error(`Translation failed: ${error.message}`); // Re-throw for higher-level handling
        }
    }

    // Join the translated chunks back together
    return translatedChunks.join(" ");
}

export { translateToEnglish };