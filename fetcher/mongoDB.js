// --- mongoDB.js ---
import { MongoClient } from 'mongodb';
import { mongoUri } from './config.js';

const client = new MongoClient(mongoUri);

export async function connectToMongoDB() {
    try {
        await client.connect();
        console.log("Connected to MongoDB");
    } catch (error) {
        console.error("Error connecting to MongoDB:", error);
        throw error;
    }
}

export async function closeMongoDBConnection() {
    await client.close();
    console.log("MongoDB connection closed.");
    return true;
}


export function getMongoClient() {
    return client;
}