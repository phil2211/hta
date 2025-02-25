import { OpenAI } from "openai";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { openAIKey } from "./config.js";

async function createEmbeddings(text, documentId) {
  try {
    const openai = new OpenAI({
        apiKey: openAIKey
    });

    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 10000,  // Adjust chunk size as needed
      chunkOverlap: 200, // Adjust overlap as needed
    });

    const output = await splitter.createDocuments([text]);


    const results = [];
    let chunkIndex = 1;

    for (const chunk of output) {
      console.log(`Generating embedding for chunk ${chunkIndex} of ${output.length}`);
      chunkIndex++;

      const embeddingResponse = await openai.embeddings.create({
        model: "text-embedding-3-large",
        input: chunk.pageContent,
      });

      if (embeddingResponse.data && embeddingResponse.data.length > 0) {
          const embedding = embeddingResponse.data[0].embedding;
          results.push({
              chunk: chunk.pageContent,
              embedding: embedding,
              documentId: documentId
          });
      } else {
          console.warn("Received empty embedding response for chunk:", chunk.pageContent);
          // Handle empty response (e.g., skip, retry, or throw error)
          throw new Error("Received empty embedding response"); //example handling
      }

    }

    return results;

  } catch (error) {
    console.error("Error generating embeddings:", error);
    if (error.response) {
        console.error("OpenAI API Error Details:", error.response.data);
    }
    throw error; // Re-throw the error to be handled by the caller
  }
}


export { createEmbeddings };