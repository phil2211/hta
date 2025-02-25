import {} from 'dotenv/config';

export const mongoUri = process.env.MONGO_URI;
export const dbName = process.env.DB_NAME;
export const documentCollection = process.env.DOCUMENT_COLLECTION_NAME;
export const embeddingCollection = process.env.EMBEDDING_COLLECTION_NAME;
export const mailRecipientsCollection = process.env.MAIL_RECIPIENTS_COLLECTION_NAME;
export const url = process.env.URL;
export const openAIKey = process.env.OPENAI_KEY;
export const awsAccessKeyId = process.env.AWS_ACCESS_KEY_ID;
export const awsSecretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
export const awsRegion = process.env.AWS_REGION;
export const emailFrom = process.env.EMAIL_FROM;