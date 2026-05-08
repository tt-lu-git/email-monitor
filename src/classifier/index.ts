import type { Env } from '../env';
import type { ClassificationResult, EmailInput } from './types';
import { applyRules } from './rules';
import { isCircuitOpen, recordFailure, recordSuccess } from './circuit-breaker';
import { callWorkersAI } from './workers-ai';
import { callOpenRouter } from './openrouter';

const DAILY_CAP = 500;

async function isOverDailyCap(env: Env): Promise<boolean> {
  try {
    const key = `classifier:daily:${new Date().toISOString().slice(0, 10)}`;
    const raw = await env.KV.get(key);
    return raw !== null && parseInt(raw, 10) >= DAILY_CAP;
  } catch {
    return false;
  }
}

async function incrementDailyCount(env: Env): Promise<void> {
  try {
    const key = `classifier:daily:${new Date().toISOString().slice(0, 10)}`;
    const raw = await env.KV.get(key);
    const count = raw ? parseInt(raw, 10) + 1 : 1;
    await env.KV.put(key, String(count), { expirationTtl: 90000 });
  } catch { /* non-fatal */ }
}

const FALLBACK: ClassificationResult = {
  priority: 'Medium',
  summary:  'Classification unavailable',
  label:    'Other',
  method:   'fallback',
};

export async function classifyEmail(email: EmailInput, env: Env): Promise<ClassificationResult> {
  const ruleResult = applyRules(email);
  if (ruleResult) return ruleResult;

  if (await isCircuitOpen(env)) return FALLBACK;
  if (await isOverDailyCap(env)) return FALLBACK;

  try {
    const result = await callOpenRouter(email, env);
    await recordSuccess(env);
    await incrementDailyCount(env);
    return result;
  } catch {
    try {
      const result = await callOpenRouter(email, env, 'deepseek/deepseek-v4-flash');
      await recordSuccess(env);
      await incrementDailyCount(env);
      return result;
    } catch {
      try {
        // Workers AI is text-only — strip images before falling through
      const result = await callWorkersAI({ ...email, images: [] }, env);
        await recordSuccess(env);
        await incrementDailyCount(env);
        return result;
      } catch {
        await recordFailure(env);
        return FALLBACK;
      }
    }
  }
}

export type { ClassificationResult, EmailInput, Priority } from './types';
