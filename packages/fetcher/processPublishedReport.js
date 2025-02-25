import https from 'https';
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import fs from 'fs';  // For createWriteStream
import { promises as fsPromises } from 'fs'; // For unlink (async)
import os from 'os';
import path from 'path';

async function downloadFile(url, destination) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(destination);

        https.get(url, (response) => {
            if (response.statusCode !== 200) {
                reject(new Error(`Failed to download file: ${response.statusCode} ${response.statusMessage}`));
                return;
            }

            response.pipe(file);

            file.on('finish', () => {
                file.close(resolve);  // Resolve after the file is closed
            });
        }).on('error', (error) => {
            fsPromises.unlink(destination, () => reject(error)); // Delete the file if an error occurs during download, and then reject. unlink is async, hence the callback
        });
    });
}

async function extractTextFromHTADocument(document) {
    try {
        const reportUrl = document?.Details?.["URL for published report"];

        if (!reportUrl) {
            throw new Error("URL for published report not found in the document.");
        }

        if (!reportUrl.endsWith(".pdf")) {
            throw new Error("URL does not point to a PDF file");
        }

        // 1. Download the PDF
        const tempDir = os.tmpdir();
        const fileName = `report_${Date.now()}.pdf`; //unique filename
        const filePath = path.join(tempDir, fileName);

        await downloadFile(reportUrl, filePath);

        // 2. Extract Text using Langchain's PDFLoader
        const loader = new PDFLoader(filePath);
        const docs = await loader.load();

        let combinedText = docs.map(doc => doc.pageContent).join('\n');

        // Remove empty lines and trim whitespace
        combinedText = combinedText.split('\n')  // Split into lines
            .map(line => line.trim())        // Trim whitespace from each line
            .filter(line => line !== '')     // Remove empty lines
            .join('\n');                    // Join lines back together

        // 3. Clean up (delete the temporary file)
        await fsPromises.unlink(filePath); // Use promises version for async/await

        return combinedText;

    } catch (error) {
        console.error("Error extracting text:", error);
        return `Error extracting text: ${error.message}`; // Return the error message
    }
}

export { extractTextFromHTADocument };