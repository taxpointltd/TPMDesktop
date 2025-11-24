'use server';

/**
 * @fileOverview This file defines a Genkit flow for matching uploaded transactions with existing vendors, customers, and chart of accounts using Gemini AI.
 *
 * - matchTransactions - A function that handles the transaction matching process.
 * - MatchTransactionsInput - The input type for the matchTransactions function.
 * - MatchTransactionsOutput - The return type for the matchTransactions function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'zod';

const RawTransactionSchema = z.object({
  TransactionDate: z.string(),
  'Appears On Your Statement As': z.string(),
  Name: z.string(),
  Account: z.string(),
  Amount: z.number(),
  Category: z.string(),
  'Payment Account': z.string(),
});

const MatchTransactionsInputSchema = z.object({
  transactions: z.array(RawTransactionSchema).describe('An array of raw transaction objects. Each object contains fields like \'Appears On Your Statement As\', \'Amount\', etc.'),
  vendors: z.string().describe('A JSON string representing a list of vendors, each with an id and vendorName.'),
  customers: z.string().describe('A JSON string representing a list of customers, each with an id and customerName.'),
  chartOfAccounts: z.string().describe('A JSON string of the chart of accounts, with id, names, and numbers.'),
});
export type MatchTransactionsInput = z.infer<typeof MatchTransactionsInputSchema>;


const MatchedTransactionSchema = z.object({
  rawTransactionIndex: z.number().describe('The original index of the transaction from the input array.'),
  vendorId: z.string().optional().describe('The ID of the matched vendor, if any.'),
  customerId: z.string().optional().describe('The ID of the matched customer, if any.'),
  chartOfAccountId: z.string().optional().describe('The ID of the matched account from the chart of accounts.'),
});

const MatchTransactionsOutputSchema = z.object({
  matchedTransactions: z.array(MatchedTransactionSchema),
});
export type MatchTransactionsOutput = z.infer<typeof MatchTransactionsOutputSchema>;

export async function matchTransactions(input: MatchTransactionsInput): Promise<MatchTransactionsOutput> {
  return matchTransactionsFlow(input);
}

const matchTransactionsPrompt = ai.definePrompt({
  name: 'matchTransactionsPrompt',
  input: {schema: MatchTransactionsInputSchema},
  output: {schema: MatchTransactionsOutputSchema},
  prompt: `You are an expert accounting AI. Your task is to match a list of raw bank transactions to the appropriate vendors, customers, and chart of accounts.

You will be given the following data:
1.  An array of raw transaction objects. You should primarily focus on the 'Appears On Your Statement As' field for matching.
2.  A JSON string of known Vendors, each with an 'id' and 'vendorName'.
3.  A JSON string of known Customers, each with an 'id' and 'customerName'.
4.  A JSON string representing the Chart of Accounts (COA), with each account having an 'id', account details, and potentially a 'defaultVendorId' or 'defaultCustomerId'.

For each raw transaction object in the input array, follow these steps:
1.  Analyze the transaction's 'Appears On Your Statement As' field to identify if it relates to a known Vendor or Customer. Match based on the name. For example, a description 'STARBUCKS COFFEE #123' should match the vendor 'Starbucks'.
2.  If you find a matching Vendor or Customer, record their 'id'.
3.  After identifying the entity (Vendor/Customer), determine the correct Chart of Account entry.
    - If the matched Vendor has a 'defaultExpenseAccountId', or the Customer has a 'defaultRevenueAccountId', use that as the 'chartOfAccountId'.
    - If there's no default account linked, try to infer the best account from the COA based on the transaction description and the entity's name. Look for keywords.
    - If no entity is matched, still attempt to categorize the transaction by selecting the most appropriate account from the COA based on the description.
4.  If you cannot reliably match a vendor, customer, or account, leave the corresponding ID field empty.

Return a JSON object containing a 'matchedTransactions' array. Each item in the array must correspond to a transaction from the input and include:
- 'rawTransactionIndex': The original 0-based index of the transaction.
- 'vendorId': The ID of the matched vendor.
- 'customerId': The ID of the matched customer.
- 'chartOfAccountId': The ID of the matched account.

Here is the data:
Transactions: {{{json transactions}}}
Vendors: {{{vendors}}}
Customers: {{{customers}}}
Chart of Accounts: {{{chartOfAccounts}}}

Provide only the JSON output.
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
