/** A page-local analysis lease. There is deliberately no shared/global lock. */
export function beginHEPAnalysis(current: AbortController | null) {
  return current ? null : new AbortController();
}

export function cancelHEPAnalysis(current: AbortController | null) {
  current?.abort();
  return null;
}

/** Only the request that owns the lease may release it. */
export function finishHEPAnalysis(current: AbortController | null, completed: AbortController) {
  return current === completed ? null : current;
}
