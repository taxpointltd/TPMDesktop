import { config } from 'dotenv';
config();

import '@/ai/flows/generate-starting-coa.ts';
import '@/ai/flows/match-transactions-with-ai.ts';
import '@/ai/flows/interlink-accounts-flow.ts';
