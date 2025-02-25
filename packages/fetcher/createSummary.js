import OpenAI from "openai";
import { openAIKey } from "./config.js";

const openai = new OpenAI({
    apiKey: openAIKey
});


async function summarize(text) {
    const models = [
        "gpt-4o", // Largest context window, preferred. 128k tokens
        "gpt-4-32k",        //Large context,fallback option 1. 32k tokens
        "gpt-4",            // Standard GPT-4, fallback option 2.  8k tokens
        "gpt-3.5-turbo-16k", // Fallback option 3. 16k tokens
        "gpt-3.5-turbo",     // Least preferred, fallback option 4. 4k tokens
    ];

    const maxSummaryTokens = 8096;  //Maximum size of a summary
    const maxInputTokens = 128000;   //Maximum context window, will be checked per model later

    const prompt = `Summarize the following text, focusing on these key aspects of a reimbursement request. The output must be in english language.:

- **Type of Reimbursement Request:** (e.g., new drug application, price adjustment, expanded indication, etc.)
- **Key Stakeholders Involved:** (e.g., pharmaceutical company, payers, government agencies, patient advocacy groups, healthcare providers)
- **Potential Impact on Existing Market Access Strategies:** (e.g., changes to pricing, formulary placement, patient access programs, competitive landscape)
- **Any Urgent Aspects Requiring Attention:** (e.g., deadlines, critical data releases, regulatory changes, market events)

Input Text:
${text.slice(0, 100000)}

Summary:
`;

    let summary = null;

    for (const model of models) {
        try {
            //Calculate maximum allowed input tokens, taking into account prompt and summary sizes.
            let modelMaxInput = 0; //default
            if (model == "gpt-4o") {
                modelMaxInput = 128000;
            } else if (model == "gpt-4-32k") {
                modelMaxInput = 32000;
            } else if (model == "gpt-4") {
                modelMaxInput = 8192;
            } else if (model == "gpt-3.5-turbo-16k") {
                modelMaxInput = 16385;
            } else if (model == "gpt-3.5-turbo") {
                modelMaxInput = 4096;
            }

            const estimatedPromptTokens = text.length / 4 + prompt.length /4 ; //Rough estimate of tokens = chars/4

            if (estimatedPromptTokens > modelMaxInput - maxSummaryTokens){
                console.warn(`Input text is too long for model ${model}.  Estimated prompt tokens: ${estimatedPromptTokens}, Max input tokens: ${modelMaxInput},  Max summary tokens: ${maxSummaryTokens}. Skipping to next fallback model.`);
                continue; // Skip to the next model
            }
            const completion = await openai.chat.completions.create({
                model: model,
                messages: [{ role: "user", content: prompt }],
                max_tokens: maxSummaryTokens,
                temperature: 0.2, // Lower temperature for more focused summaries
            });

            summary = completion.choices[0].message.content;

            if (summary) {
                console.log(`Summary generated using model: ${model}`);
                break; // Exit the loop if a summary was successfully generated
            }
        } catch (error) {
            console.error(`Error with model ${model}:`, error);
            // Continue to the next model in case of an error
             if (error.status === 429) {
                // Basic rate limit handling (wait and retry)
                console.warn(`Rate limit exceeded for model ${model}. Waiting before retrying...`);
                await new Promise(resolve => setTimeout(resolve, 60000)); // Wait 60 seconds.  Could be improved greatly using the headers.

                 try {
                    const retryCompletion = await openai.chat.completions.create({
                        model: model,
                        messages: [{ role: "user", content: prompt }],
                        max_tokens: maxSummaryTokens,
                        temperature: 0.2,
                    });
                     summary = retryCompletion.choices[0].message.content;
                     if (summary) {
                        console.log(`Summary generated using model: ${model} after retry`);
                        break; // Exit the loop if a summary was successfully generated
                    }
                } catch (retryError) {
                    console.error(`Error with model ${model} after retry:`, retryError);

                }

            }
        }
    }

    if (!summary) {
        return "Could not generate a summary.  The input may be too long, or there may be issues with the OpenAI API.";
    }

    return summary;
}

export { summarize };