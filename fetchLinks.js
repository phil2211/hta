const https = require('https');
const cheerio = require('cheerio');
const { URL } = require('url');
const { Document } = require("langchain/document");
const { RecursiveCharacterTextSplitter } = require("langchain/text_splitter");
const { MongoClient } = require('mongodb');
const jsdom = require("jsdom");
const { JSDOM } = jsdom;

require('dotenv').config(); // Load environment variables

// --- MongoDB Connection Setup ---
const mongoUri = process.env.MONGO_URI;
const dbName = process.env.DB_NAME;
const collectionName = process.env.COLLECTION_NAME;

const client = new MongoClient(mongoUri);

async function connectToMongoDB() {
    try {
        await client.connect();
        console.log("Connected to MongoDB");
    } catch (error) {
        console.error("Error connecting to MongoDB:", error);
        throw error; // Re-throw to be handled by the caller
    }
}


async function fetchHtml(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => resolve(data));
            res.on('error', reject);
        }).on('error', reject);
    });
}

async function extractTableData(html, baseUrl) {
    const $ = cheerio.load(html);
    const table = $('table.table-bordered.table-striped');
    const links = [];

    if (table.length === 0) {
        throw new Error("Table not found. Check the CSS selector.");
    }

    table.find('tr').slice(1).each((rowIndex, rowElement) => {
        const rowData = {};
        $(rowElement).find('td').each((cellIndex, cellElement) => {
            const cellText = $(cellElement).text().trim();
            const cellLink = $(cellElement).find('a');

            let columnName = `column_${cellIndex}`;
            const headerRow = table.find('tr').first();
            if (headerRow.length > 0) {
                const headerCell = $(headerRow).find('th, td').eq(cellIndex);
                if (headerCell.length > 0) {
                    columnName = headerCell.text().trim().toLowerCase().replace(/\s+/g, '_');
                }
            }

            if (cellLink.length > 0) {
                const linkText = cellLink.text().trim();
                const href = cellLink.attr('href');
                const absoluteHref = new URL(href, baseUrl).href;
                rowData[columnName] = { text: linkText, url: absoluteHref };
            } else {
                rowData[columnName] = cellText;
            }
        });
        links.push(rowData);
    });
    return links;
}

async function createDocuments(tableData) {
    const documents = [];
    for (const row of tableData) {
        const rowString = Object.entries(row)
          .map(([key, value]) => {
            if (typeof value === 'object' && value !== null) {
              return `${key}: ${Object.entries(value).map(([k, v]) => `${k}=${v}`).join(', ')}`;
            }
            return `${key}: ${value}`;
          })
          .join('; ');


        const metadata = { ...row };
        const doc = new Document({
            pageContent: rowString,
            metadata: metadata,
        });
        documents.push(doc);
    }
    return documents;
}



// --- MongoDB Insertion Function ---
async function insertDocumentsToMongoDB(documents) {
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
            _id: articleId // Use the extracted ID as _id
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

async function enhanceDocuments(insertedIds) {
    if (!client.topology || !client.topology.isConnected()) {
        await connectToMongoDB(); // Ensure connection before insertion
    }
    const db = client.db(dbName);
    const collection = db.collection(collectionName);

    try {
        const enhancedDocuments = [];

        for (const id of insertedIds) {
            console.log(`Processing document with ID ${id}...`);
            // Fetch the document from MongoDB
            const document = await collection.findOne({ _id: id });

            if (!document) {
                console.warn(`Document with ID ${id} not found in MongoDB.`);
                continue; // Skip if document not found
            }

            if (!document.url) {
                console.warn(`Document with ID ${id} does not have a URL field.`);
                enhancedDocuments.push(document);  // Add the document as is, without enhancements
                continue;
            }

            try {
                // Fetch and parse the HTML content
                const html = await fetchHtml(document.url);
                const dom = new JSDOM(html);
                const doc = dom.window.document;

                // Find the card-body div
                const cardBody = doc.querySelector('.card-body');
                if (!cardBody) {
                    console.warn(`No .card-body found in ${document.url}. Skipping detail extraction.`);
                    enhancedDocuments.push(document);
                    continue; //skip this one
                }
                const detailData = {};

                // Extract Record ID and Language
                const titleReds = cardBody.querySelectorAll('.title-red');
                if (titleReds.length >= 3) {
                    detailData.recordID = titleReds[1].textContent.replace("Record ID", "").trim();
                    detailData.language = titleReds[2].textContent.trim();
                } else {
                    console.warn(`.title-red divs are less than three. Can not get recordID and language from  ${document.url}`);
                }


                // Extract data from sub-title divs
                const subTitles = cardBody.querySelectorAll('.sub-title');
                subTitles.forEach(subTitle => {
                    const keyElement = subTitle.querySelector('b');
                    if (keyElement) {
                        let key = keyElement.textContent.replace(/[:\s]+$/, '').trim(); // Remove trailing colons and spaces

                        //handle special cases for key
                        if (key.startsWith("Authors")) {
                            key = "Authors objectives";
                        }

                        // Get the value (everything but the <b> tag)
                        let value = '';
                        for (let node of subTitle.childNodes) {
                            if (node.nodeType === 3) { // Text node
                                value += node.textContent;
                            } else if (node.nodeType === 1 && node.tagName !== 'B') { // Element node (excluding <b>)
                                if (node.tagName === 'A') {
                                    value += node.href; // Use href for links
                                } else {
                                    value += node.textContent;
                                }
                            }
                        }

                        detailData[key] = value.trim();
                    }
                });

                // Combine the fetched document with the extracted details
                const enhancedDocument = { ...document, ...detailData };

                // Update the document in MongoDB
                await collection.updateOne(
                    { _id: id },
                    { $set: detailData }
                );
                enhancedDocuments.push(enhancedDocument);

            } catch (error) {
                console.error(`Error processing document with ID ${id}:`, error);
                enhancedDocuments.push(document); //push the unenhanced document.
            }
        }
        return enhancedDocuments;

    } catch (error) {
        console.error('Error in enhanceDocuments:', error);
        throw error;
    }
}


// Main function
async function processPdfLinks(url) {
    try {
        // 1 Fetch the HTML content
        const html = await fetchHtml(url);
        // 2 Extract provided table data
        const tableData = await extractTableData(html, url);
        // 3 Create documents from the table data
        const documents = await createDocuments(tableData);
        // 4 Store documents in MongoDB
        const insertedIds = await insertDocumentsToMongoDB(documents); // Insert into MongoDB
        // 5 get detail page content of newly found documents
        const enhancedDocuments = await enhanceDocuments(insertedIds);
        return enhancedDocuments;

    } catch (error) {
        console.error('Error processing PDF links:', error);
        throw error;
    }
}

function removeBrackets(str) {
    return str.replace(/^\[(.*)\]$/, '$1');
}

// --- Main Execution ---
async function main() {
    try {
        await connectToMongoDB(); // Connect to MongoDB *before* fetching
        const url = 'https://database.inahta.org/?utm_source=chatgpt.com&filter-country=Sweden&sort=publish_year&direction=desc&page=1&filter-status=Completed';
        const results = await processPdfLinks(url);

    } catch (error) {
        console.error("An error occurred:", error);
    } finally {
        await client.close(); // Close the connection when done
        console.log("MongoDB connection closed.");
    }
}
main();