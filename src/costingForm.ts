import { stripDisallowedFields } from "./lib/serviceRules.ts";
import type { ServiceType } from "./lib/serviceRules.ts";

/** Clear hidden inputs immediately, so changing back cannot restore stale costs. */
export function changeCostingService<T extends Record<string, unknown> & { serviceType: ServiceType }>(form: T, serviceType: ServiceType): T {
  const hidden = stripDisallowedFields(serviceType, {});
  return { ...form, ...Object.fromEntries(Object.keys(hidden).map(key => [key, ""])), serviceType } as T;
}
