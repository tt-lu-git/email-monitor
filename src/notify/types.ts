export interface NtfyPayload {
  title:     string;
  message:   string;
  priority:  number;
  tags:      string[];
  markdown?: boolean;
}
