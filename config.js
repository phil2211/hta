import {} from 'dotenv/config';

export const mongoUri = process.env.MONGO_URI;
export const dbName = process.env.DB_NAME;
export const documentCollection = process.env.DOCUMENT_COLLECTION_NAME;
export const embeddingCollection = process.env.EMBEDDING_COLLECTION_NAME;
export const url = process.env.URL;
export const openAIKey = process.env.OPENAI_KEY;