import type { Env } from '../env';
import type { ClassificationResult, EmailInput } from './types';
import { buildPrompt } from './prompt';
import { parseAIResponse } from './parse';

// Use an explicit vision-capable model when images are present.
// openrouter/auto does not reliably route to vision models.
const TEXT_MODEL   = 'openrouter/auto';
const VISION_MODEL = 'google/gemini-2.0-flash-001';

type ContentPart =
  | { type: 'image_url'; image_url: { url: string } }
  | { type: 'text'; text: string };

export async function callOpenRouter(
  email:  EmailInput,
  env:    Env,
  model?: string
): Promise<ClassificationResult> {
  const { system, user } = buildPrompt(email);
  const hasImages = email.images.length > 0;
  const effectiveModel = model ?? (hasImages ? VISION_MODEL : TEXT_MODEL);

  const userContent: string | ContentPart[] = hasImages
    ? [
        { type: 'text', text: user },
        ...email.images.map(url => ({ type: 'image_url' as const, image_url: { url } })),
      ]
    : user;

  const attempt = async (): Promise<ClassificationResult> => {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization:  `Bearer ${env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model:           effectiveModel,
        response_format: { type: 'json_object' },
        messages:        [
          { role: 'system', content: system },
          { role: 'user',   content: userContent },
        ],
      }),
    });

    if (!res.ok) throw new Error(`openrouter:${res.status}`);
    const data = await res.json<{ choices: Array<{ message: { content: string } }> }>();
    const content = data.choices[0]?.message?.content ?? '';
    const parsed = parseAIResponse(content);
    if (!parsed) throw new Error('openrouter:parse-failed');
    return { ...parsed, method: 'openrouter' };
  };

  try {
    return await attempt();
  } catch (err) {
    const status = parseInt(String(err).match(/openrouter:(\d+)/)?.[1] ?? '0', 10);
    if (status >= 400 && status < 500) throw err;
    return await attempt();
  }
}
