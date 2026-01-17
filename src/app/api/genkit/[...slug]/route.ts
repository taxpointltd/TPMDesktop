import genkit from '@genkit-ai/next';

// Import your flows here
import '@/ai/flows/generate-starting-coa';
import '@/ai/flows/match-transactions-with-ai';
import '@/ai/flows/interlink-accounts-flow';

export const { GET, POST } = genkit();
