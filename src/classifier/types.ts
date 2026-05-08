import type { EmailMessage } from '../gmail/types';

export type Priority = 'Critical' | 'High' | 'Medium' | 'Low' | 'Not Necessary' | 'Ignore';

export interface ClassificationResult {
  priority: Priority;
  summary:  string;
  label:    string;
  method:   'rule' | 'workers-ai' | 'openrouter' | 'fallback';
}

export type { EmailMessage as EmailInput };
