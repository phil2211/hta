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
            const enhancedDocumentContent = await enhanceDocument(id);
            await documentCollectionName.replaceOne({ _id: id }, enhancedDocumentContent);
            /*
            (7). Download published report and extract the text and store it 
                 in MongoDB as original text
            */
            const text = await extractTextFromHTADocument(enhancedDocumentContent);
            await documentCollectionName.updateOne({ _id: id }, { $set: { body: text } });

            /*
            (8). Create a summary of the text and store it in MongoDB
            */
            const summary = await summarize(text);
            await documentCollectionName.updateOne({ _id: id }, { $set: { AIreportSummary: summary } });

            /*
            (9). Create embeddings for the text in chunks and store it in MongoDB
            */
            const embeddings = await createEmbeddings(text, id, enhancedDocumentContent);
            await embeddingCollectionName.deleteMany({ documentId: id });
            await embeddingCollectionName.insertMany(embeddings);
            /*
            (10). Send a summary mail
            */          
            await sendSummary(id);

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