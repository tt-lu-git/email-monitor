export interface EmailMessage {
  id:             string;
  threadId:       string;
  from:           string;
  subject:        string;
  snippet:        string;
  bodyText:       string;
  attachmentText: string;   // text extracted from PDF/TXT attachments
  images:         string[]; // base64 data URLs: "data:image/jpeg;base64,..."
  date:           string;
  labels:         string[];
  headers:        Record<string, string>;
}

export interface GmailWebhookPayload {
  emailAddress: string;
  historyId:    string;
}
