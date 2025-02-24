// --- insertDocuments.js ---
import { getMongoClient } from './mongoDB.js';
import { dbName, collectionName } from './config.js';
import {removeBrackets} from './utils.js';


export async function insertDocumentsToMongoDB(documents) {
    const client = getMongoClient();
    if (!client.topology || !client.topology.isConnected()) {
        await connectToMongoDB(); // Ensure connection before insertion
    }
    const db = client.db(dbName);
    const collection = db.collection(collectionName);

    const documentsToInsert = documents.map(doc => {
        let articleId = null;
        // Extract article ID from PDF URL (if it exists), otherwise from title URL.  Handles both cases.
        if (doc.metadata.pdf && doc.metadata.pdf.url) {
            const urlParts = doc.metadata.pdf.url.split('/');
            articleId = urlParts[urlParts.length - 1]; // Get the last part
        } else if (doc.metadata.title && doc.metadata.title.url) {
            const urlParts = doc.metadata.title.url.split('/');
            articleId = urlParts[urlParts.length - 1];
        }

        // Prepare the document for MongoDB
        let mongoDoc = {
            year: doc.metadata.year,
            source: doc.metadata.source,
            title: doc.metadata.title ? removeBrackets(doc.metadata.title.text) : null,  //Handle cases where the title cell is not a link.
            url: doc.metadata.title ? doc.metadata.title.url : null,   //Handle as above.
            _id: Number(articleId) // Use the extracted ID as _id
        };

        return mongoDoc;
    });

    const insertedIds = []; // Array to store successfully inserted IDs

    try {
        // Use insertMany for efficient bulk insertion
        const result = await collection.insertMany(documentsToInsert, { ordered: false }); //ordered false so it continues after insert errors (duplicate keys)
        console.log(`${result.insertedCount} documents inserted into MongoDB`);

        // Iterate through insertedIds and add them to the array
        for (const id of Object.values(result.insertedIds)) {
            insertedIds.push(id);
        }


    } catch (error) {
        if (error.code === 11000) { // Duplicate key error
            console.warn(`Skipped insertion of ${error.writeErrors.length} documents due to duplicate _id values.`);
            // Get inserted IDs even in case of partial success.  Crucially, handle the case where NO documents were inserted.
            if (error.result && error.result.insertedIds) {
                for (const id of Object.values(error.result.insertedIds)) {
                    insertedIds.push(id);
                }
            }
        } else {
            console.error("Error inserting documents into MongoDB:", error);
            throw error; // Re-throw other errors
        }
    }

    return insertedIds; // Return the array of inserted IDs
}