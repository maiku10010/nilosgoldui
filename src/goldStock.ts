import { serviceRules } from "./lib/serviceRules.ts";
type GoldMovement = {
  referenceId: string; category: string; goldKarat?: number | null; jobCostId?: string | null; itemName: string; unit: string;
  quantityIn: number | string; quantityOut: number | string; quantityLoss: number | string;
};

// Decimal text is scaled with integer arithmetic, including scientific notation
// from API numbers. Gold balances keep sub-milligram precision until display.
function scaled(value: number | string, places: number): bigint {
  const match = String(value).trim().replace(/^([+-]?)\./, (_, sign) => sign + "0.").match(/^([+-]?)(\d+)(?:\.(\d*))?(?:e([+-]?\d+))?$/i);
  if (!match) throw new Error("Invalid decimal quantity.");
  const digits = BigInt(match[2] + (match[3] ?? ""));
  const shift = places + Number(match[4] ?? 0) - (match[3]?.length ?? 0);
  const result = shift >= 0 ? digits * 10n ** BigInt(shift) : digits / 10n ** BigInt(-shift);
  return match[1] === "-" ? -result : result;
}

export function gramsToMilligrams(value: string): number | null {
  if (!/^(?:\d+(?:\.\d{0,3})?|\.\d{1,3})$/.test(value)) return null;
  const amount = scaled(value.startsWith(".") ? "0" + value : value, 3);
  return amount <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(amount) : null;
}

export function milligramsToGrams(amount: number): string {
  const mg = BigInt(amount);
  const fraction = (mg % 1000n).toString().padStart(3, "0").replace(/0+$/, "");
  return (mg / 1000n).toLocaleString("en-PH") + (fraction ? "." + fraction : "");
}

export function goldStockSources(inventory: GoldMovement[], editingJobId?: string | null) {
  const pools = new Map<number, { source: GoldMovement | null; nanograms: bigint }>();
  for (const row of inventory) {
    if (row.category !== "GOLD" || row.goldKarat == null) continue;
    const pool = pools.get(row.goldKarat) ?? { source: null, nanograms: 0n };
    if (!pool.source && scaled(row.quantityIn, 10) > 0n) pool.source = row;
    if (!editingJobId || row.jobCostId !== editingJobId) {
      let change = scaled(row.quantityIn, 10) - scaled(row.quantityOut, 10) - scaled(row.quantityLoss, 10);
      if (row.unit === "troy oz") change = change * 311034768n / 10000000n;
      pool.nanograms += change;
    }
    pools.set(row.goldKarat, pool);
  }
  return [...pools].filter(([, pool]) => pool.source).map(([karat, pool]) => ({
    referenceId: pool.source!.referenceId, karat, itemName: `Gold · ${karat}K`,
    availableMg: Number(pool.nanograms > 0n ? pool.nanograms / 10000000n : 0n),
  })).sort((a, b) => b.karat - a.karat);
}

export function goldStockError(used: string, scrap: string, source: ReturnType<typeof goldStockSources>[number] | undefined) {
  if (!source) return "Choose a gold source.";
  const usedMg = gramsToMilligrams(used || "0");
  const scrapMg = gramsToMilligrams(scrap || "0");
  if (usedMg === null || scrapMg === null) return "Enter non-negative weights with at most 3 decimal places.";
  if (usedMg + scrapMg > source.availableMg) return `Insufficient ${source.itemName}: used + scrap must not exceed ${milligramsToGrams(source.availableMg)} g available.`;
  return "";
}

export function costingSummary(used: string, scrap: string, rate: string, stone: string, labor: string, price: string, serviceType: string = "Custom") {
  const rules = serviceRules(serviceType);
  if (!rules.gold) { used = "0"; rate = "0"; }
  if (!rules.scrap) scrap = "0";
  if (!rules.stone) stone = "0";
  if (!rules.labor) labor = "0";
  // Imported weights can have more precision than the milligram form inputs.
  // Keep those exact using the same integer scale as stock aggregation.
  const weight = (value: string) => /^(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(value) ? scaled(value, 10) : 0n;
  const usedUnits = weight(used || "0");
  const scrapUnits = weight(scrap || "0");
  const cents = (value: string) => /^\d*(?:\.\d{0,2})?$/.test(value) && value !== "." ? scaled(value || "0", 2) : 0n;
  const rateCents = cents(rate);
  const usedCents = (usedUnits * rateCents + 5000000000n) / 10000000000n;
  const goldCents = ((usedUnits + scrapUnits) * rateCents + 5000000000n) / 10000000000n;
  const scrapCents = goldCents - usedCents;
  const totalCents = goldCents + cents(stone) + cents(labor);
  const priceCents = cents(price);
  const profitCents = priceCents - totalCents;
  return { gold: Number(usedCents) / 100, scrap: Number(scrapCents) / 100, goldCost: Number(goldCents) / 100,
    total: Number(totalCents) / 100, profit: Number(profitCents) / 100, margin: priceCents > 0n ? Number(profitCents) / Number(priceCents) * 100 : null };
}
