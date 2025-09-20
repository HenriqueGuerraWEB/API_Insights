'use server';

/**
 * @fileOverview This file defines a Genkit flow for suggesting user-friendly names for API keys using an AI assistant.
 *
 * - suggestFriendlyNames - A function that takes a list of API keys and returns a mapping of original keys to suggested friendly names.
 * - SuggestFriendlyNamesInput - The input type for the suggestFriendlyNames function, which is a list of API keys.
 * - SuggestFriendlyNamesOutput - The output type for the suggestFriendlyNames function, which is a mapping of original keys to suggested friendly names.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SuggestFriendlyNamesInputSchema = z.object({
  apiKeys: z.array(z.string()).describe('A list of API keys extracted from a JSON response.'),
});
export type SuggestFriendlyNamesInput = z.infer<typeof SuggestFriendlyNamesInputSchema>;

const SuggestFriendlyNamesOutputSchema = z.record(z.string(), z.string()).describe('A mapping of original API keys to suggested user-friendly names.');
export type SuggestFriendlyNamesOutput = z.infer<typeof SuggestFriendlyNamesOutputSchema>;

export async function suggestFriendlyNames(input: SuggestFriendlyNamesInput): Promise<SuggestFriendlyNamesOutput> {
  return suggestFriendlyNamesFlow(input);
}

const prompt = ai.definePrompt({
  name: 'suggestFriendlyNamesPrompt',
  input: {schema: SuggestFriendlyNamesInputSchema},
  output: {schema: SuggestFriendlyNamesOutputSchema},
  prompt: `You are an expert in API and data analysis. Given the following list of JSON keys extracted from an API, suggest user-friendly and readable names for each key in English.

Keys: {{{apiKeys}}}

Return a mapping in JSON format: {\'original_key\': \'suggested_name\'}.`, safetySettings: [
    {
      category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
      threshold: 'BLOCK_NONE',
    },
    {
      category: 'HARM_CATEGORY_HATE_SPEECH',
      threshold: 'BLOCK_NONE',
    },
  ],
});

const suggestFriendlyNamesFlow = ai.defineFlow(
  {
    name: 'suggestFriendlyNamesFlow',
    inputSchema: SuggestFriendlyNamesInputSchema,
    outputSchema: SuggestFriendlyNamesOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
