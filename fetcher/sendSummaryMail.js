import { getMongoClient } from './mongoDB.js';
import { dbName, documentCollection, mailRecipientsCollection, awsAccessKeyId, awsSecretAccessKey, awsRegion, emailFrom } from './config.js';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import * as marked from 'marked';  // For Markdown rendering

// Create an SES service object
const sesClient = new SESClient({ 
    region: awsRegion, 
    credentials: { 
        accessKeyId: awsAccessKeyId, 
        secretAccessKey: awsSecretAccessKey 
    } 
});

// --- Helper Functions ---

/**
 * Builds a rich text email body from the document data.
 * @param {object} doc The MongoDB document.
 * @returns {string} The HTML email body.
 */
function buildEmailBody(doc) {
    let html = `<!DOCTYPE html>
<html>
<head>
<style>
body { font-family: sans-serif; }
.section { margin-bottom: 20px; }
.section-title { font-weight: bold; font-size: 1.2em; margin-bottom: 5px; }
.field-label { font-weight: bold; }
.details-table { width: 100%; border-collapse: collapse; }
.details-table th, .details-table td { border: 1px solid #ddd; padding: 8px; text-align: left; }
.details-table th { background-color: #f2f2f2; }
ul, ol { padding-left: 20px; }
</style>
</head>
<body>
  <div class="section">
    <h1 class="section-title">${doc.title}</h1>
    <p><span class="field-label">Year:</span> ${doc.year}</p>
    <p><span class="field-label">Source:</span> ${doc.source}</p>
    <p><span class="field-label">URL:</span> <a href="${doc.url}">${doc.url}</a></p>
    <p><span class="field-label">Record ID:</span> ${doc.recordID}</p>
    <p><span class="field-label">Language:</span> ${doc.language}</p>
    <p><span class="field-label">Original Title:</span> ${doc['Original Title']}</p>
  </div>`;

    if (doc.Details) {
        html += `
  <div class="section">
    <h2 class="section-title">Details</h2>
    <table class="details-table">`;
        for (const key in doc.Details) {
            html += `<tr><th>${key}</th><td>`;
            if (key.startsWith("URL")) {
              html += `<a href="${doc.Details[key]}">${doc.Details[key]}</a>`;
            }
            else
            {
              html+=`${doc.Details[key]}`
            }
            html+=`</td></tr>`;
        }
        html += `
    </table>
  </div>`;
    }

    if (doc.Contact) {
        html += `
  <div class="section">
    <h2 class="section-title">Contact</h2>
    <p><span class="field-label">Address:</span> ${doc.Contact['Contact Address']}</p>
    <p><span class="field-label">Name:</span> ${doc.Contact['Contact Name']}</p>
    <p><span class="field-label">Email:</span> <a href="mailto:${doc.Contact['Contact Email']}">${doc.Contact['Contact Email']}</a></p>
    <p><span class="field-label">Copyright:</span> ${doc.Contact.Copyright}</p>
  </div>`;
    }

    if (doc['MeSH Terms']) {
        html += `
  <div class="section">
    <h2 class="section-title">MeSH Terms</h2>
    <ul>
      ${doc['MeSH Terms'].map(term => `<li>${term}</li>`).join('')}
    </ul>
  </div>`;
    }

    if (doc.AIreportSummary) {
        html += `
  <div class="section">
    <h2 class="section-title">AI Report Summary</h2>
    ${marked.parse(doc.AIreportSummary)}
  </div>`;
    }


    html += `
</body>
</html>`;

    return html;
}


/**
 * Sends an email using AWS SES.
 * @param {string} toAddress The recipient's email address.
 * @param {string} subject The email subject.
 * @param {string} htmlBody The HTML email body.
 * @returns {Promise<object>} A promise that resolves with the SES sendEmail response.
 */
async function sendEmail(toAddress, subject, htmlBody) {
    console.log(`Sending email to: ${toAddress}`);
    const params = {
        Destination: {
            ToAddresses: [toAddress]
        },
        Message: {
            Body: {
                Html: {
                    Charset: "UTF-8",
                    Data: htmlBody
                }
            },
            Subject: {
                Charset: 'UTF-8',
                Data: subject
            }
        },
        Source: emailFrom,
    };

    try {
        const command = new SendEmailCommand(params);
        const response = await sesClient.send(command);
        console.log('Email sent successfully:', response.MessageId);
        return response;
    } catch (err) {
        console.error("Error sending email:", err);
        throw err; // Re-throw the error to be handled by the caller
    }
}

/**
 * Loads a document from MongoDB and sends an email with its content.
 * @param {string|number} documentId The _id of the document to load.
 */
async function sendSummary(documentId) {
    try {
        const client = getMongoClient();
        if (!client.topology || !client.topology.isConnected()) {
            await connectToMongoDB(); // Ensure connection
        }
        console.log(mailRecipientsCollection);

        const db = client.db(dbName);
        const documents = db.collection(documentCollection);
        const mailRecipients = db.collection(mailRecipientsCollection);


        let query = {};

        if (!isNaN(parseInt(documentId)))
        {
          query = { _id: parseInt(documentId) };
        }
        else
        {
          throw new Error("Invalid Document ID format")
        }
        const doc = await documents.findOne(query);

        if (!doc) {
            throw new Error(`Document not found with ID: ${documentId}`);
        }

        const emailBody = buildEmailBody(doc);
        const subject = `New HTA document processed: ${doc.title}`;

        // Get recipients from MongoDB
        const recipients = await mailRecipients.find({}).toArray();
        if (recipients.length === 0) {
            console.warn("No email recipients found in the 'mailRecipients' collection.");
            return; // Or throw an error, depending on your requirements
        }
        // Send email to each recipient
        for (const recipient of recipients) {
          if (!recipient.email)
          {
            console.warn("Recipient does not contains email address")
            continue;
          }
            await sendEmail(recipient.email, subject, emailBody);
        }

    } catch (err) {
        console.error("An error occurred:", err);
        throw err;  // Important: Re-throw the error so the calling function knows it failed
    }
}

export { sendSummary };