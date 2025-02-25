import { OpenAI } from "openai";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { openAIKey } from "./config.js";

async function createEmbeddings(text, documentId, metadata) {
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
    let chunkIndex = 0;

    for (const chunk of output) {
      console.log(`Generating embedding for chunk ${chunkIndex+1} of ${output.length}`);

      const embeddingResponse = await openai.embeddings.create({
        model: "text-embedding-3-large",
        input: chunk.pageContent,
      });

      if (embeddingResponse.data && embeddingResponse.data.length > 0) {
          const embedding = embeddingResponse.data[0].embedding;
          results.push({
              chunkIndex,
              text: chunk.pageContent,
              embedding: embedding,
              documentId: documentId,
              sourceName: metadata.title,
              url: metadata.url,
              chunkAigoHash: "059d469c3c09fff9031ed285d714b9713399e024d9a99f64f01e1d587c5c9459"

          });
      } else {
          console.warn("Received empty embedding response for chunk:", chunk.pageContent);
          // Handle empty response (e.g., skip, retry, or throw error)
          throw new Error("Received empty embedding response"); //example handling
      }
      chunkIndex++;
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