/** HTTP helpers for import scripts: polite User-Agent, pacing and retries. */

export const USER_AGENT =
  "ObservatorioHabitacao-data-import/0.1 (+https://observatoriohabitacao.pt)";

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Fetches a URL, retrying network errors, 429 and 5xx responses with backoff. */
export async function fetchWithRetry(url: string, attempts = 4): Promise<Response> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      const response = await fetch(url, {
        headers: { "User-Agent": USER_AGENT },
        signal: AbortSignal.timeout(60_000),
      });
      if (response.ok) return response;
      if (response.status !== 429 && response.status < 500) {
        throw new Error(`HTTP ${response.status} for ${url}`);
      }
      lastError = new Error(`HTTP ${response.status} for ${url}`);
    } catch (error) {
      lastError = error;
      if (error instanceof Error && error.message.startsWith("HTTP 4")) throw error;
    }
    await sleep(1000 * 2 ** i);
  }
  throw lastError;
}

/** Fetches JSON; some endpoints answer 200 with an empty body under load, so that is retried too. */
export async function fetchJson<T>(url: string, attempts = 4): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    const text = await (await fetchWithRetry(url)).text();
    try {
      return JSON.parse(text) as T;
    } catch (error) {
      lastError = error;
      await sleep(1000 * 2 ** i);
    }
  }
  throw new Error(`Invalid JSON from ${url}: ${String(lastError)}`);
}
