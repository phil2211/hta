import { getMongoClient } from './mongoDB.js';
import { dbName, collectionName } from './config.js';
import { fetchHtml } from './fetchHtml.js';
import jsdom from "jsdom";
import { addMetaEmbedding } from './createMetaEmbedding.js';
const { JSDOM } = jsdom;


export async function enhanceDocuments(insertedIds) {
    const client = getMongoClient();
    if (!client.topology || !client.topology.isConnected()) {
        await connectToMongoDB(); // Ensure connection
    }
    const db = client.db(dbName);
    const collection = db.collection(collectionName);

    const enhancedDocuments = [];

    for (const id of insertedIds) {
        console.log(`Processing document with ID ${id}...`);
        const document = await collection.findOne({ _id: id });

        if (!document) {
            console.warn(`Document with ID ${id} not found.`);
            continue;
        }

        if (!document.url) {
            console.warn(`Document with ID ${id} has no URL.`);
            enhancedDocuments.push(document);
            continue;
        }

        try {
            const html = await fetchHtml(document.url);
            const dom = new JSDOM(html);
            const doc = dom.window.document;

            const cardBody = doc.querySelector('.card-body');
            if (!cardBody) {
                console.warn(`No .card-body in ${document.url}.`);
                enhancedDocuments.push(document);
                continue;
            }
            const detailData = {};

            const titleReds = cardBody.querySelectorAll('.title-red');
            if (titleReds.length >= 3) {
                detailData.recordID = Number(titleReds[1].textContent.replace("Record ID", "").trim());
                detailData.language = titleReds[2].textContent.trim();
            } else {
                 console.warn(`.title-red divs are less than three. Can not get recordID and language from  ${document.url}`);
            }

             // Find potential "top-level" subtitle after the first title-red
            const topLevelElement = doc.querySelector("#app > main > div > div.col-md-6 > div > div.card.card-record > div.card-body > div:nth-child(5) > b");
            let topLevelKey = null;
            if (topLevelElement && topLevelElement.parentElement.classList.contains('sub-title')) {
              topLevelKey = topLevelElement.textContent.replace(/[:\s]+$/, '').trim();
              detailData[topLevelKey] = {}; //initialize it as object
            }

            let currentTopLevel = null;
            const subTitles = cardBody.querySelectorAll('.sub-title');
            subTitles.forEach(subTitle => {

                const excerptElement = subTitle.previousElementSibling;
                if(excerptElement && excerptElement.classList.contains('exerpt')){
                    currentTopLevel = excerptElement.textContent.trim();
                    detailData[currentTopLevel] = {}; // Initialize as an object
                    return; // Continue to the next subtitle
                }


                const keyElement = subTitle.querySelector('b');
                if (keyElement) {
                    let key = keyElement.textContent.replace(/[:\s]+$/, '').trim();
                    if (key.startsWith("Authors")) {
                        key = "Authors objectives";
                    }

                    let value = '';
                    for (let node of subTitle.childNodes) {
                        if (node.nodeType === 3) {
                            value += node.textContent;
                        } else if (node.nodeType === 1 && node.tagName !== 'B') {
                            if (node.tagName === 'A') {
                                value += node.href;
                            } else {
                                value += node.textContent;
                            }
                        }
                    }

                   // Add to appropriate top-level key, or directly to detailData
                    if (currentTopLevel && detailData[currentTopLevel]) {
                        detailData[currentTopLevel][key] = value.trim();
                    } else if (topLevelKey && subTitle.parentElement.querySelector("div:nth-child(5) > b") == keyElement) {
                      //Special case for subtitle directly under a title red div
                        detailData[topLevelKey] = value.trim();

                    } else if(topLevelKey && detailData[topLevelKey] )
                    {
                         detailData[topLevelKey][key] = value.trim();
                    }

                    else {
                        detailData[key] = value.trim();
                    }
                }
            });

            //Add handling for ul lists
            const listTitles = cardBody.querySelectorAll("ul");

            listTitles.forEach(ul => {
                 const excerptElement = ul.previousElementSibling;
                 if(excerptElement && excerptElement.classList.contains('exerpt')){
                    currentTopLevel = excerptElement.textContent.trim();
                    detailData[currentTopLevel] = {};

                    const listItems = ul.querySelectorAll("li");
                    detailData[currentTopLevel] = []; // Initialize as an array;
                     listItems.forEach( li => {
                         detailData[currentTopLevel].push(li.textContent.trim());
                     })
                    return; // Continue to the next subtitle, as this one is a top level.
                }
            });


            const enhancedDocument = { ...document, ...detailData };
            // create embeddings for the metadata
            const enhancedDocumentWithEmbedding = await addMetaEmbedding(enhancedDocument);
            await collection.replaceOne({ _id: id }, enhancedDocumentWithEmbedding);
            enhancedDocuments.push(enhancedDocument);

        } catch (error) {
            console.error(`Error with ID ${id}, URL ${document.url}:`, error);
            enhancedDocuments.push(document);
        }
    }
    return enhancedDocuments;
}