'use server';
/**
 * @fileOverview This file defines a Genkit flow for interlinking vendors and customers with the chart of accounts.
 *
 * - interlinkAccounts - The main function to trigger the account interlinking flow.
 * - InterlinkAccountsInput - The input type for the interlinkAccounts function.
 * - InterlinkAccountsOutput - The return type for the interlinkAccounts function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const InterlinkAccountsInputSchema = z.object({
  vendors: z
    .string()
    .describe(
      'A JSON string of vendors, each with a vendorName and defaultExpenseAccount text.'
    ),
  customers: z
    .string()
    .describe(
      'A JSON string of customers, each with a customerName and defaultRevenueAccount text.'
    ),
  chartOfAccounts: z
    .string()
    .describe(
      'A JSON string of the chart of accounts, including accountName, accountNumber, subAccountName, and subAccountNumber.'
    ),
});
export type InterlinkAccountsInput = z.infer<
  typeof InterlinkAccountsInputSchema
>;

const InterlinkAccountsOutputSchema = z.object({
  vendorLinks: z
    .array(
      z.object({
        vendorId: z.string(),
        chartOfAccountId: z.string(),
      })
    )
    .describe('An array of objects linking vendor IDs to chart of account IDs.'),
  customerLinks: z
    .array(
      z.object({
        customerId: z.string(),
        chartOfAccountId: z.string(),
      })
    )
    .describe('An array of objects linking customer IDs to chart of account IDs.'),
});
export type InterlinkAccountsOutput = z.infer<
  typeof InterlinkAccountsOutputSchema
>;

export async function interlinkAccounts(
  input: InterlinkAccountsInput
): Promise<InterlinkAccountsOutput> {
  return interlinkAccountsFlow(input);
}

const interlinkPrompt = ai.definePrompt({
  name: 'interlinkAccountsPrompt',
  input: { schema: InterlinkAccountsInputSchema },
  output: { schema: InterlinkAccountsOutputSchema },
  prompt: `You are an expert accounting system AI. Your task is to analyze lists of vendors, customers, and a chart of accounts (COA) to establish links between them.

You will be given three JSON strings:
1.  Vendors: Contains a list of vendors, including their ID and the text of their default expense account.
2.  Customers: Contains a list of customers, including their ID and the text of their default revenue account.
3.  Chart of Accounts: Contains the full chart of accounts, with IDs, names, numbers, and sub-account details.

Your goal is to match the 'defaultExpenseAccount' from each vendor and the 'defaultRevenueAccount' from each customer to the most appropriate account in the COA.

Matching Priority:
1.  First, try to match the text with the 'subAccountName' or 'subAccountNumber' in the COA.
2.  If no sub-account matches, try to match the text with the 'accountName' or 'accountNumber' in the COA.
3.  The match should be as exact as possible.

Based on your matches, you will generate two lists:
-   'vendorLinks': A list linking a 'vendorId' to the matched 'chartOfAccountId'.
-   'customerLinks': A list linking a 'customerId' to the matched 'chartOfAccountId'.

If a vendor's default expense account or a customer's default revenue account is empty or cannot be reliably matched to any account in the COA, do not include it in your output.

Vendors:
{{{vendors}}}

Customers:
{{{customers}}}

Chart of Accounts:
{{{chartOfAccounts}}}

Now, provide the JSON output with the matched links.
`,
});

const interlinkAccountsFlow = ai.defineFlow(
  {
    name: 'interlinkAccountsFlow',
    inputSchema: InterlinkAccountsInputSchema,
    outputSchema: InterlinkAccountsOutputSchema,
  },
  async (input) => {
    const { output } = await interlinkPrompt(input);
    return output!;
  }
);
