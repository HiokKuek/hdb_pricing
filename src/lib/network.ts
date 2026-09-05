type RetryOptions = {
  attempts?: number;
  label: string;
  onRetry?: (message: string) => void;
  shouldRetry?: (error: unknown) => boolean;
};

const pause = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

/** Retries transient network and service failures with capped exponential backoff. */
export async function retry<T>(operation: () => Promise<T>, { attempts = 5, label, onRetry = console.warn, shouldRetry = () => true }: RetryOptions): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt === attempts || !shouldRetry(error)) break;
      const delay = Math.min(1_000 * 2 ** (attempt - 1), 16_000);
      onRetry(`${label} failed (attempt ${attempt}/${attempts}); retrying in ${Math.round(delay / 1000)}s.`);
      await pause(delay);
    }
  }
  throw lastError;
}
