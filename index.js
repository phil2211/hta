// --- main.js ---
import { connectToMongoDB, closeMongoDBConnection, getMongoClient } from './mongoDB.js';
import { fetchHtml } from './fetchHtml.js';
import { extractTableData } from './extractTableData.js';
import { createDocuments } from './createDocuments.js';
import { insertDocumentsToMongoDB } from './insertDocuments.js';
import { enhanceDocument } from './enhanceDocument.js';
import { addMetaEmbedding } from './createMetaEmbedding.js';
import { url, dbName, collectionName } from './config.js';


// Main function
async function processPdfLinks(url) {
    const client = getMongoClient();
    if (!client.topology || !client.topology.isConnected()) {
        await connectToMongoDB(); // Ensure connection
    }
    const db = client.db(dbName);
    const collection = db.collection(collectionName);

    try {
        const html = await fetchHtml(url);
        const tableData = await extractTableData(html, url);
        const documents = await createDocuments(tableData);
        const insertedIds = await insertDocumentsToMongoDB(documents);
        for (const id of insertedIds) {
            const enhancedDocument = await enhanceDocument(id);
            await collection.replaceOne({ _id: id }, enhancedDocument);
        }
    } catch (error) {
        console.error('Error processing PDF links:', error);
        throw error;
    }
}


async function main() {
    try {
        await connectToMongoDB();
        const results = await processPdfLinks(url);
    } catch (error) {
        console.error("An error occurred:", error);
    } finally {
        await closeMongoDBConnection();
    }
}
main();