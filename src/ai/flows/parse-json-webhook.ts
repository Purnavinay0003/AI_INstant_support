'use server';

/**
 * JSON Agent: Validates webhook JSON with manual schema checks, flags anomalies, and summarizes.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';


const ParseJsonWebhookInputSchema = z.object({
  webhookData: z.string().describe('The raw JSON webhook string'),
});
export type ParseJsonWebhookInput = z.infer<typeof ParseJsonWebhookInputSchema>;

const ParseJsonWebhookOutputSchema = z.object({
  isValid: z.boolean(),
  anomalies: z.array(z.string()),
  totalKeys: z.number().optional(),
  sampleValues: z.record(z.any()).optional(),
});
export type ParseJsonWebhookOutput = z.infer<typeof ParseJsonWebhookOutputSchema>;

// --- MANUAL TYPE VALIDATION UTILITIES ---

function validateSchema(data: any, requiredSchema: Record<string, string>): string[] {
  const anomalies: string[] = [];

  for (const [key, expectedType] of Object.entries(requiredSchema)) {
    if (!(key in data)) {
      anomalies.push(`Missing field: ${key}`);
    } else {
      const actualType = typeof data[key];
      if (actualType !== expectedType) {
        anomalies.push(
          `Type mismatch for '${key}': expected ${expectedType}, got ${actualType}`
        );
      }
    }
  }

  return anomalies;
}

function summarizeJson(jsonData: Record<string, any>): {
  totalKeys: number;
  sampleValues: Record<string, any>;
} {
  const keys = Object.keys(jsonData);
  const sampleValues: Record<string, any> = {};

  for (const key of keys.slice(0, 3)) {
    sampleValues[key] = jsonData[key];
  }

  return {
    totalKeys: keys.length,
    sampleValues,
  };
}

// --- LLM FALLBACK (OPTIONAL) ---

const parseJsonWebhookPrompt = ai.definePrompt({
  name: 'parseJsonWebhookPrompt',
  input: { schema: ParseJsonWebhookInputSchema },
  output: { schema: ParseJsonWebhookOutputSchema },
  prompt: `You're an expert JSON validator.

Given this webhook JSON string:

{{webhookData}}

Check if it conforms to this schema:
{
  "id": number,
  "amount": number,
  "timestamp": string
}

Return:
- isValid (boolean)
- anomalies (list of problems)
- totalKeys (optional)
- sampleValues (optional, up to 3 fields)`,
});
// --- MAIN AGENT FLOW ---

export async function parseJsonWebhook(
  input: ParseJsonWebhookInput
): Promise<ParseJsonWebhookOutput> {
  const { webhookData } = input;

  try {
    const parsed = JSON.parse(webhookData);

    const expectedSchema = {
      id: 'number',
      amount: 'number',
      timestamp: 'string',
    };

    const anomalies = validateSchema(parsed, expectedSchema);
    const summary = summarizeJson(parsed);

    return {
      isValid: anomalies.length === 0,
      anomalies,
      ...summary,
    };
  } catch (err: any) {
    // Optional fallback to Gemini if parsing fails
    const fallback = await parseJsonWebhookPrompt.invoke({ webhookData });
    return {
      isValid: false,
      anomalies: ['Invalid JSON syntax', ...fallback.anomalies],
    };
  }
}


