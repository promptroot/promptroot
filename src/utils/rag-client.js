const DEFAULT_ENDPOINT = 'https://us-central1-promptroot-b02a2.cloudfunctions.net/ragQuery';

export async function ragQuery({
  query,
  topK = 5,
  endpoint = DEFAULT_ENDPOINT,
  fetchImpl = fetch,
  signal
} = {}) {
  if (typeof query !== 'string' || query.trim().length === 0) {
    throw new Error('ragQuery: query is required');
  }
  const resp = await fetchImpl(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, topK }),
    signal
  });
  if (!resp.ok) {
    throw new Error(`ragQuery failed: ${resp.status}`);
  }
  const data = await resp.json();
  return Array.isArray(data.results) ? data.results : [];
}
