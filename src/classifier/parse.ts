import type { Priority, ClassificationResult } from './types';

const VALID_PRIORITIES = new Set<Priority>(['Critical', 'High', 'Medium', 'Low', 'Not Necessary', 'Ignore']);

export function parseAIResponse(raw: string): Pick<ClassificationResult, 'priority' | 'summary' | 'label'> | null {
  try {
    const cleaned = raw.replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim();
    const data = JSON.parse(cleaned) as { priority?: unknown; summary?: unknown; label?: unknown };
    if (!VALID_PRIORITIES.has(data.priority as Priority)) return null;
    const rawLabel = String(data.label ?? '').replace(/[^A-Za-z0-9]/g, '').slice(0, 30) || 'Other';
    return {
      priority: data.priority as Priority,
      summary:  String(data.summary ?? '').slice(0, 120),
      label:    rawLabel,
    };
  } catch {
    return null;
  }
}
