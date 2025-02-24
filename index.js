// --- main.js ---
import { connectToMongoDB, closeMongoDBConnection } from './mongoDB.js';
import { fetchHtml } from './fetchHtml.js';
import { extractTableData } from './extractTableData.js';
import { createDocuments } from './createDocuments.js';
import { insertDocumentsToMongoDB } from './insertDocuments.js';
import { enhanceDocuments } from './enhanceDocuments.js';
import { addMetaEmbedding } from './createMetaEmbedding.js';
import { url } from './config.js';


// Main function
async function processPdfLinks(url) {
    try {
        const html = await fetchHtml(url);
        const tableData = await extractTableData(html, url);
        const documents = await createDocuments(tableData);
        const insertedIds = await insertDocumentsToMongoDB(documents);
        const enhancedDocuments = await enhanceDocuments(insertedIds);
        return enhancedDocuments;
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