import { roundTwo } from "./rounding.ts";
import { stripDisallowedFields } from "./lib/serviceRules.ts";
import type { ServiceType } from "./lib/serviceRules.ts";

/** Clear hidden inputs immediately, so changing back cannot restore stale costs. */
export function changeCostingService<T extends Record<string, unknown> & { serviceType: ServiceType }>(form: T, serviceType: ServiceType): T {
  const hidden = stripDisallowedFields(serviceType, {});
  return { ...form, ...Object.fromEntries(Object.keys(hidden).map(key => [key, ""])), serviceType } as T;
}

/** Blank optional amounts are unrecorded, rather than measured as zero. */
export function optionalCostValue(value: string): number | null {
  return value.trim() === "" ? null : roundTwo(value);
}

/** Apply the inquiry's type to the one form state and clear costs it hides. */
export function applyInquiryToCosting<T extends Record<string, unknown> & { serviceType: ServiceType }>(form: T, inquiry?: {
  inquiryId: string; serviceType?: ServiceType | null; customerName: string; contactInfo: string; quotedPrice: number;
}): T {
  const updated = { ...form, inquiryId: inquiry?.inquiryId ?? "", clientName: inquiry?.customerName ?? "", contactNum: inquiry?.contactInfo ?? "", sellingPrice: inquiry ? String(inquiry.quotedPrice) : "" };
  return inquiry?.serviceType ? changeCostingService(updated, inquiry.serviceType) : updated;
}

/** Match the API's 30% labor calculation from the saved quote, in cents. */
export function quotedLaborCost(quotedPrice: number | null | undefined): string {
  if (quotedPrice == null || !Number.isFinite(quotedPrice) || quotedPrice < 0) return "";
  const cents = Math.round(roundTwo(quotedPrice) * 100);
  return (Math.round(cents * 30 / 100) / 100).toFixed(2);
}
