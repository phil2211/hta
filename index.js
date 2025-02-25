// --- main.js ---
import { connectToMongoDB, closeMongoDBConnection, getMongoClient } from './mongoDB.js';
import { fetchHtml } from './fetchHtml.js';
import { extractTableData } from './extractTableData.js';
import { createDocuments } from './createDocuments.js';
import { insertDocumentsToMongoDB } from './insertDocuments.js';
import { enhanceDocument } from './enhanceDocument.js';
import { extractTextFromHTADocument } from './processPublishedReport.js';
import { translateToEnglish } from './translateToEnglish.js';
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
        /* 
        (1). get the main page with the document list 
          (initial you need to load all pages, but once 
          done you can just load page 1 sorted by publish date)
        */
        const html = await fetchHtml(url);
        /* 
        (2). extract the table data from that page
        */
        const tableData = await extractTableData(html, url);
        /* 
        (3). create MongoDB documents from the table data
        */
        const documents = await createDocuments(tableData);
        /*
        (4). Store the documents in MongoDB using the articleID as primary
            key to detect duplicates. This function returns only new inserted
            IDs.
        */
        const insertedIds = await insertDocumentsToMongoDB(documents);
        /*
        (5). Loop over new inserted IDs
        */
        for (const id of insertedIds) {
            /*
            (6). Enhance the documents with additional data
                from it's detail page and add it to MongoDB
            */
            const enhancedDocument = await enhanceDocument(id);
            await collection.replaceOne({ _id: id }, enhancedDocument);
            /*
            (7). Download published report and extract the text and store it 
                 in MongoDB as original text
            */
            const text = await extractTextFromHTADocument(enhancedDocument);
            await collection.updateOne({ _id: id }, { $set: { reportOriginalText: text } });

            /*
            (8). Use OpenAI to translate the text to English and store it in MongoDB
            */
            const englishText = await translateToEnglish(text);
            await collection.updateOne({ _id: id }, { $set: { reportEnglishText: englishText } });

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