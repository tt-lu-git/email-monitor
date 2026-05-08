import type { Env } from '../env';
import type { ClassificationResult, EmailInput } from './types';
import { buildPrompt } from './prompt';
import { parseAIResponse } from './parse';

export async function callWorkersAI(email: EmailInput, env: Env): Promise<ClassificationResult> {
  const { system, user } = buildPrompt(email);
  const messages = [{ role: 'system', content: system }, { role: 'user', content: user }];

  const result = await env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
    messages,
    temperature: 0,
  }) as { response: string };

  const parsed = parseAIResponse(result.response);
  if (parsed) return { ...parsed, method: 'workers-ai' };

  throw new Error('workers-ai:parse-failed');
}
