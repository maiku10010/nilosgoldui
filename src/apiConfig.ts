/** A demo deployment must never silently fall back to the shop API. */
export function resolveApiBaseUrl(configured?: string, pinnedDemoApi?: string) {
  const base = (configured?.trim() || '/api').replace(/\/$/, '');
  if (pinnedDemoApi && base !== pinnedDemoApi.replace(/\/$/, '')) {
    throw new Error('The demo API URL does not match its isolated deployment.');
  }
  return base;
}
