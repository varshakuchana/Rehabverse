/** Categorize only failures that are reasonable to retry against an upstream service. */
export function transientAnalysisError(error: unknown) {
  const e = error as { status?: number; code?: number | string; name?: string; message?: string };
  return [408, 429, 500, 502, 503, 504].includes(e?.status ?? Number(e?.code)) || /timeout|timed out|fetch failed|resource[_ ]exhausted/i.test(e?.message ?? "") || ["TimeoutError", "AbortError"].includes(e?.name ?? "");
}
export function busyAnalysisError(error: unknown) {
  const e = error as { status?: number; code?: number | string; message?: string };
  const status = e?.status ?? Number(e?.code);
  return status === 429 || status === 503 || /resource[_ ]exhausted|too many requests|temporarily unavailable/i.test(e?.message ?? "");
}
function retryAfterHeader(error: unknown) {
  const value = error as { retryAfter?: string | number; headers?: Headers | Record<string, string>; response?: { headers?: Headers | Record<string, string> } };
  if (value?.retryAfter != null) return String(value.retryAfter);
  const headers = value?.response?.headers ?? value?.headers;
  if (headers instanceof Headers) return headers.get("retry-after");
  if (headers && typeof headers === "object") return headers["retry-after"] ?? headers["Retry-After"];
  return null;
}
export function retryDelayMilliseconds(error: unknown, attempt: number, random = Math.random, now = Date.now()) {
  const header = retryAfterHeader(error);
  if (header) {
    const seconds = Number(header);
    const delay = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(header) - now;
    if (Number.isFinite(delay) && delay > 0) return Math.min(delay, 15000);
  }
  return Math.min(8000, 750 * 2 ** attempt + Math.floor(random() * 350));
}
function defaultSleep(milliseconds: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) { reject(signal.reason); return; }
    const onAbort = () => { clearTimeout(timer); reject(signal.reason); };
    const timer = setTimeout(() => { signal.removeEventListener("abort", onAbort); resolve(); }, milliseconds);
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

export async function withAnalysisDeadline<T>(run: (signal: AbortSignal) => Promise<T>, signal: AbortSignal, timeout: number): Promise<T> {
  signal.throwIfAborted();
  const controller = new AbortController();
  const cancel = () => controller.abort(signal.reason);
  signal.addEventListener("abort", cancel, { once: true });
  const deadline = setTimeout(() => controller.abort(new DOMException("Document analysis timed out", "TimeoutError")), timeout);
  try { return await run(controller.signal); }
  finally { clearTimeout(deadline); signal.removeEventListener("abort", cancel); }
}

export async function analyzeWithRetry<T>(
  run: (signal: AbortSignal, attempt: number) => Promise<T>,
  signal: AbortSignal,
  timeout = 45000,
  maxAttempts = 2,
  onAttempt?: (event: "start" | "success" | "failure", attempt: number, error?: unknown) => void,
  retryOptions?: {
    random?: () => number;
    sleep?: (milliseconds: number, signal: AbortSignal) => Promise<void>;
    shouldRetry?: (error: unknown) => boolean;
  },
): Promise<T> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    onAttempt?.("start", attempt);
    try {
      const value = await withAnalysisDeadline(deadlineSignal => run(deadlineSignal, attempt), signal, timeout);
      onAttempt?.("success", attempt);
      return value;
    } catch (error) {
      onAttempt?.("failure", attempt, error);
      const shouldRetry = retryOptions?.shouldRetry ?? transientAnalysisError;
      if (signal.aborted || attempt + 1 >= maxAttempts || !shouldRetry(error)) throw error;
      await (retryOptions?.sleep ?? defaultSleep)(retryDelayMilliseconds(error, attempt, retryOptions?.random), signal);
    }
  }
  throw new Error("Analysis attempts exhausted.");
}
