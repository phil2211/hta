// --- extractTableData.js ---
import * as cheerio from 'cheerio';
import { URL } from 'url';

export async function extractTableData(html, baseUrl) {
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