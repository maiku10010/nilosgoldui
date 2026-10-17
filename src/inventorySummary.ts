type Movement = { category: string; unit: string; itemName: string; goldKarat?: number | null; quantityIn: number; quantityOut: number; quantityLoss: number };
const TROY_OUNCE_GRAMS = 31.1034768;
const stockKey = (row: Movement) => ["GOLD", "SCRAP"].includes(row.category) ? `${row.category}:${row.goldKarat ?? "unknown"}:grams` : JSON.stringify([row.category, row.unit, row.itemName.trim().toLowerCase()]);

export const isPieceUnit = (unit: string) => /^(?:pc|pcs|piece|pieces)$/i.test(unit.trim());

export function sumGemstonePieces(products: Array<Movement & { balance: number }>) {
  return products
    .filter(product => product.category === "GEMSTONES" && isPieceUnit(product.unit))
    .reduce((total, product) => total + Math.max(0, product.balance), 0);
}

export function estimateGoldValue(products: Array<Movement & { balance: number }>, ratePerGram24k: number) {
  return products.reduce((total, product) => {
    if (product.category !== "GOLD" || !Number.isFinite(product.goldKarat) || !product.goldKarat) return total;
    return total + Math.max(0, product.balance) * ratePerGram24k * product.goldKarat / 24;
  }, 0);
}

export function summarizeInventory(all: Movement[], visible: Movement[]) {
  const products = new Map<string, { unit: string; quantity: number }>();
  for (const row of all) {
    const key = stockKey(row);
    const factor = row.category === "GOLD" && row.unit === "troy oz" ? TROY_OUNCE_GRAMS : 1;
    const current = products.get(key) ?? { unit: row.category === "GOLD" ? "grams" : row.unit, quantity: 0 };
    current.quantity += (row.quantityIn - row.quantityOut - row.quantityLoss) * factor;
    products.set(key, current);
  }
  const visibleKeys = new Set(visible.map(stockKey));
  const quantities = new Map<string, number>();
  let inStock = 0;
  for (const key of visibleKeys) {
    const product = products.get(key)!;
    if (product.quantity > 0.000001) {
      inStock++;
      quantities.set(product.unit, (quantities.get(product.unit) ?? 0) + product.quantity);
    }
  }
  return { entries: visible.length, products: visibleKeys.size, inStock,
    quantities: [...quantities].sort(([a], [b]) => a.localeCompare(b)),
    goldGrams: Math.max(0, [...products.entries()].filter(([key]) => key.startsWith("GOLD:")).reduce((sum, [, product]) => sum + product.quantity, 0)) };
}

// Match the API's stock pools, retaining individual movements for audit/editing.
export function groupInventory<T extends Movement>(all: T[], visible: T[] = all) {
  const visibleKeys = new Set(visible.map(stockKey));
  const groups = new Map<string, { key: string; itemName: string; category: string; goldKarat?: number | null; unit: string; quantityIn: number; quantityOut: number; quantityLoss: number; balance: number; movements: T[] }>();
  for (const row of all) {
    const key = stockKey(row);
    if (!visibleKeys.has(key)) continue;
    const group = groups.get(key) ?? { key, itemName: row.category === "GOLD" ? `Gold${row.goldKarat == null ? " (karat unspecified)" : ` Â· ${row.goldKarat}K`}` : row.category === "SCRAP" ? `Scrap gold${row.goldKarat == null ? "" : ` · ${row.goldKarat}K`}` : row.itemName, category: row.category, goldKarat: ["GOLD", "SCRAP"].includes(row.category) ? row.goldKarat : null, unit: row.category === "GOLD" ? "grams" : row.unit, quantityIn: 0, quantityOut: 0, quantityLoss: 0, balance: 0, movements: [] };
    const factor = row.category === "GOLD" && row.unit === "troy oz" ? TROY_OUNCE_GRAMS : 1;
    group.quantityIn += row.quantityIn * factor;
    group.quantityOut += row.quantityOut * factor;
    group.quantityLoss += row.quantityLoss * factor;
    group.balance = group.quantityIn - group.quantityOut - group.quantityLoss;
    group.movements.push(row);
    groups.set(key, group);
  }
  return [...groups.values()];
}

export function finishSaleMaterials<T extends Movement & { referenceId: string }>(inventory: T[]) {
  return groupInventory(inventory)
    .filter(product => product.category !== "GOLD" && product.category !== "SCRAP" && product.category !== "TOOLS" && product.balance > 0)
    .map(product => ({
      key: product.key,
      referenceId: product.movements[0].referenceId,
      itemName: product.itemName,
      unit: product.unit === "grams" ? "g" : isPieceUnit(product.unit) ? "pcs" : product.unit,
      available: product.balance,
      category: product.category,
    }))
    .sort((a, b) => a.itemName.localeCompare(b.itemName) || a.unit.localeCompare(b.unit));
}

export function materialQuantityError(value: string, available: number, unit: string) {
  const quantity = Number(value);
  if (!value.trim() || !Number.isFinite(quantity) || quantity <= 0) return "Enter a quantity greater than zero.";
  if (quantity > available) return `Only ${available.toLocaleString("en-PH", { maximumFractionDigits: 6 })} ${unit} available.`;
  return "";
}

export function sortInventoryStock<T extends Movement>(products: T[]) {
  const karatOrder = [24, 22, 21, 18, 14, 10];
  const materialOrder: Record<string, number> = { GOLD: 0, SILVER: 1, GEMSTONES: 2, SCRAP: 3 };
  return products.filter(product => product.category in materialOrder).sort((a, b) => {
    const materialDelta = materialOrder[a.category] - materialOrder[b.category];
    if (materialDelta) return materialDelta;
    if (a.category === "GOLD" && b.category === "GOLD") {
      const karatRank = (karat: number | null | undefined) => karat == null ? 6 : karatOrder.indexOf(karat) < 0 ? 7 : karatOrder.indexOf(karat);
      return karatRank(a.goldKarat) - karatRank(b.goldKarat) || (b.goldKarat ?? 0) - (a.goldKarat ?? 0);
    }
    return a.itemName.localeCompare(b.itemName);
  });
}
