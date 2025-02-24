import { createEmbedding } from "./openAI.js";

function buildTextForEmbedding(doc) {
    /**
     * Extracts and concatenates relevant text fields from the document for embedding.
     * @param {object} doc the Mongo document
     * @return {string} concatenated string for embedding
     */

    let text = "";
    text += doc.title ? doc.title + ". " : "";
    text += doc.OriginalTitle ? doc.OriginalTitle + ". " : "";
    text += doc.Details?.["English language abstract"]
      ? doc.Details["English language abstract"] + ". "
      : "";
    text += doc.source ? doc.source + ". " : "";
    if (doc["MeSH Terms"] && Array.isArray(doc["MeSH Terms"])) {
      text += doc["MeSH Terms"].join(", ") + ". ";
    }
    // Add more fields as needed, handling potential null/undefined values
    if (doc.Contact)
    {
      text += doc.Contact["Contact Name"] ? doc.Contact["Contact Name"] + ". " : "";
    }
    text += doc.Details?.Country ? doc.Details.Country + ". " : "";
    text += doc.Details?.["Publication Type"] ? doc.Details["Publication Type"] + ". " : "";

    return text.trim(); // Remove trailing spaces
}

export async function addMetaEmbedding(document) {
  /**
   * Adds a meta-embedding to the document based on the extracted text.
   * @param {object} document The document to enhance.
   * @returns {object} The enhanced document with meta-embedding.
   */  
    const textToEmbed = buildTextForEmbedding(document);
    console.log(textToEmbed);
    const embedding = await createEmbedding(textToEmbed);
    document.metaEmbeddings = embedding;
    return document;
}
