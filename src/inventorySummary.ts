type Movement = { category: string; unit: string; itemName: string; quantityIn: number; quantityOut: number; quantityLoss: number };
const TROY_OUNCE_GRAMS = 31.1034768;
const stockKey = (row: Movement) => row.category === "GOLD" ? "GOLD:grams" : JSON.stringify([row.category, row.unit, row.itemName.trim().toLowerCase()]);

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
    goldGrams: Math.max(0, products.get("GOLD:grams")?.quantity ?? 0) };
}
