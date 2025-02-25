// --- main.js ---
import { connectToMongoDB, closeMongoDBConnection, getMongoClient } from './mongoDB.js';
import { fetchHtml } from './fetchHtml.js';
import { extractTableData } from './extractTableData.js';
import { createDocuments } from './createDocuments.js';
import { insertDocumentsToMongoDB } from './insertDocuments.js';
import { enhanceDocument } from './enhanceDocument.js';
import { extractTextFromHTADocument } from './processPublishedReport.js';
import { createEmbeddings } from './createEmbeddings.js';
import { sendSummary } from './sendSummaryMail.js';
import { translateToEnglish } from './translateToEnglish.js';
import { summarize } from './createSummary.js';
import { url, dbName, documentCollection, embeddingCollection } from './config.js';


// Main function
async function processPdfLinks(url) {
    const client = getMongoClient();
    if (!client.topology || !client.topology.isConnected()) {
        await connectToMongoDB(); // Ensure connection
    }
    const db = client.db(dbName);
    const documentCollectionName = db.collection(documentCollection);
    const embeddingCollectionName = db.collection(embeddingCollection);

    try {
        await sendSummary(32701);
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