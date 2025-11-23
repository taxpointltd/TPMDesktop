'use server';

/**
 * @fileOverview This file defines a Genkit flow for matching uploaded transactions with existing vendors, customers, and chart of accounts using Gemini AI.
 *
 * - matchTransactions - A function that handles the transaction matching process.
 * - MatchTransactionsInput - The input type for the matchTransactions function.
 * - MatchTransactionsOutput - The return type for the matchTransactions function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const MatchTransactionsInputSchema = z.object({
  transactionData: z
    .string()
    .describe('Transaction data from an Excel sheet as a string.'),
  vendors: z.string().describe('A list of vendors.'),
  customers: z.string().describe('A list of customers.'),
  chartOfAccounts: z.string().describe('A list of chart of accounts.'),
  existingCompanies: z.string().describe('A list of companies.'),
});
export type MatchTransactionsInput = z.infer<typeof MatchTransactionsInputSchema>;

const MatchTransactionsOutputSchema = z.object({
  matchedTransactions: z
    .string()
    .describe('A list of matched transactions with vendors, customers, and chart of accounts.'),
});
export type MatchTransactionsOutput = z.infer<typeof MatchTransactionsOutputSchema>;

export async function matchTransactions(input: MatchTransactionsInput): Promise<MatchTransactionsOutput> {
  return matchTransactionsFlow(input);
}

const matchTransactionsPrompt = ai.definePrompt({
  name: 'matchTransactionsPrompt',
  input: {schema: MatchTransactionsInputSchema},
  output: {schema: MatchTransactionsOutputSchema},
  prompt: `You are an expert accountant specializing in transaction matching.

You will receive transaction data, a list of vendors, a list of customers, a chart of accounts, and a list of existing companies.

Your goal is to automatically match the transactions with the correct vendors, customers, chart of accounts and companies.

Transaction Data: {{{transactionData}}}
Vendors: {{{vendors}}}
Customers: {{{customers}}}
Chart of Accounts: {{{chartOfAccounts}}}
Existing Companies: {{{existingCompanies}}}

Return the matched transactions in a clear and concise format.
`,
});

const matchTransactionsFlow = ai.defineFlow(
  {
    name: 'matchTransactionsFlow',
    inputSchema: MatchTransactionsInputSchema,
    outputSchema: MatchTransactionsOutputSchema,
  },
  async input => {
    const {output} = await matchTransactionsPrompt(input);
    return output!;
  }
);
