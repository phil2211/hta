import {} from 'dotenv/config';

export const mongoUri = process.env.MONGO_URI;
export const dbName = process.env.DB_NAME;
export const collectionName = process.env.COLLECTION_NAME;
export const url = process.env.URL;
export const openAIKey = process.env.OPENAI_KEY;