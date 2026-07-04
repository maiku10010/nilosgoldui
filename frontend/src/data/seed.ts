import type { Sale, JobCost, InvEntry, Inquiry, Expense } from "../types";

// ── seed data ──────────────────────────────────────────────────────────────
export const INIT_SALES: Sale[] = [
  { id:"1", invoiceId:"INV-2026-001", date:"2026-06-01", clientName:"Maria Santos", contactNum:"0917-123-4567", serviceType:"Custom", price:45000, downpayment:20000, balance:25000, status:"Ongoing" },
  { id:"2", invoiceId:"INV-2026-002", date:"2026-06-03", clientName:"Jose Reyes", contactNum:"0918-234-5678", serviceType:"Repair", price:3500, downpayment:3500, balance:0, status:"Released" },
  { id:"3", invoiceId:"INV-2026-003", date:"2026-06-05", clientName:"Ana Cruz", contactNum:"0919-345-6789", serviceType:"Custom", price:78000, downpayment:30000, balance:48000, status:"Ongoing" },
  { id:"4", invoiceId:"INV-2026-004", date:"2026-06-08", clientName:"Carlos Mendoza", contactNum:"0920-456-7890", serviceType:"Resize", price:800, downpayment:800, balance:0, status:"Paid" },
  { id:"5", invoiceId:"INV-2026-005", date:"2026-06-10", clientName:"Elena Villanueva", contactNum:"0921-567-8901", serviceType:"Custom", price:62000, downpayment:25000, balance:37000, status:"Ongoing" },
  { id:"6", invoiceId:"INV-2026-006", date:"2026-06-12", clientName:"Ricardo Dela Cruz", contactNum:"0922-678-9012", serviceType:"Cleaning", price:500, downpayment:500, balance:0, status:"Paid" },
  { id:"7", invoiceId:"INV-2026-007", date:"2026-06-15", clientName:"Lourdes Gonzales", contactNum:"0923-789-0123", serviceType:"Custom", price:120000, downpayment:50000, balance:70000, status:"Ongoing" },
  { id:"8", invoiceId:"INV-2026-008", date:"2026-06-18", clientName:"Benjamin Torres", contactNum:"0924-890-1234", serviceType:"Repair", price:2200, downpayment:2200, balance:0, status:"Released" },
  { id:"9", invoiceId:"INV-2026-009", date:"2026-06-20", clientName:"Teresita Flores", contactNum:"0925-901-2345", serviceType:"Custom", price:95000, downpayment:40000, balance:55000, status:"Ongoing" },
  { id:"10", invoiceId:"INV-2026-010", date:"2026-06-22", clientName:"Fernando Aquino", contactNum:"0926-012-3456", serviceType:"Resize", price:1200, downpayment:1200, balance:0, status:"Paid" },
  { id:"11", invoiceId:"INV-2026-011", date:"2026-06-24", clientName:"Cristina Bautista", contactNum:"0927-123-4568", serviceType:"Custom", price:55000, downpayment:22000, balance:33000, status:"Ongoing" },
  { id:"12", invoiceId:"INV-2026-012", date:"2026-06-25", clientName:"Eduardo Pascual", contactNum:"0928-234-5679", serviceType:"Repair", price:4500, downpayment:4500, balance:0, status:"Paid" },
];

export const INIT_JOB_COSTS: JobCost[] = [
  { jobCostId:"JC-001", invoiceId:"INV-2026-001", clientName:"Maria Santos", goldUsed:5.2, goldCostPerG:5450, goldCost:28340, stoneCost:3500, laborCost:4000, totalCost:35840, sellingPrice:45000, profit:9160, marginPct:20.4 },
  { jobCostId:"JC-002", invoiceId:"INV-2026-003", clientName:"Ana Cruz", goldUsed:8.5, goldCostPerG:5450, goldCost:46325, stoneCost:8000, laborCost:6000, totalCost:60325, sellingPrice:78000, profit:17675, marginPct:22.7 },
  { jobCostId:"JC-003", invoiceId:"INV-2026-005", clientName:"Elena Villanueva", goldUsed:6.8, goldCostPerG:5450, goldCost:37060, stoneCost:5500, laborCost:5000, totalCost:47560, sellingPrice:62000, profit:14440, marginPct:23.3 },
  { jobCostId:"JC-004", invoiceId:"INV-2026-007", clientName:"Lourdes Gonzales", goldUsed:14.2, goldCostPerG:5450, goldCost:77390, stoneCost:12000, laborCost:9000, totalCost:98390, sellingPrice:120000, profit:21610, marginPct:18.0 },
  { jobCostId:"JC-005", invoiceId:"INV-2026-009", clientName:"Teresita Flores", goldUsed:10.5, goldCostPerG:5450, goldCost:57225, stoneCost:9500, laborCost:7500, totalCost:74225, sellingPrice:95000, profit:20775, marginPct:21.9 },
  { jobCostId:"JC-006", invoiceId:"INV-2026-011", clientName:"Cristina Bautista", goldUsed:7.2, goldCostPerG:5450, goldCost:39240, stoneCost:4800, laborCost:4500, totalCost:48540, sellingPrice:55000, profit:6460, marginPct:11.7 },
  { jobCostId:"JC-007", invoiceId:"INV-2026-002", clientName:"Jose Reyes", goldUsed:0, goldCostPerG:5450, goldCost:0, stoneCost:0, laborCost:800, totalCost:800, sellingPrice:3500, profit:2700, marginPct:77.1 },
  { jobCostId:"JC-008", invoiceId:"INV-2026-008", clientName:"Benjamin Torres", goldUsed:0, goldCostPerG:5450, goldCost:0, stoneCost:0, laborCost:600, totalCost:600, sellingPrice:2200, profit:1600, marginPct:72.7 },
  { jobCostId:"JC-009", invoiceId:"INV-2026-012", clientName:"Eduardo Pascual", goldUsed:0, goldCostPerG:5450, goldCost:0, stoneCost:0, laborCost:700, totalCost:700, sellingPrice:4500, profit:3800, marginPct:84.4 },
];

export const INIT_INVENTORY: InvEntry[] = [
  { id:"1", date:"2026-05-28", referenceId:"PO-2026-041", itemName:"24K Gold Bullion Purchase", goldIn:50.0, goldOut:0, scrap:0, balance:50.0, unit:"grams" },
  { id:"2", date:"2026-06-03", referenceId:"INV-2026-001", itemName:"Custom Ring – Maria Santos", goldIn:0, goldOut:5.2, scrap:0.3, balance:44.5, unit:"grams" },
  { id:"3", date:"2026-06-05", referenceId:"INV-2026-003", itemName:"Custom Necklace – Ana Cruz", goldIn:0, goldOut:8.5, scrap:0.5, balance:35.5, unit:"grams" },
  { id:"4", date:"2026-06-07", referenceId:"PO-2026-042", itemName:"18K Gold Purchase", goldIn:100.0, goldOut:0, scrap:0, balance:135.5, unit:"grams" },
  { id:"5", date:"2026-06-10", referenceId:"INV-2026-005", itemName:"Custom Bracelet – Elena Villanueva", goldIn:0, goldOut:6.8, scrap:0.4, balance:128.3, unit:"grams" },
  { id:"6", date:"2026-06-15", referenceId:"INV-2026-007", itemName:"Custom Set – Lourdes Gonzales", goldIn:0, goldOut:14.2, scrap:0.8, balance:113.3, unit:"grams" },
  { id:"7", date:"2026-06-17", referenceId:"PO-2026-043", itemName:"Gold Alloy Purchase", goldIn:30.0, goldOut:0, scrap:0, balance:143.3, unit:"grams" },
  { id:"8", date:"2026-06-20", referenceId:"INV-2026-009", itemName:"Custom Pendant – Teresita Flores", goldIn:0, goldOut:10.5, scrap:0.6, balance:132.2, unit:"grams" },
  { id:"9", date:"2026-06-22", referenceId:"INV-2026-002", itemName:"Scrap Recovery – Reyes Repair", goldIn:0, goldOut:0, scrap:0.3, balance:131.9, unit:"grams" },
  { id:"10", date:"2026-06-24", referenceId:"INV-2026-011", itemName:"Custom Ring – Cristina Bautista", goldIn:0, goldOut:7.2, scrap:0.5, balance:124.2, unit:"grams" },
];

export const INIT_INQUIRIES: Inquiry[] = [
  { inquiryId:"INQ-001", date:"2026-06-01", customerName:"Patricia Lim", contactInfo:"0917-111-2222", details:"18K gold engagement ring with diamond solitaire", category:"Custom Ring", quotedPrice:65000, status:"Yes" },
  { inquiryId:"INQ-002", date:"2026-06-02", customerName:"Roberto Chan", contactInfo:"0918-222-3333", details:"Gold necklace repair – broken clasp", category:"Repair", quotedPrice:1500, status:"Yes" },
  { inquiryId:"INQ-003", date:"2026-06-04", customerName:"Sophia Ang", contactInfo:"0919-333-4444", details:"Custom gold bracelet with name engrave", category:"Custom Bracelet", quotedPrice:38000, status:"Pending" },
  { inquiryId:"INQ-004", date:"2026-06-06", customerName:"Miguel Garcia", contactInfo:"0920-444-5555", details:"Wedding band set, 2 pcs 18K yellow gold", category:"Wedding Band", quotedPrice:55000, status:"Yes" },
  { inquiryId:"INQ-005", date:"2026-06-08", customerName:"Isabella Tan", contactInfo:"0921-555-6666", details:"Gold earrings with emerald stones", category:"Custom Earrings", quotedPrice:28000, status:"No" },
  { inquiryId:"INQ-006", date:"2026-06-10", customerName:"Diego Ramos", contactInfo:"0922-666-7777", details:"Ring resize from size 7 to size 9", category:"Resize", quotedPrice:800, status:"Yes" },
  { inquiryId:"INQ-007", date:"2026-06-12", customerName:"Carmen Lopez", contactInfo:"0923-777-8888", details:"Gold chain necklace 24K, 18 inches", category:"Custom Necklace", quotedPrice:48000, status:"Pending" },
  { inquiryId:"INQ-008", date:"2026-06-14", customerName:"Andres Vega", contactInfo:"0924-888-9999", details:"Gold ring cleaning and polishing", category:"Cleaning", quotedPrice:500, status:"Yes" },
  { inquiryId:"INQ-009", date:"2026-06-16", customerName:"Valentina Cruz", contactInfo:"0925-999-0000", details:"Custom gold pendant with birthstone", category:"Custom Pendant", quotedPrice:22000, status:"No" },
  { inquiryId:"INQ-010", date:"2026-06-18", customerName:"Santiago Reyes", contactInfo:"0926-000-1111", details:"Antique gold bracelet appraisal and repair", category:"Repair", quotedPrice:5500, status:"Pending" },
  { inquiryId:"INQ-011", date:"2026-06-20", customerName:"Marisol Navarro", contactInfo:"0927-111-2223", details:"Custom 18K white gold ring with ruby", category:"Custom Ring", quotedPrice:72000, status:"Yes" },
  { inquiryId:"INQ-012", date:"2026-06-22", customerName:"Ernesto Dela Rosa", contactInfo:"0928-222-3334", details:"Gold coin pendant custom engraving", category:"Custom Pendant", quotedPrice:15000, status:"Pending" },
];

export const INIT_EXPENSES: Expense[] = [
  { expenseId:"EXP-001", expDate:"2026-06-01", category:"Rent", description:"Monthly shop rental – June 2026", amount:18000 },
  { expenseId:"EXP-002", expDate:"2026-06-01", category:"Staff Salary", description:"3 craftsmen × ₱9,000/mo", amount:27000 },
  { expenseId:"EXP-003", expDate:"2026-06-05", category:"Utilities", description:"Meralco electric bill – May billing", amount:4500 },
  { expenseId:"EXP-004", expDate:"2026-06-05", category:"Utilities", description:"Globe broadband + PLDT phone line", amount:1800 },
  { expenseId:"EXP-005", expDate:"2026-06-10", category:"Supplies", description:"Soldering materials, polishing compounds", amount:3200 },
  { expenseId:"EXP-006", expDate:"2026-06-12", category:"Supplies", description:"Jewelry display cases replacement", amount:2800 },
  { expenseId:"EXP-007", expDate:"2026-06-15", category:"Tax & Permits", description:"BIR quarterly advance payment", amount:12000 },
  { expenseId:"EXP-008", expDate:"2026-06-18", category:"Supplies", description:"Packaging boxes and gift bags", amount:1500 },
  { expenseId:"EXP-009", expDate:"2026-06-20", category:"Staff Salary", description:"Overtime pay – rush orders", amount:4500 },
  { expenseId:"EXP-010", expDate:"2026-06-22", category:"Utilities", description:"Water bill – NAWASA June", amount:650 },
  { expenseId:"EXP-011", expDate:"2026-06-25", category:"Supplies", description:"New jeweler's loupe and precision tools", amount:5500 },
  { expenseId:"EXP-012", expDate:"2026-06-28", category:"Tax & Permits", description:"Business permit renewal – BPLO", amount:3500 },
];

// ── chart data ─────────────────────────────────────────────────────────────
export const MONTHLY = [
  { month:"Jan", revenue:285000, cost:201000, expenses:68000 },
  { month:"Feb", revenue:322000, cost:227000, expenses:70000 },
  { month:"Mar", revenue:398000, cost:278000, expenses:72500 },
  { month:"Apr", revenue:778000, cost:478000, expenses:76500 },
  { month:"May", revenue:445000, cost:312000, expenses:74000 },
];

export const PIE_COLORS = ["#d4a017","#f59e0b","#38bdf8","#a78bfa","#ef4444"];
