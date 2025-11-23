'use server';

/**
 * @fileOverview This file defines a Genkit flow to generate a basic chart of accounts (COA) based on the provided industry.
 *
 * The flow takes an industry as input and returns a list of suggested accounts.
 *
 * @interface GenerateStartingCOAInput - The input type for the generateStartingCOA function, containing the industry.
 * @interface GenerateStartingCOAOutput - The output type for the generateStartingCOA function, containing the generated chart of accounts.
 * @function generateStartingCOA - The main function to trigger the COA generation flow.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateStartingCOAInputSchema = z.object({
  industry: z
    .string()
    .describe("The industry for which to generate a starting chart of accounts."),
});

export type GenerateStartingCOAInput = z.infer<typeof GenerateStartingCOAInputSchema>;

const GenerateStartingCOAOutputSchema = z.object({
  accounts: z.array(
    z.object({
      accountName: z.string().describe("The name of the account."),
      accountType: z.string().describe("The type of account (e.g., Asset, Liability, Equity, Revenue, Expense)."),
      accountDescription: z.string().describe("A description of the account."),
    })
  ).describe("A list of suggested accounts for the chart of accounts."),
});

export type GenerateStartingCOAOutput = z.infer<typeof GenerateStartingCOAOutputSchema>;

export async function generateStartingCOA(input: GenerateStartingCOAInput): Promise<GenerateStartingCOAOutput> {
  return generateStartingCOAFlow(input);
}

const generateStartingCOAPrompt = ai.definePrompt({
  name: 'generateStartingCOAPrompt',
  input: {schema: GenerateStartingCOAInputSchema},
  output: {schema: GenerateStartingCOAOutputSchema},
  prompt: `You are an expert accounting consultant. Generate a basic chart of accounts for the following industry:

Industry: {{{industry}}}

Provide a list of accounts with account name, account type (Asset, Liability, Equity, Revenue, Expense) and a brief description for each account.

Ensure that the response is properly formatted JSON adhering to the output schema.  Make sure to include the accountDescription field.
`,
});

const generateStartingCOAFlow = ai.defineFlow(
  {
    name: 'generateStartingCOAFlow',
    inputSchema: GenerateStartingCOAInputSchema,
    outputSchema: GenerateStartingCOAOutputSchema,
  },
  async input => {
    const {output} = await generateStartingCOAPrompt(input);
    return output!;
  }
);
