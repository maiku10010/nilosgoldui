/** A demo deployment must never silently fall back to the shop API. */
export function resolveApiBaseUrl(configured?: string, pinnedDemoApi?: string, deploymentBranch?: string) {
  pinnedDemoApi ||= deploymentBranch === 'feature/white-label-demo' ? 'https://golddemo-api.vercel.app' : undefined;
  const base = (configured?.trim() || '/api').replace(/\/$/, '');
  if (pinnedDemoApi && base !== pinnedDemoApi.replace(/\/$/, '')) {
    throw new Error('The demo API URL does not match its isolated deployment.');
  }
  return base;
}
