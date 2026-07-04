// ── types ──────────────────────────────────────────────────────────────────
export type ServiceType = "Custom" | "Repair" | "Resize" | "Cleaning";
export type SaleStatus = "Ongoing" | "Paid" | "Released";
export type InqStatus = "Yes" | "No" | "Pending";

export interface Sale {
  id: string; invoiceId: string; date: string; clientId?: string;
  clientName: string; contactNum: string; serviceType: ServiceType;
  price: number; downpayment: number; balance: number; status: SaleStatus;
}

export interface JobCost {
  jobCostId: string; invoiceId: string; clientName: string; empId?: string;
  goldUsed: number; goldCostPerG: number; goldCost: number;
  stoneCost: number; laborCost: number; totalCost: number;
  sellingPrice: number; profit: number; marginPct: number;
}

export interface InvEntry {
  id: string; date: string; referenceId: string; itemName: string;
  goldIn: number; goldOut: number; scrap: number; balance: number; unit: string;
}

export interface Inquiry {
  inquiryId: string; date: string; customerName: string; contactInfo: string;
  details: string; category: string; quotedPrice: number; status: InqStatus;
}

export interface Expense {
  expenseId: string; expDate: string; category: string; description: string; amount: number;
}

export const TABS = [
  "DASHBOARD", "DAILY_SALES", "JOB_COSTING", "GOLD_INVENTORY",
  "INQUIRIES", "EXPENSES", "PROFIT_ANALYSIS",
] as const;

export type Tab = (typeof TABS)[number];
