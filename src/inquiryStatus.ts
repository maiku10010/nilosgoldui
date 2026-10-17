export type InquiryBucket = "Pending" | "Quoted" | "Converted to job" | "Closed";

export function inquiryBucket(status: string, quotedPrice: number): InquiryBucket | string {
  if (status === "Pending") return quotedPrice > 0 ? "Quoted" : "Pending";
  if (status === "Approved" || status === "Finished") return "Converted to job";
  if (status === "Rejected" || status === "Cancelled") return "Closed";
  return status;
}

export function inquiryMatchesTab(status: string, quotedPrice: number, tab: string) {
  return tab === "All" || inquiryBucket(status, quotedPrice) === tab;
}
