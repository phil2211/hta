import { Document } from "langchain/document";

export async function createDocuments(tableData) {
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