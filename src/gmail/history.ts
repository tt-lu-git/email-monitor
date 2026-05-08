export interface HistoryResult {
  messageIds:    string[];
  nextHistoryId: string;
}

export async function fetchHistory(startHistoryId: string, accessToken: string): Promise<HistoryResult> {
  const messageIds: string[] = [];
  let pageToken: string | undefined;
  let nextHistoryId = startHistoryId;

  do {
    const url = new URL('https://gmail.googleapis.com/gmail/v1/users/me/history');
    url.searchParams.set('startHistoryId', startHistoryId);
    url.searchParams.set('historyTypes', 'messageAdded');
    if (pageToken) url.searchParams.set('pageToken', pageToken);

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (res.status === 404) throw new Error('gmail:history:gap');
    if (res.status === 401) throw new Error('gmail:auth:401');
    if (!res.ok) throw new Error(`gmail:history.list:${res.status}`);

    const data = await res.json<{
      history?: Array<{ messagesAdded?: Array<{ message: { id: string } }> }>;
      nextPageToken?: string;
      historyId: string;
    }>();

    for (const item of data.history ?? []) {
      for (const added of item.messagesAdded ?? []) {
        messageIds.push(added.message.id);
      }
    }

    nextHistoryId = data.historyId;
    pageToken = data.nextPageToken;
  } while (pageToken);

  return { messageIds, nextHistoryId };
}

export async function fallbackSync(accessToken: string): Promise<string[]> {
  const res = await fetch(
    'https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=10&q=newer_than%3A1d',
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) throw new Error(`gmail:messages.list:${res.status}`);
  const data = await res.json<{ messages?: Array<{ id: string }> }>();
  return (data.messages ?? []).map(m => m.id);
}
